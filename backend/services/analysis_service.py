import os
import json
import re
import numpy as np
import google.generativeai as genai
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import sleep
import traceback # 1단계 오류 핸들링을 위해 추가

from extensions import db
from models import AnalysisReport

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
MAX_RETRIES = 3

# [모델 설정]
ANALYSIS_MODEL_NAME = 'gemini-2.5-flash' # 1단계 분석/요약용
COMPARISON_MODEL_NAME = 'gemini-2.5-flash' # 3단계 비교용
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2' # 2단계 S-BERT용

# [LLM 클라이언트]
llm_client_analysis = None
llm_client_comparison = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client_analysis = genai.GenerativeModel(ANALYSIS_MODEL_NAME)
        llm_client_comparison = genai.GenerativeModel(COMPARISON_MODEL_NAME)
        print(f"[Service Analysis] LLM Models ({ANALYSIS_MODEL_NAME}, {COMPARISON_MODEL_NAME}) loaded.")
    except Exception as e:
        print(f"[Service Analysis] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service Analysis] WARNING: GEMINI_API_KEY not found. LLM Analysis will fail.")

# [S-BERT 모델]
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service Analysis] Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service Analysis] CRITICAL: Failed to load SentenceTransformer model: {e}")
    embedding_model = None

# [DB 설정]
print("[Service Analysis] Ready. (DB will be accessed via Flask context)")

# ----------------------------------------------------
# --- 2. 헬퍼 함수 정의 (내부용) ---
# ----------------------------------------------------

