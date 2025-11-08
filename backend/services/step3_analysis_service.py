import os
import json
import pandas as pd
import numpy as np
import google.generativeai as genai
from google.genai import types as genai_types # Pro 모델의 Schema에 필요
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import sleep

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델/DB 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# [모델 설정]
SUMMARY_MODEL_NAME = 'gemini-2.5-pro' # 1단계 요약용
COMPARISON_MODEL_NAME = 'gemini-2.5-pro' # 3단계 비교용
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2' # 2단계 S-BERT용

# [LLM 클라이언트]
llm_client_pro = None
llm_client_flash = None
embedding_model = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client_pro = genai.GenerativeModel(SUMMARY_MODEL_NAME)
        llm_client_flash = genai.GenerativeModel(COMPARISON_MODEL_NAME)
        print(f"[Service 3] LLM Models (Pro, Flash) loaded.")
    except Exception as e:
        print(f"[Service 3] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service 3] WARNING: GEMINI_API_KEY not found. LLM Analysis will fail.")

# [S-BERT 모델]
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service 3] Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load SentenceTransformer model: {e}")

# [DB 설정 (단일 파일)]
# (경로 예시: backend/data/dummy_data_with_embeddings.csv)
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
# Colab 코드에서 가져온 DB 파일명으로 수정 (step_3 기반)
DB_FILE_PATH = os.path.join(BASE_DATA_DIR, 'dummy_data_with_embeddings.csv')

# [DB 로드 (단일 파일)]
db_vectors = None
db_filenames = None
analysis_db_dict = None # S-BERT 검색과 LLM 비교 모두 이 파일 하나만 사용

try:
    if os.path.exists(DB_FILE_PATH):
        df_db = pd.read_csv(DB_FILE_PATH)
        
        # 1. S-BERT 검색용 데이터 추출 (step_3 로직)
        db_vectors = np.array([json.loads(v) for v in df_db['embedding_vector']])
        db_filenames = df_db['source_file'].tolist()
        
        # 2. LLM 정밀 비교용 데이터 추출 (step_4 로직 - 동일 파일 대상)
        df_db = df_db.drop_duplicates(subset=['source_file'], keep='last')
        analysis_db_dict = df_db.set_index('source_file').to_dict('index')
        
        print(f"[Service 3] Main DB loaded ({len(df_db)} items) from {DB_FILE_PATH}")
    else:
        print(f"[Service 3] WARNING: Main DB not found at {DB_FILE_PATH}")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load Main DB: {e}")


MAX_RETRIES = 3

# [프롬프트 및 스키마 (1단계 요약용 - step_3 코드 기반)]
JSON_SYSTEM_PROMPT = (
    "You are an expert academic text analyst. Your task is to thoroughly read the provided text and "
    "generate a structured summary in JSON format. "
    "You **must** write your answers in **full, natural-language sentences** in Korean. "
    "Do NOT use keyword lists or lemmatized phrases (e.g., 'problem identify → solution suggest'). "
    "Your goal is to create a summary that is *semantically rich* and *unique* to this specific document. "
    "\n\n"
    "Crucially, your summaries for each field must be **concrete and specific**:"
    "1.  **core_thesis**: Provide the single central argument. **Use specific subjects and verbs from the text's topic.** "
    "    (e.g., DO NOT use generic phrases like '...is important' or '...harms the essence'. "
    "    DO use specific phrases like '...causes a decline in student engagement' or '...shifts political discourse towards emotion'.)"
    "2.  **primary_argument_1 / 2**: Summarize the main supporting evidence. **Be concrete.** "
    "    (e.g., If the text uses data, mention the data. If it uses an example, mention the example.)"
    "3.  **key_concepts**: Extract 5-7 **specific, unique keywords or proper nouns** from the text (e.g., 'Fandom Politics', 'Intrinsic Motivation', 'Panopticon')."
    "4.  **logical_structure_flow**: Describe the logical flow using **natural language sentences**. "
    "    (e.g., 'The text begins by defining the problem, then presents historical context, and finally suggests three solutions.')"
    "\n\n"
    "You must respond strictly in the following JSON format, in Korean:"
    "\n\n"
    "```json\n"
    "{\n"
    "  \"assignment_type\": \"[e.g., Argumentative Essay, Research Proposal]\",\n"
    "  \"core_thesis\": \"[The specific central argument in a full sentence]\",\n"
    "  \"primary_argument_1\": \"[The first concrete supporting argument or evidence in a sentence]\",\n"
    "  \"primary_argument_2\": \"[The second main supporting argument or data in a sentence]\",\n"
    "  \"logical_structure_flow\": \"[A description of the text's flow in natural language sentences]\",\n"
    "  \"key_concepts\": \"[5-7 specific keywords or proper nouns, comma-separated]\",\n"
    "  \"conclusion_implication\": \"[The key takeaway or implication summarized in a full sentence]\"\n"
    "}\n"
    "```"
)

