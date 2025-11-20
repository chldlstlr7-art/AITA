import os
import json
import re
import ast
import requests  # [추가] API 호출용
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import sleep
import traceback
from extensions import db
from models import AnalysisReport
from concurrent.futures import ThreadPoolExecutor, as_completed
from tenacity import retry, stop_after_attempt, wait_exponential

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

# [네이버 API 설정]
NAVER_CLOVA_URL = os.environ.get('NAVER_CLOVA_URL2') # 예: https://clovastudio.stream...
NAVER_API_KEY = os.environ.get('NAVER_API_KEY')     # 예: nv-... (Bearer Token)

MAX_RETRIES = 3

# [모델 설정] - S-BERT (로컬 임베딩 모델 유지)
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'

if NAVER_CLOVA_URL and NAVER_API_KEY:
    print("[Service Analysis] Naver HyperCLOVA X Configured.")
else:
    print("[Service Analysis] WARNING: NAVER API Keys not found. LLM Analysis will fail.")

# [S-BERT 모델 로드]
embedding_model = None
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service Analysis] Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service Analysis] CRITICAL: Failed to load SentenceTransformer model: {e}")

# ----------------------------------------------------
# --- 2. 헬퍼 함수 정의 (내부용) ---
# ----------------------------------------------------

def _call_naver_api(messages, max_tokens=4096, temperature=0.5):
    """
    [공통] Naver HyperCLOVA X API 호출 함수
    """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY:
        return None

    headers = {
        'Authorization': f'Bearer {NAVER_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json'
    }

    data = {
        "messages": messages,
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": max_tokens,
        "temperature": temperature,
        "repeatPenalty": 1.5,
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }

    try:
        response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
        response.raise_for_status()
        
        res_json = response.json()
        content = res_json.get('result', {}).get('message', {}).get('content', '')
        return content

    except Exception as e:
        print(f"[Naver API Error] {e}")
        raise e # Tenacity가 잡을 수 있게 예외를 다시 던짐


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _llm_call_analysis(raw_text, system_prompt):
    """(1단계 분석용) Naver 모델로 텍스트를 JSON 구조로 분석합니다."""
    
    # 시스템 프롬프트와 사용자 입력 결합
    # (네이버는 system role을 지원하므로 분리해서 보냄)
    messages = [
        {
            "role": "system",
            "content": f"{system_prompt}\n\n결과는 반드시 유효한 JSON 포맷으로만 출력해."
        },
        {
            "role": "user",
            "content": f"Target Text:\n{raw_text[:10000]}..."
        }
    ]

    try:
        # JSON 파싱을 위해 temperature를 낮게 설정
        content_text = _call_naver_api(messages, max_tokens=4096, temperature=0.1)
        
        if not content_text:
            raise Exception("Empty response from Naver API")

        # --- [JSON 파싱 로직 강화] ---
        json_str = ""
        match = re.search(r"```json\s*([\s\S]+?)\s*```", content_text)
        if match:
            json_str = match.group(1)
        else:
            json_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content_text.strip())
            json_str = json_match.group(1) if json_match else content_text.strip()

        # 3단계 파싱 시도
        try:
            return json.loads(json_str, strict=False)
        except json.JSONDecodeError:
            pass
        try:
            return ast.literal_eval(json_str)
        except:
            pass
        try:
            json_str_clean = json_str.replace('\n', '\\n').replace('\r', '')
            return json.loads(json_str_clean, strict=False)
        except:
            pass
            
        print(f"[Service Analysis] LLM_ANALYSIS_FAILED: JSON 파싱 실패. Raw: {content_text[:200]}...")
        raise Exception("JSON parsing failed.")

    except Exception as e:
        print(f"[Service Analysis] LLM Call Error: {e}")
        raise e


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
def _llm_call_comparison(submission_json_str, candidate_json_str, system_prompt_template):
    """(3단계 비교용) Naver 모델로 두 JSON을 1:1 비교합니다."""
    
    # 프롬프트 완성
    full_user_prompt = system_prompt_template.format(
        submission_json_str=submission_json_str,
        candidate_json_str=candidate_json_str
    )

    messages = [
        {
            "role": "system",
            "content": "너는 공정한 평가자야. 두 문서의 요약을 비교하고 유사도 점수를 측정해."
        },
        {
            "role": "user",
            "content": full_user_prompt
        }
    ]

    try:
        # 비교 리포트는 텍스트 형식이므로 파싱 불필요, Temperature 0.5 유지
        content_text = _call_naver_api(messages, max_tokens=2000, temperature=0.5)
        
        if not content_text:
            raise Exception("Empty response from Naver API (Comparison)")
            
        return content_text

    except Exception as e:
        print(f"[Service Analysis] Comparison Call Error: {e}")
        raise e