def _llm_call_analysis(raw_text, system_prompt):
    """(1단계 분석용) Gemini 모델로 텍스트를 JSON 구조로 분석합니다."""
    if not llm_client_analysis: return None
    
    config = genai.GenerationConfig(response_mime_type="text/plain") 
    
    prompt_content = f"{system_prompt}\n\nTarget Text: \n\n{raw_text[:10000]}..."
    
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_analysis.generate_content(
                contents=[prompt_content], 
                generation_config=config
            )
            if not response.text: raise Exception("Empty response (Analysis)")
            
            match = re.search(r"```json\s*([\s\S]+?)\s*```", response.text)
            if not match:
                print(f"[Service Analysis] LLM_ANALYSIS_FAILED: JSON 형식 응답을 찾지 못했습니다. Raw: {response.text[:200]}...")
                raise Exception("JSON format not found in LLM response.")
            
            return json.loads(match.group(1)) # 딕셔너리 반환
        
        except Exception as e:
            print(f"[Service Analysis] LLM Call Error (Attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1: sleep(2**attempt)
            else: print(f"[Service Analysis] Final Error (Analysis): {e}")
    return None

def _llm_call_comparison(submission_json_str, candidate_json_str, system_prompt_template):
    """(3단계 비교용) Gemini 모델로 두 JSON을 1:1 비교합니다."""
    if not llm_client_comparison: return None
    
    user_prompt = system_prompt_template.format(
        submission_json_str=submission_json_str,
        candidate_json_str=candidate_json_str
    )
    
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_comparison.generate_content(contents=[user_prompt])
            if not response.text: raise Exception("Empty response (Comparison)")
            return response.text # 6개 항목 점수 텍스트 반환
        
        except Exception as e:
            print(f"[Service Analysis] LLM Call Error (Attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1: sleep(2**attempt)
            else: print(f"[Service Analysis] Final Error (Comparison): {e}")
    return None

def get_embedding_vector(text):
    """[신규] 텍스트를 받아 임베딩 벡터(list)를 반환합니다."""
    if not embedding_model:
        print("[get_embedding_vector] ERROR: 임베딩 모델이 로드되지 않았습니다.")
        return None
    try:
        vector = embedding_model.encode(text)
        return vector.tolist() # DB 저장을 위해 list로 변환
    except Exception as e:
        print(f"[get_embedding_vector] ERROR: 임베딩 생성 실패: {e}")
        return None

def build_concat_text(key_concepts, main_idea):
    """[신규] 임베딩을 위한 텍스트 조합 (0.6:0.4 로직 기반)"""
    return f"주요 개념: {key_concepts}\n핵심 아이디어: {main_idea}"

def find_similar_documents(submission_id, sub_thesis_vec, sub_claim_vec, top_n=3):
    """
    [Full Code]
    항상 실시간 SQL DB (AnalysisReport)를 쿼리합니다.
    is_test=False인 리포트만 비교 대조군으로 사용합니다.
    """
    
    try:
        sub_thesis_np = np.array(sub_thesis_vec).reshape(1, -1)
        sub_claim_np = np.array(sub_claim_vec).reshape(1, -1)
    except Exception as e:
        print(f"[find_similar_documents] ERROR: 제출된 벡터를 NumPy로 변환 실패: {e}")
        return []
        
    db_ids = []
    db_summaries_json = [] 
    db_vectors_thesis_list = []
    db_vectors_claim_list = []
    db_original_filenames = []

    db_vectors_thesis_np = None
    db_vectors_claim_np = None

    print(f"[find_similar_documents] Using Live DB Query (is_test=False, Excluding ID: {submission_id})")
    try:
        query = AnalysisReport.query.filter(
            AnalysisReport.embedding_keyconcepts_corethesis.isnot(None),
            AnalysisReport.embedding_keyconcepts_claim.isnot(None),
            AnalysisReport.is_test == False
        )
        
        if submission_id:
             query = query.filter(AnalysisReport.id != submission_id)
        
        all_reports = query.all()

        if not all_reports:
            print("[find_similar_documents] 비교할 DB 임베딩이 없습니다. (is_test=False 필터링됨)")
            return []

        for report in all_reports:
            try:
                db_ids.append(report.id)
                db_summaries_json.append(report.summary) 
                db_original_filenames.append(report.original_filename)
                vec_thesis = json.loads(report.embedding_keyconcepts_corethesis)
                vec_claim = json.loads(report.embedding_keyconcepts_claim)
                
                db_vectors_thesis_list.append(vec_thesis)
                db_vectors_claim_list.append(vec_claim)
                
            except Exception as e:
                print(f"[find_similar_documents] Report {report.id} 임베딩/요약 파싱 실패: {e}")
        
        if not db_ids:
            print("[find_similar_documents] 유효한 DB 임베딩이 없습니다.")
            return []

        db_vectors_thesis_np = np.array(db_vectors_thesis_list)
        db_vectors_claim_np = np.array(db_vectors_claim_list)

    except Exception as e:
        print(f"[find_similar_documents] CRITICAL: Live DB 쿼리 중 오류: {e}")
        return []

    if db_vectors_thesis_np is None or db_vectors_claim_np.shape[0] == 0:
        print("[find_similar_documents] DB 벡터가 준비되지 않았거나 비어있습니다.")
        return []
        
    sim_thesis = cosine_similarity(sub_thesis_np, db_vectors_thesis_np)[0]
    sim_claim = cosine_similarity(sub_claim_np, db_vectors_claim_np)[0]

    WEIGHT_THESIS = 0.6
    WEIGHT_CLAIM = 0.4
    sim_weighted = WEIGHT_THESIS * sim_thesis + WEIGHT_CLAIM * sim_claim
    
    weighted_scores = list(enumerate(sim_weighted))
    sorted_scores = sorted(weighted_scores, key=lambda item: item[1], reverse=True)
    
    top_candidates = []
    for index, score in sorted_scores: 
        candidate_id = db_ids[index]
        
        if candidate_id == submission_id:
            continue
            
        candidate_summary_json_str = db_summaries_json[index] 
        candidate_filename = db_original_filenames[index] 
        
        top_candidates.append({
            "candidate_id": candidate_id,
            "weighted_similarity": score,
            "candidate_summary_json_str": candidate_summary_json_str, 
            "candidate_filename": candidate_filename
        })
        
        if len(top_candidates) >= top_n:
            break 

    print(f"[find_similar_documents] 상위 {len(top_candidates)}개 후보 반환 완료.")
    return top_candidates

# ----------------------------------------------------
# --- 3. 메인 서비스 함수 (app.py에서 호출) ---
# ----------------------------------------------------

def perform_step1_analysis_and_embedding(report_id, text, json_prompt_template):
    """
    [신규] 1단계: LLM 분석 및 임베딩 생성
    (app.py의 background_analysis_step1_analysis에서 호출)
    """
    
    # 0. 모델 로드 확인
    if not llm_client_analysis or not embedding_model:
        print("[Service Analysis] CRITICAL: Service dependencies (LLM, S-BERT) not loaded.")
        raise Exception("LLM or Embedding model not loaded.")
    
    print(f"[{report_id}] Starting Step 1: Analysis and Embedding...")
    
    # --- 1단계: LLM 분석 ---
    submission_analysis_json = _llm_call_analysis(
        raw_text=text,
        system_prompt=json_prompt_template
    )
    if not submission_analysis_json:
        raise Exception("LLM_ANALYSIS_FAILED: 분석 결과가 없습니다.")
    print(f"[{report_id}] 1. LLM 분석 성공.") 
    
    # --- 2단계: 2개의 임베딩 생성 (신규 0.6:0.4 로직) ---
    print(f"[{report_id}] 2. 임베딩 생성 시작...")
    try:
        text_for_thesis = build_concat_text(
            submission_analysis_json.get('key_concepts', ''),
            submission_analysis_json.get('Core_Thesis', '')
        )
        text_for_claim = build_concat_text(
            submission_analysis_json.get('key_concepts', ''),
            submission_analysis_json.get('Claim', '')
        )
        embedding_thesis = get_embedding_vector(text_for_thesis) # (list)
        embedding_claim = get_embedding_vector(text_for_claim) # (list)

        if not embedding_thesis or not embedding_claim:
            raise Exception("EMBEDDING_FAILED: 1개 이상의 임베딩 생성에 실패했습니다.")
        print(f"[{report_id}] 2. 임베딩 생성 성공.")
            
    except Exception as e:
        print(f"[{report_id}] 2. 임베딩 생성 실패: {e}")
        raise # 2단계 실패 시 중단

    # --- 3. 1단계 데이터 반환 ---
    analysis_data = {
        'summary_json': submission_analysis_json,      # (dict)
        'embedding_thesis': embedding_thesis,          # (list)
        'embedding_claim': embedding_claim,            # (list)
    }
    
    print(f"[{report_id}] Step 1 (Analysis & Embedding) 완료. 데이터 반환.")
    return analysis_data


def perform_step2_comparison(report_id, embedding_thesis, embedding_claim, submission_json_str, comparison_prompt_template):
    """
    [신규] 2단계: 유사 문서 검색 및 LLM 정밀 비교
    (app.py의 background_analysis_step2_comparison에서 호출)
    """

    if not llm_client_comparison:
        print("[Service Analysis] CRITICAL: Comparison LLM not loaded.")
        raise Exception("Comparison LLM not loaded.")

    print(f"[{report_id}] Starting Step 2: Comparison...")

    # --- 3단계: 유사 문서 검색 (DB 쿼리) ---
    print(f"[{report_id}] 3. 유사 문서 검색 (가중합 0.6:0.4) 시작...")
    candidate_docs = find_similar_documents(
        report_id, 
        embedding_thesis, 
        embedding_claim, 
        top_n=3
    )

    # --- 4단계: 후보 문서와 LLM 정밀 비교 ---
    print(f"[{report_id}] 4. LLM 정밀 비교 (후보 {len(candidate_docs)}개) 시작...")
    comparison_results_list = []
    
    for candidate in candidate_docs:
        try:
            candidate_id = candidate["candidate_id"]
            candidate_summary_str = candidate["candidate_summary_json_str"] # DB의 JSON 문자열
            candidate_filename = candidate["candidate_filename"]
            print(f"  -> Comparing with: {candidate_id}")
            
            # LLM 비교 호출
            comparison_report_text = _llm_call_comparison(
                submission_json_str, 
                candidate_summary_str,
                comparison_prompt_template
            )

            if comparison_report_text:
                comparison_results_list.append({
                    "candidate_id": candidate_id,
                    "candidate_filename" : candidate_filename,
                    "weighted_similarity": candidate['weighted_similarity'],
                    "llm_comparison_report": comparison_report_text # (6개 점수가 포함된 텍스트)
                })
            else:
                 print(f"  -> WARNING: LLM (Comparison) failed for {candidate_id}.")
            
            sleep(1) # API 속도 조절

        except Exception as e:
            print(f"[{report_id}] 4. 후보 {candidate_id} 비교 중 오류: {e}")

    print(f"[{report_id}] Step 2 (Comparison) 완료. 비교 결과 반환.")
    return comparison_results_list # (list of dicts)


# --- (기존 perform_full_analysis_and_comparison 함수는 삭제됨) ---


def _parse_comparison_scores(report_text):
    scores = {
        "Core Thesis": 0, "Problem Framing": 0, "Claim": 0,
        "Reasoning": 0, "Flow Pattern": 0, "Conclusion Framing": 0,
    }
    total_score = 0
    parsed_count = 0
    key_mapping = {
        "Core Thesis": "Core Thesis", "Problem Framing": "Problem Framing",
        "Claim": "Claim", "Reasoning": "Reasoning",
        "Flow Pattern": "Flow Pattern", "Conclusion Framing": "Conclusion Framing",
    }
    try:
        for key_name, mapped_key in key_mapping.items():
            pattern = rf"{re.escape(key_name)}.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]"
            match = re.search(pattern, report_text, re.IGNORECASE | re.DOTALL)
            if match:
                score = int(match.group(1))
                scores[mapped_key] = score
                parsed_count += 1
            else:
                print(f"[_parse_comparison_scores] DEBUG: Failed to parse score for key: '{key_name}'")
        if parsed_count < 6:
            print(f"[_parse_comparison_scores] WARNING: Parsed {parsed_count}/6 scores.")
        scores["Core Thesis"] = scores["Core Thesis"] * 3
        scores["Claim"] = scores["Claim"] * 3
        scores["Reasoning"] = scores["Reasoning"] * 2
        scores["Flow Pattern"] = scores["Flow Pattern"] * 1
        scores["Problem Framing"] = scores["Problem Framing"] * 1
        scores["Conclusion Framing"] = scores["Conclusion Framing"] * 0
        total_score = sum(scores.values())
    except Exception as e:
        print(f"[_parse_comparison_scores] 파싱 중 에러: {e}")
        return 0, scores
    return total_score, scores


def _filter_high_similarity_reports(comparison_results_list):
    high_similarity_reports = []
    threshold = 30
    for result in comparison_results_list:
        report_text = result.get("llm_comparison_report", "")
        total_score, scores_dict = _parse_comparison_scores(report_text)
        if total_score >= threshold:
            result['plagiarism_score'] = total_score
            result['scores_detail'] = scores_dict
            high_similarity_reports.append(result)
    return high_similarity_reports
