import os
import json
import pandas as pd
import numpy as np
from google import genai
from google.genai import types
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import sleep

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델/DB 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

# app.py가 로드할 .env 또는 config.py를 통해 API 키를 가져옴
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# LLM 클라이언트 (1단계 분석용)
llm_client = None
if GEMINI_API_KEY:
    try:
        llm_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[Service 3] Gemini Client (Sync) loaded.")
    except Exception as e:
        print(f"[Service 3] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service 3] WARNING: GEMINI_API_KEY not found. LLM Analysis will fail.")

MAX_RETRIES = 3

# 임베딩 모델 (3단계 임베딩용)
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
embedding_model = None
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service 3] Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load SentenceTransformer model: {e}")

# RAG 임베딩 DB 로드
# (경로 예시: backend/data/final_with_embeddings.csv)
# 이 경로는 config.py 또는 .env를 통해 관리하는 것이 가장 좋습니다.
DB_FILE_PATH = os.path.join(
    os.path.dirname(__file__),  # 현재 services 디렉토리
    '..',                       # backend/
    'data',                     # backend/data/
    'final_with_embeddings.csv' # DB 파일
)

df_db = None
db_vectors = None
db_filenames = None

try:
    if os.path.exists(DB_FILE_PATH):
        df_db = pd.read_csv(DB_FILE_PATH)
        # Colab 코드와 동일하게, DB에 저장된 JSON 문자열 리스트를 numpy 배열로 변환
        db_vectors = np.array([json.loads(v) for v in df_db['embedding_vector']])
        db_filenames = df_db['source_file'].tolist()
        print(f"[Service 3] Embedding DB loaded ({len(df_db)} items) from {DB_FILE_PATH}")
    else:
        print(f"[Service 3] WARNING: Embedding DB not found at {DB_FILE_PATH}")
except Exception as e:
    print(f"[Service 3] CRITICAL: Failed to load Embedding DB: {e}")


# [LLM 프롬프트 및 스키마 (Colab 코드와 동일)]
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

JSON_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "assignment_type": types.Schema(type=types.Type.STRING),
        "core_thesis": types.Schema(type=types.Type.STRING),
        "primary_argument_1": types.Schema(type=types.Type.STRING),
        "primary_argument_2": types.Schema(type=types.Type.STRING),
        "logical_structure_flow": types.Schema(type=types.Type.STRING),
        "key_concepts": types.Schema(type=types.Type.STRING),
        "conclusion_implication": types.Schema(type=types.Type.STRING),
    }
)
EMBEDDING_KEYS = ['key_concepts']

# ----------------------------------------------------
# --- 2. 헬퍼 함수 정의 (내부용) ---
# ----------------------------------------------------

def _analyze_text_with_llm(raw_text):
    """(1단계 분석용) 텍스트를 JSON 구조로 분석합니다. (동기식)"""
    if not raw_text or not llm_client:
        print("   -> [Service 3] Error: LLM client not initialized.")
        return None

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=JSON_SCHEMA,
    )
    
    # LLM이 텍스트를 보고 'assignment_type'을 스스로 추론하도록 함
    prompt_content = JSON_SYSTEM_PROMPT + f"\n\nTarget Text: \n\n{raw_text[:10000]}..."

    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client.models.generate_content(
                model='gemini-2.5-pro', # 또는 config.py에서 모델명 관리
                contents=[prompt_content],
                config=config
            )
            if not response.text:
                if attempt < MAX_RETRIES - 1:
                    sleep_time = 2 ** attempt
                    print(f"   -> [Service 3 Attempt {attempt + 1}] Response empty. Retrying...")
                    sleep(sleep_time)
                    continue
                return None
            return json.loads(response.text)
        except (json.JSONDecodeError, Exception) as e:
            error_message = str(e)
            if '503 UNAVAILABLE' in error_message or '429' in error_message:
                if attempt < MAX_RETRIES - 1:
                    sleep_time = 2 ** attempt + 1
                    print(f"   -> [Service 3 Attempt {attempt + 1}] API Error (503/429). Retrying...")
                    sleep(sleep_time)
                    continue
            print(f"   -> [Service 3 Attempt {attempt + 1}] Final Error: {e}")
            return None
    return None

