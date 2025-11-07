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

# app.py가 로드할 .env 또는 config.py를 통해 API 키를 가져옴
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# [모델 설정]
SUMMARY_MODEL_NAME = 'gemini-2.5-pro' # 1단계 요약용 (Pro)
COMPARISON_MODEL_NAME = 'gemini-2.5-pro' # 3단계 비교용 (Pro)
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2' # 2단계 S-BERT용

# LLM 클라이언트
llm_client_pro = None
llm_client_flash = None
embedding_model = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        
        # 1. 요약용 Pro 모델 로드
        llm_client_pro = genai.GenerativeModel(SUMMARY_MODEL_NAME)
        print(f"[Service 3] LLM Model (Summary) '{SUMMARY_MODEL_NAME}' loaded.")
        
        # 2. 비교용 Flash 모델 로드
        llm_client_flash = genai.GenerativeModel(COMPARISON_MODEL_NAME)
        print(f"[Service 3] LLM Model (Compare) '{COMPARISON_MODEL_NAME}' loaded.")
        
    except Exception as e:
        print(f"[Service 3] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service 3] WARNING: GEMINI_API_KEY not found. LLM Analysis will fail.")

# 3. 임베딩 모델 (S-BERT) 로드
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service 3] Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load SentenceTransformer model: {e}")


# [DB 경로 설정]
# (경로 예시: backend/data/...)
BASE_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

# 4. DB 1 (임베딩 DB) 로드 - S-BERT 유사도 검색용
EMBEDDING_DB_FILE = os.path.join(BASE_DATA_DIR, 'final_with_embeddings.csv')
df_db_vectors = None
db_vectors = None
db_filenames = None

try:
    if os.path.exists(EMBEDDING_DB_FILE):
        df_db_vectors = pd.read_csv(EMBEDDING_DB_FILE)
        db_vectors = np.array([json.loads(v) for v in df_db_vectors['embedding_vector']])
        db_filenames = df_db_vectors['source_file'].tolist()
        print(f"[Service 3] Embedding DB (S-BERT) loaded ({len(df_db_vectors)} items).")
    else:
        print(f"[Service 3] WARNING: Embedding DB (S-BERT) not found at {EMBEDDING_DB_FILE}")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load Embedding DB (S-BERT): {e}")

# 5. DB 2 (전체 분석 DB) 로드 - LLM 정밀 비교용
ANALYSIS_DB_FILE = os.path.join(BASE_DATA_DIR, 'dummy_writing_assignments.csv')
analysis_db_dict = None

try:
    if os.path.exists(ANALYSIS_DB_FILE):
        df_db_analysis = pd.read_csv(ANALYSIS_DB_FILE)
        # Colab 코드와 동일하게 중복 제거
        df_db_analysis = df_db_analysis.drop_duplicates(subset=['source_file'], keep='last')
        analysis_db_dict = df_db_analysis.set_index('source_file').to_dict('index')
        print(f"[Service 3] Full Analysis DB (LLM Compare) loaded ({len(analysis_db_dict)} items).")
    else:
        print(f"[Service 3] WARNING: Full Analysis DB (LLM Compare) not found at {ANALYSIS_DB_FILE}")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load Full Analysis DB (LLM Compare): {e}")


MAX_RETRIES = 3

# [프롬프트 및 스키마 (1단계 요약용)]
JSON_SYSTEM_PROMPT = (
    "You are an expert academic text analyst. Your task is to thoroughly read the provided text and "
    "generate a structured summary in JSON format. "
    "You **must** write your answers in **full, natural-language sentences** in Korean. "
    # ... (Colab 코드와 동일한 프롬프트 내용) ...
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
EMBEDDING_KEYS = ['key_concepts']
JSON_KEYS = [
    "assignment_type", "core_thesis", "primary_argument_1",
    "primary_argument_2", "logical_structure_flow",
    "key_concepts", "conclusion_implication"
]

# [프롬프트 (3단계 비교용)]
COMPARISON_SYSTEM_PROMPT = (
    "You are an expert evaluator comparing two structured analysis reports (JSON format) derived from academic essays. "
    "Your task is to assess the *logical and conceptual similarity* between the 'Submission' report and the 'Candidate' report. "
    # ... (Colab 코드와 동일한 프롬프트 내용) ...
    "Answer in Korean."
)

# ----------------------------------------------------
# --- 2. 헬퍼 함수 정의 (내부용) ---
# ----------------------------------------------------

def _analyze_text_with_llm(raw_text):
    """(1단계 분석용) Pro 모델로 텍스트를 JSON 구조로 분석합니다."""
    if not raw_text or not llm_client_pro:
        print("   -> [Service 3] Error: LLM client (Pro) not initialized.")
        return None

    config = genai_types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=JSON_SCHEMA,
    )
    prompt_content = JSON_SYSTEM_PROMPT + f"\n\nTarget Text: \n\n{raw_text[:10000]}..."

    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(
                contents=[prompt_content],
                config=config
            )
            if not response.text:
                raise Exception("Empty response from LLM (Pro)")
            return json.loads(response.text)
        except Exception as e:
            error_message = str(e)
            if '503' in error_message or '429' in error_message or '500' in error_message:
                if attempt < MAX_RETRIES - 1:
                    sleep_time = 2 ** attempt + 1
                    print(f"   -> [Service 3 Summary] API Error. Retrying...")
                    sleep(sleep_time)
                    continue
            print(f"   -> [Service 3 Summary] Final Error: {e}")
            return None
    return None