def get_embedding_vector(text):
    """[신규] 텍스트를 받아 임베딩 벡터(list)를 반환합니다. (S-BERT 사용)"""
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

    if len(db_vectors_thesis_list) == 0:
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
    [신규] 1단계: Naver LLM 분석 및 임베딩 생성
    """
    
    # 0. 모델 로드 확인
    if not NAVER_API_KEY or not embedding_model:
        print("[Service Analysis] CRITICAL: Service dependencies (Naver API, S-BERT) not loaded.")
        raise Exception("LLM or Embedding model not loaded.")
    
    print(f"[{report_id}] Starting Step 1: Analysis and Embedding...")
    
    # --- 1단계: LLM 분석 (Naver) ---
    submission_analysis_json = _llm_call_analysis(
        raw_text=text,
        system_prompt=json_prompt_template
    )
    if not submission_analysis_json:
        raise Exception("LLM_ANALYSIS_FAILED: 분석 결과가 없습니다.")
    print(f"[{report_id}] 1. Naver LLM 분석 성공.") 
    
    # --- 2단계: 2개의 임베딩 생성 (S-BERT 유지) ---
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
    [신규] 2단계: 유사 문서 검색 및 Naver LLM 정밀 비교
    """

    if not NAVER_API_KEY:
        print("[Service Analysis] CRITICAL: Naver API Key not loaded.")
        raise Exception("Naver API not loaded.")

    print(f"[{report_id}] Starting Step 2: Comparison...")

    # --- 3단계: 유사 문서 검색 (DB 쿼리) ---
    print(f"[{report_id}] 3. 유사 문서 검색 (가중합 0.6:0.4) 시작...")
    candidate_docs = find_similar_documents(
        report_id, 
        embedding_thesis, 
        embedding_claim, 
        top_n=3
    )

    # --- 4단계: 후보 문서와 LLM 정밀 비교 (병렬 처리) ---
    print(f"[{report_id}] 4. Naver LLM 정밀 비교 (후보 {len(candidate_docs)}개) 시작...")
    comparison_results_list = []

    def compare_with_candidate(candidate):
        try:
            candidate_id = candidate["candidate_id"]
            candidate_summary_str = candidate["candidate_summary_json_str"]
            candidate_filename = candidate["candidate_filename"]
            print(f"  -> Comparing with: {candidate_id}")

            # LLM 비교 호출 (Naver)
            comparison_report_text = _llm_call_comparison(
                submission_json_str, 
                candidate_summary_str,
                comparison_prompt_template
            )

            if comparison_report_text:
                return {
                    "candidate_id": candidate_id,
                    "candidate_filename": candidate_filename,
                    "weighted_similarity": candidate['weighted_similarity'],
                    "llm_comparison_report": comparison_report_text 
                }
            else:
                print(f"  -> WARNING: LLM (Comparison) failed for {candidate_id}.")
                return None

        except Exception as e:
            print(f"[{report_id}] 4. 후보 {candidate['candidate_id']} 비교 중 오류: {e}")
            return None

    # 병렬 처리 실행 (Requests 모듈은 Thread-safe)
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_candidate = {executor.submit(compare_with_candidate, candidate): candidate for candidate in candidate_docs}
        for future in as_completed(future_to_candidate):
            result = future.result()
            if result:
                comparison_results_list.append(result)

    print(f"[{report_id}] Step 2 (Comparison) 완료. 비교 결과 반환.")
    return comparison_results_list


def _parse_comparison_scores(report_text):
    # 1. 점수 컨테이너 초기화
    scores = {
        "Core Thesis Similarity": 0, 
        "Problem Framing Similarity": 0, 
        "Claim Similarity": 0,
        "Reasoning Similarity": 0, 
        "Flow Pattern Similarity": 0, 
        "Conclusion Framing Similarity": 0,
    }
    
    parsed_count = 0
    
    try:
        # 2. 파싱 로직 (강력한 Regex 적용)
        for key_name in scores.keys():
            pattern = rf"{re.escape(key_name)}.*?:\s*[\s\*]*(\d+)"
            match = re.search(pattern, report_text, re.IGNORECASE)
            if match:
                score = int(match.group(1))
                scores[key_name] = score
                parsed_count += 1
            else:
                # print(f"[_parse_comparison_scores] Warning: Could not find score for '{key_name}'")
                pass

        # 3. 가중치 적용하여 총점 계산 (Reasoning * 2)
        final_score = sum(scores.values()) + scores["Reasoning Similarity"]

    except Exception as e:
        print(f"[_parse_comparison_scores] Parsing Error: {e}")
        return 0, scores
    
    return final_score, scores


def _filter_high_similarity_reports(comparison_results_list):
    high_similarity_reports = []
    threshold = 50
    for result in comparison_results_list:
        report_text = result.get("llm_comparison_report", "")
        total_score, scores_dict,  = _parse_comparison_scores(report_text)
        if total_score >= threshold:
            result['plagiarism_score'] = total_score
            result['scores_detail'] = scores_dict
            high_similarity_reports.append(result)
    return high_similarity_reports