def _get_embedding_vector_st(text):
    """sentence-transformer 모델을 사용해 텍스트를 임베딩 벡터로 변환합니다."""
    if not text or not embedding_model:
        return None
    try:
        vector = embedding_model.encode(text)
        return vector  # numpy.ndarray 반환
    except Exception as e:
        print(f"   -> [Service 3] Embedding Error: {e}")
        return None

# ----------------------------------------------------
# --- 3. 메인 서비스 함수 (app.py에서 호출) ---
# ----------------------------------------------------

def perform_analysis_and_find_similar(raw_text, original_filename="new_submission.txt"):
    """
    Flask 서비스용 메인 함수.
    텍스트를 LLM으로 분석하고, 그 결과를 임베딩하여 유사 문서를 검색합니다.
    
    Args:
        raw_text (str): 원본 텍스트
        original_filename (str): DB와 비교 시 자기 자신을 제외하기 위한 파일명

    Returns:
        dict: {
            "analysis_json": (LLM 분석 결과),
            "top_5_candidates": (유사 후보 5개 리스트)
        }
        또는 오류 시 None
    """
    
    # 0. 모델 및 DB 로드 확인 (앱 시작 시 로드 실패했을 경우)
    if not llm_client or not embedding_model or db_vectors is None:
        print("[Service 3] CRITICAL: Service dependencies (LLM, S-BERT, DB) not loaded.")
        return None

    # 1. (1단계) LLM으로 텍스트 분석
    print("[Service 3] Starting LLM analysis...")
    analysis_json = _analyze_text_with_llm(raw_text)
    
    if not analysis_json:
        print("[Service 3] LLM analysis failed.")
        return None
    print("[Service 3] LLM analysis successful.")

    # 2. (3단계) 분석 결과를 임베딩 (Colab 로직: key_concepts 사용)
    print("[Service 3] Starting embedding generation...")
    embedding_text_parts = []
    for key in EMBEDDING_KEYS:
        if key in analysis_json:
            embedding_text_parts.append(str(analysis_json[key]))
    
    embedding_text = ". ".join(embedding_text_parts)
    if not embedding_text:
        print("[Service 3] Embedding generation failed (No key_concepts found).")
        return None

    submission_vector_np = _get_embedding_vector_st(embedding_text)

    if submission_vector_np is None:
        print("[Service 3] Embedding generation failed (Model error).")
        return None
    print("[Service 3] Embedding generation successful.")

    # 3. (3단계) 유사도 검색
    print("[Service 3] Starting similarity search...")
    submission_vector_2d = submission_vector_np.reshape(1, -1)
    similarities = cosine_similarity(submission_vector_2d, db_vectors)[0]

    # 상위 10개 인덱스 (내림차순 정렬)
    similar_indices = np.argsort(similarities)[-10:][::-1] 

    top_5_candidates = []
    for i in similar_indices:
        # DB에 저장된 파일명과 비교하여 자기 자신 제외
        if db_filenames[i] == original_filename:
            continue
        
        candidate_info = {
            "file": db_filenames[i],
            "similarity": float(similarities[i]),
            # (필요시) DB의 다른 정보도 추가
            # "summary": df_db.loc[i, 'core_thesis'] 
        }
        top_5_candidates.append(candidate_info)

        if len(top_5_candidates) >= 5:
            break
    
    print(f"[Service 3] Similarity search complete. Found {len(top_5_candidates)} candidates.")

    # 4. 결과 취합하여 반환
    return {
        "analysis_json": analysis_json,
        "top_5_candidates": top_5_candidates
    }