def _get_embedding_vector_st(text):
    """(2단계 임베딩용) S-BERT로 텍스트를 임베딩합니다."""
    if not text or not embedding_model:
        return None
    try:
        return embedding_model.encode(text)
    except Exception as e:
        print(f"   -> [Service 3 Embedding] Error: {e}")
        return None

def _compare_json_with_llm(submission_json_str, candidate_json_str):
    """(3단계 비교용) Flash 모델로 두 JSON을 1:1 비교합니다."""
    if not llm_client_flash:
        print("   -> [Service 3] Error: LLM client (Flash) not initialized.")
        return None

    user_prompt = COMPARISON_SYSTEM_PROMPT.format(
        submission_json_str=submission_json_str,
        candidate_json_str=candidate_json_str
    )

    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_flash.generate_content(
                contents=[user_prompt]
            )
            if not response.text:
                raise Exception("Empty response from LLM (Flash)")
            return response.text
        except Exception as e:
            error_message = str(e)
            if '503' in error_message or '429' in error_message or '500' in error_message:
                if attempt < MAX_RETRIES - 1:
                    sleep_time = 2 ** attempt + 1
                    print(f"   -> [Service 3 Compare] API Error. Retrying...")
                    sleep(sleep_time)
                    continue
            print(f"   -> [Service 3 Compare] Final Error: {e}")
            return None
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
    if not llm_client_pro or not llm_client_flash or not embedding_model or db_vectors is None or analysis_db_dict is None:
        print("[Service 3] CRITICAL: Service dependencies (LLMs, S-BERT, DBs) not fully loaded.")
        return None

    # --- 1단계: (LLM Pro) 새 텍스트 분석 ---
    print("[Service 3] Starting Step 1: LLM Summary (Pro)...")
    submission_analysis_json = _analyze_text_with_llm(raw_text)
    
    if not submission_analysis_json:
        print("[Service 3] Step 1 FAILED.")
        return None
    print("[Service 3] Step 1 Successful.")

    # --- 2단계: (S-BERT) 임베딩 및 유사도 검색 ---
    print("[Service 3] Starting Step 2: S-BERT Similarity Search...")
    embedding_text = ". ".join(
        [str(submission_analysis_json.get(key, "")) for key in EMBEDDING_KEYS]
    )
    if not embedding_text:
        print("[Service 3] Step 2 FAILED (No key_concepts found for embedding).")
        return None

    submission_vector_np = _get_embedding_vector_st(embedding_text)
    if submission_vector_np is None:
        print("[Service 3] Step 2 FAILED (Embedding generation error).")
        return None

    # S-BERT 유사도 검색
    submission_vector_2d = submission_vector_np.reshape(1, -1)
    similarities = cosine_similarity(submission_vector_2d, db_vectors)[0]
    similar_indices = np.argsort(similarities)[-10:][::-1] 

    sbert_top_5_candidates = []
    for i in similar_indices:
        if db_filenames[i] == original_filename:
            continue
        
        candidate_info = {
            "file": db_filenames[i],
            "sbert_similarity": float(similarities[i]),
        }
        sbert_top_5_candidates.append(candidate_info)
        if len(sbert_top_5_candidates) >= 5:
            break
    
    print(f"[Service 3] Step 2 Successful. Found {len(sbert_top_5_candidates)} candidates.")

    # --- 3단계: (LLM Flash) 1:1 정밀 비교 ---
    print("[Service 3] Starting Step 3: LLM 1:1 Comparison (Flash)...")
    
    # 비교 기준이 될 제출물 JSON (필요한 키만 필터링)
    submission_compare_json = {
        key: submission_analysis_json.get(key, "N/A") for key in JSON_KEYS
    }
    submission_json_str = json.dumps(submission_compare_json, ensure_ascii=False, indent=2)

    llm_comparison_results = []
    
    for candidate in sbert_top_5_candidates:
        candidate_file = candidate['file']
        print(f"  -> Comparing with: {candidate_file}")
        
        # DB 2에서 후보 파일의 원본 JSON 조회
        candidate_full_data = analysis_db_dict.get(candidate_file)
        if not candidate_full_data:
            print(f"  -> WARNING: Full analysis data not found for {candidate_file} in DB 2.")
            continue
            
        # 비교 대상 JSON (필요한 키만 필터링)
        candidate_analysis_json = {
            key: candidate_full_data.get(key, "N/A") for key in JSON_KEYS
        }
        candidate_json_str = json.dumps(candidate_analysis_json, ensure_ascii=False, indent=2)

        # LLM (Flash) 비교 호출
        llm_report_text = _compare_json_with_llm(
            submission_json_str,
            candidate_json_str
        )
        
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
        # sbert_top_5_candidates는 llm_comparison_results에 통합됨
    }