JSON_SCHEMA = genai_types.Schema(
    type=genai_types.Type.OBJECT,
    properties={
        "assignment_type": genai_types.Schema(type=genai_types.Type.STRING),
        "core_thesis": genai_types.Schema(type=genai_types.Type.STRING),
        "primary_argument_1": genai_types.Schema(type=genai_types.Type.STRING),
        "primary_argument_2": genai_types.Schema(type=genai_types.Type.STRING),
        "logical_structure_flow": genai_types.Schema(type=genai_types.Type.STRING),
        "key_concepts": genai_types.Schema(type=genai_types.Type.STRING),
        "conclusion_implication": genai_types.Schema(type=genai_types.Type.STRING),
    }
)
EMBEDDING_KEYS = ['key_concepts'] # (step_3 코드 기반)

# [프롬프트 (3단계 비교용 - step_4 코드 기반)]
COMPARISON_SYSTEM_PROMPT = (
    "You are an expert evaluator comparing two structured analysis reports (JSON format) derived from academic essays. "
    "Your task is to assess the *logical and conceptual similarity* between the 'Submission' report and the 'Candidate' report. "
    "Do NOT compare the raw text; compare only the provided JSON analysis data."
    "\n\n"
    "Please analyze the following two JSON reports:"
    "\n--- (Submission JSON) ---\n"
    "{submission_json_str}"
    "\n--- (Candidate JSON) ---\n"
    "{candidate_json_str}"
    "\n\n"
    "Evaluate the pair by comparing their corresponding JSON fields. "
    "First, determine the overall *structural and conceptual similarity* level using the following four-point scale:"
    "\n"
    "- **Very High** – The two reports share almost identical thesis, structure, and key_concepts. Nearly a duplicate in logical design."
    "- **High** – The reports have a very similar thesis and structure with partially overlapping key_concepts."
    "- **Moderate** – The reports share thematic resemblance (similar key_concepts) but differ in thesis or structure."
    "- **Low** – The reports differ substantially in thesis, structure, and key_concepts.\n"
    "\n"
    "Please provide your evaluation in the following format (Do not add a one-sentence summary reason):"
    "\n"
    "- **Similarity Level:** [Very High / High / Moderate / Low]"
    "\n"
    "- **Detailed Evaluation:**"
    "  1. Core Thesis Similarity: [Provide your detailed comparison of the 'core_thesis' fields]"
    "  2. Argument Similarity (primary_argument_1/2): [Provide your detailed comparison of the argument fields]"
    "  3. Key Concepts Similarity: [Provide your detailed comparison of the 'key_concepts' fields]"
    "  4. Logical Flow Similarity: [Provide your detailed comparison of the 'logical_structure_flow' fields]"
    "\n\n"
    "Answer in Korean."
)
JSON_KEYS = [
    "assignment_type", "core_thesis", "primary_argument_1",
    "primary_argument_2", "logical_structure_flow",
    "key_concepts", "conclusion_implication"
] # (step_4 코드 기반)

# ----------------------------------------------------
# --- 2. 헬퍼 함수 정의 (내부용) ---
# ----------------------------------------------------

def _analyze_text_with_llm(raw_text):
    """(1단계 분석용) Pro 모델로 텍스트를 JSON 구조로 분석합니다."""
    # (Colab step_3 코드의 analyze_text_with_llm 함수)
    if not llm_client_pro: return None
    config = genai_types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=JSON_SCHEMA,
    )
    prompt_content = JSON_SYSTEM_PROMPT + f"\n\nTarget Text: \n\n{raw_text[:10000]}..."
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(contents=[prompt_content], config=config)
            if not response.text: raise Exception("Empty response (Pro)")
            return json.loads(response.text)
        except Exception as e:
            if attempt < MAX_RETRIES - 1: sleep(2**attempt)
            else: print(f"[Service 3 Summary] Final Error: {e}")
    return None

def _get_embedding_vector_st(text):
    """(2단계 임베딩용) S-BERT로 텍스트를 임베딩합니다."""
    # (Colab step_3 코드의 get_embedding_vector_st 함수, 모델 인자 제거)
    if not text or not embedding_model: return None
    try: return embedding_model.encode(text)
    except Exception as e: print(f"[Service 3 Embedding] Error: {e}"); return None

def _compare_json_with_llm(submission_json_str, candidate_json_str):
    """(3단계 비교용) Flash 모델로 두 JSON을 1:1 비교합니다."""
    # (Colab step_4 코드의 compare_json_with_llm 함수)
    if not llm_client_flash: return None
    user_prompt = COMPARISON_SYSTEM_PROMPT.format(
        submission_json_str=submission_json_str,
        candidate_json_str=candidate_json_str
    )
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_flash.generate_content(contents=[user_prompt])
            if not response.text: raise Exception("Empty response (Flash)")
            return response.text
        except Exception as e:
            if attempt < MAX_RETRIES - 1: sleep(2**attempt)
            else: print(f"[Service 3 Compare] Final Error: {e}")
    return None

# ----------------------------------------------------
# --- 3. 메인 서비스 함수 (app.py에서 호출) ---
# ----------------------------------------------------

def perform_full_analysis_and_comparison(raw_text, original_filename="new_submission.txt"):
    """
    Flask 서비스용 메인 함수 (1, 2, 3단계 통합)
    1. (LLM Pro) 텍스트 분석
    2. (S-BERT) 분석 결과 임베딩 및 유사 후보 검색
    3. (LLM Flash) 상위 후보 1:1 정밀 비교
    """
    
    # 0. 모델 및 DB 로드 확인
    if not llm_client_pro or not embedding_model or db_vectors is None or analysis_db_dict is None:
        print("[Service 3] CRITICAL: Service dependencies (LLM, S-BERT, DB) not loaded.")
        return None

    # --- 1단계: (LLM Pro) 새 텍스트 분석 (step_3) ---
    print("[Service 3] Starting Step 1: LLM Summary (Pro)...")
    submission_analysis_json = _analyze_text_with_llm(raw_text)
    if not submission_analysis_json:
        print("[Service 3] Step 1 FAILED."); return None
    print("[Service 3] Step 1 Successful.")

    # --- 2단계: (S-BERT) 임베딩 및 유사도 검색 (step_3) ---
    print("[Service 3] Starting Step 2: S-BERT Similarity Search...")
    embedding_text = ". ".join([str(submission_analysis_json.get(key, "")) for key in EMBEDDING_KEYS])
    if not embedding_text:
        print("[Service 3] Step 2 FAILED (No key_concepts)."); return None

    submission_vector_np = _get_embedding_vector_st(embedding_text)
    if submission_vector_np is None:
        print("[Service 3] Step 2 FAILED (Embedding error)."); return None

    # DB 1 (S-BERT DB)을 상대로 유사도 검색
    submission_vector_2d = submission_vector_np.reshape(1, -1)
    similarities = cosine_similarity(submission_vector_2d, db_vectors)[0]
    similar_indices = np.argsort(similarities)[-10:][::-1] 

    sbert_top_5_candidates = []
    for i in similar_indices:
        if db_filenames[i] == original_filename: continue
        candidate_info = { "file": db_filenames[i], "sbert_similarity": float(similarities[i]) }
        sbert_top_5_candidates.append(candidate_info)
        if len(sbert_top_5_candidates) >= 5: break
    
    print(f"[Service 3] Step 2 Successful. Found {len(sbert_top_5_candidates)} candidates.")

    # --- 3단계: (LLM Flash) 1:1 정밀 비교 (step_4) ---
    print("[Service 3] Starting Step 3: LLM 1:1 Comparison (Flash)...")
    
    submission_compare_json = {key: submission_analysis_json.get(key, "N/A") for key in JSON_KEYS}
    submission_json_str = json.dumps(submission_compare_json, ensure_ascii=False, indent=2)

    llm_comparison_results = []
    
    for candidate in sbert_top_5_candidates:
        candidate_file = candidate['file']
        print(f"  -> Comparing with: {candidate_file}")
        
        # ⭐️ 핵심 (수정됨): 동일한 DB(analysis_db_dict)에서 후보 파일의 원본 JSON 조회
        candidate_full_data = analysis_db_dict.get(candidate_file) 
        
        if not candidate_full_data:
            print(f"  -> WARNING: Full analysis data not found for {candidate_file} in Main DB.")
            continue
            
        candidate_analysis_json = {key: candidate_full_data.get(key, "N/A") for key in JSON_KEYS}
        candidate_json_str = json.dumps(candidate_json_json, ensure_ascii=False, indent=2)

        # LLM (Flash) 비교 호출
        llm_report_text = _compare_json_with_llm(submission_json_str, candidate_json_str)
        
        if llm_report_text:
            llm_comparison_results.append({
                "file": candidate_file,
                "sbert_similarity": candidate['sbert_similarity'],
                "llm_comparison_report": llm_report_text
            })
        else:
            print(f"  -> WARNING: LLM (Flash) comparison failed for {candidate_file}.")
        
        sleep(1) # API 속도 조절

    print(f"[Service 3] Step 3 Successful. Compared {len(llm_comparison_results)} candidates.")

    # 4. 결과 취합하여 반환
    return {
        "submission_summary": submission_analysis_json,
        "llm_comparison_results": llm_comparison_results
    }
