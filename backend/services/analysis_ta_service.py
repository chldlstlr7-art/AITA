# analysis_ta_service.py
# (TA의 일괄 처리 및 분석 결과 조회를 위한 서비스)

import os
import json
import re
import numpy as np 
import google.generativeai as genai
import traceback


from sklearn.metrics.pairwise import cosine_similarity
from time import sleep

# [중요] Flask 앱 컨텍스트(db)가 필요합니다.
from extensions import db
from models import AnalysisReport, User

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
MAX_RETRIES = 3

ANALYSIS_MODEL_NAME = 'gemini-2.5-flash'
COMPARISON_MODEL_NAME = 'gemini-2.5-flash'
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'

llm_client_analysis = None
llm_client_comparison = None
embedding_model = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client_analysis = genai.GenerativeModel(ANALYSIS_MODEL_NAME)
        llm_client_comparison = genai.GenerativeModel(COMPARISON_MODEL_NAME)
        print(f"[Service Analysis] TA Service: LLM Models ({ANALYSIS_MODEL_NAME}, {COMPARISON_MODEL_NAME}) loaded.")
    except Exception as e:
        print(f"[Service Analysis] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service Analysis] WARNING: GEMINI_API_KEY not found. LLM Analysis will fail.")

try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service Analysis] TA Service: Embedding Model '{EMBEDDING_MODEL_NAME}' loaded.")
except Exception as e:
    print(f"[Service Analysis] CRITICAL: Failed to load SentenceTransformer model: {e}")

print("[Service Analysis] TA Service Ready. (DB will be accessed via Flask context)")

def _parse_comparison_scores(report_text):
    """
    LLM이 생성한 비교 리포트 텍스트에서 6개 항목의 점수를 파싱하고
    가중합(총점)을 계산합니다.
    """
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
        
        # 가중치 적용
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
    """
    전체 비교 결과 리스트를 받아, 총점이 20점 이상인 리포트만 필터링합니다.
    필터링된 각 항목에 'plagiarism_score'와 'scores_detail' 키를 추가합니다.
    """
    high_similarity_reports = []
    threshold = 20
    
    for result in comparison_results_list:
        report_text = result.get("llm_comparison_report", "")
        total_score, scores_dict = _parse_comparison_scores(report_text)
        
        if total_score >= threshold:
            # 원본 result 딕셔너리(복사본)에 점수 정보를 추가
            # 얕은 복사로 원본 리스트에 영향을 주지 않도록 할 수 있으나,
            # 이 서비스에서는 원본 리스트를 수정해도 무방함 (app.py 로직과 동일하게)
            result['plagiarism_score'] = total_score
            result['scores_detail'] = scores_dict
            high_similarity_reports.append(result)
            
    return high_similarity_reports
# --------------------------------------------------------------------------------------
# --- 2. TA 분석 서비스 클래스 (핵심 로직) ---
# --------------------------------------------------------------------------------------

class AnalysisTAService:
    """
    TA가 리포트 분석을 실행하고 조회하기 위한 핵심 로직을 캡슐화한 클래스.
    모든 모델(LLM, Embedding)이 로드되었다고 가정합니다.
    """

    def __init__(self, json_prompt_template, comparison_prompt_template):
        if not llm_client_analysis or not embedding_model or not llm_client_comparison:
            raise EnvironmentError("[AnalysisTAService] 서비스 모델이 정상적으로 로드되지 않았습니다.")
        
        # API 레이어(app.py 등)로부터 프롬프트 템플릿을 주입받습니다.
        self.json_prompt = json_prompt_template
        self.comparison_prompt = comparison_prompt_template
        print("[AnalysisTAService] Initialized with prompts.")

    
    # --- 기능 1: 요약/개요/주장 추출 (LLM 1단계) ---
    def extract_summary_and_claims(self, raw_text: str) -> dict | None:
        """
        [TA 기능] 원본 텍스트를 받아 LLM을 통해 요약, 개요, 핵심 주장을 JSON(dict)으로 추출합니다.
        (제공된 _llm_call_analysis 헬퍼 사용)
        """
        print(f"Extracting summary... (Text length: {len(raw_text)})")
        if not llm_client_analysis: return None
        
        config = genai.GenerationConfig(response_mime_type="text/plain") 
        prompt_content = f"{self.json_prompt}\n\nTarget Text: \n\n{raw_text[:10000]}..."
        
        for attempt in range(MAX_RETRIES):
            try:
                response = llm_client_analysis.generate_content(
                    contents=[prompt_content], 
                    generation_config=config
                )
                if not response.text: raise Exception("Empty response (Analysis)")
                
                match = re.search(r"```json\s*([\s\S]+?)\s*```", response.text)
                if not match:
                    print(f"[TA Service] LLM_ANALYSIS_FAILED: JSON 형식 응답을 찾지 못했습니다. Raw: {response.text[:200]}...")
                    raise Exception("JSON format not found in LLM response.")
                
                return json.loads(match.group(1)) # 딕셔너리 반환
            
            except Exception as e:
                print(f"[TA Service] LLM Call Error (Attempt {attempt + 1}): {e}")
                if attempt < MAX_RETRIES - 1: sleep(2**attempt)
                else: print(f"[TA Service] Final Error (Analysis): {e}")
        return None

    # --- 기능 2: 임베딩 생성 (S-BERT 2단계) ---
    def _get_embeddings_from_summary(self, summary_json: dict) -> (list | None, list | None):
        """
        [내부 헬퍼] 1단계에서 추출된 요약 dict를 받아 2개의 임베딩 벡터를 생성합니다.
        """
        try:
            text_for_thesis = self._build_concat_text(
                summary_json.get('key_concepts', ''),
                summary_json.get('Core_Thesis', '')
            )
            text_for_claim = self._build_concat_text(
                summary_json.get('key_concepts', ''),
                summary_json.get('Claim', '')
            )
            
            if not embedding_model:
                raise Exception("임베딩 모델이 로드되지 않았습니다.")
                
            vec_thesis = embedding_model.encode(text_for_thesis).tolist()
            vec_claim = embedding_model.encode(text_for_claim).tolist()
            
            if not vec_thesis or not vec_claim:
                raise Exception("임베딩 생성 결과가 비어있습니다.")
                
            return vec_thesis, vec_claim

        except Exception as e:
            print(f"[TA Service] _get_embeddings_from_summary 실패: {e}")
            return None, None
            
    def _build_concat_text(self, key_concepts, main_idea):
        """임베딩을 위한 텍스트 조합"""
        return f"주요 개념: {key_concepts}\n핵심 아이디어: {main_idea}"


    # --- 기능 3: 구조적 유사성 검사 (Vector-Search 3단계) ---
    def find_structural_similarity(self, submission_id: int, emb_thesis: list, emb_claim: list, top_n: int = 5) -> list:
        """
        [TA 기능] 생성된 임베딩을 기반으로 DB에서 구조적으로 유사한 리포트(Top N)를 찾습니다.
        (제공된 find_similar_documents 헬퍼 사용)
        """
        print(f"Finding similar docs for {submission_id} (Top {top_n})...")
        
        # 1. 제출된 벡터를 NumPy 배열로 변환
        try:
            sub_thesis_np = np.array(emb_thesis).reshape(1, -1)
            sub_claim_np = np.array(emb_claim).reshape(1, -1)
        except Exception as e:
            print(f"[TA Service] find_similar: NumPy 변환 실패: {e}")
            return []
            
        db_ids = []
        db_summaries_json = [] # 비교용 요약본 (JSON 문자열)
        db_vectors_thesis_list = []
        db_vectors_claim_list = []

        # 2. DB 쿼리 (is_test=False인 리포트만 대조)
        try:
            query = AnalysisReport.query.filter(
                AnalysisReport.embedding_keyconcepts_corethesis.isnot(None),
                AnalysisReport.embedding_keyconcepts_claim.isnot(None),
                AnalysisReport.is_test == False,
                AnalysisReport.id != submission_id # 자기 자신 제외
            )
            
            all_reports = query.all()
            if not all_reports:
                print("[TA Service] find_similar: 비교할 DB 임베딩이 없습니다.")
                return []

            # 3. DB 결과에서 벡터 및 메타데이터 추출
            for report in all_reports:
                try:
                    db_ids.append(report.id)
                    db_summaries_json.append(report.summary) # JSON 문자열
                    db_vectors_thesis_list.append(json.loads(report.embedding_keyconcepts_corethesis))
                    db_vectors_claim_list.append(json.loads(report.embedding_keyconcepts_claim))
                except Exception as e:
                    print(f"[TA Service] find_similar: Report {report.id} 파싱 실패: {e}")
            
            if not db_ids:
                print("[TA Service] find_similar: 유효한 DB 임베딩이 없습니다.")
                return []

            # 4. DB 벡터 리스트를 NumPy 배열로 변환
            db_vectors_thesis_np = np.array(db_vectors_thesis_list)
            db_vectors_claim_np = np.array(db_vectors_claim_list)

        except Exception as e:
            print(f"[TA Service] find_similar: Live DB 쿼리 중 오류: {e}")
            return []

        # 5. 유사도 계산 (가중합 0.6:0.4)
        sim_thesis = cosine_similarity(sub_thesis_np, db_vectors_thesis_np)[0]
        sim_claim = cosine_similarity(sub_claim_np, db_vectors_claim_np)[0]

        WEIGHT_THESIS = 0.6
        WEIGHT_CLAIM = 0.4
        sim_weighted = WEIGHT_THESIS * sim_thesis + WEIGHT_CLAIM * sim_claim
        
        # 6. 상위 N개 선정
        weighted_scores = list(enumerate(sim_weighted))
        sorted_scores = sorted(weighted_scores, key=lambda item: item[1], reverse=True)
        
        top_candidates = []
        for index, score in sorted_scores: 
            if len(top_candidates) >= top_n:
                break
                
            top_candidates.append({
                "candidate_id": db_ids[index],
                "weighted_similarity": score,
                "candidate_summary_json_str": db_summaries_json[index]
            })

        return top_candidates


    # --- 기능 4: 유사 의심 내용 확인 (LLM 4단계) ---
    def compare_suspicious_content(self, submission_json_str: str, candidate_summary_str: str) -> str | None:
        """
        [TA 기능] 두 리포트의 요약본(JSON 문자열)을 LLM에 보내 1:1 비교를 수행합니다.
        (제공된 _llm_call_comparison 헬퍼 사용)
        """
        if not llm_client_comparison: return None
        
        user_prompt = self.comparison_prompt.format(
            submission_json_str=submission_json_str,
            candidate_json_str=candidate_summary_str
        )
        
        for attempt in range(MAX_RETRIES):
            try:
                response = llm_client_comparison.generate_content(contents=[user_prompt])
                if not response.text: raise Exception("Empty response (Comparison)")
                return response.text # 6개 항목 점수 텍스트 반환
            
            except Exception as e:
                print(f"[TA Service] LLM Compare Error (Attempt {attempt + 1}): {e}")
                if attempt < MAX_RETRIES - 1: sleep(2**attempt)
                else: print(f"[TA Service] Final Error (Comparison): {e}")
        return None

# --- [핵심 수정] TA용 통합 기능: 일괄 분석 실행 (Batch Processing) ---
    def run_batch_analysis_for_ta(self, report_ids: list[str]):
        """
        [TA 핵심 기능]
        TA가 선택한 리포트 ID 목록을 받아, 전체 분석 파이프라인(1~4단계)을 실행하고
        결과를 DB에 저장/업데이트합니다.
        (ID 타입을 int 대신 str으로 가정합니다. AnalysisReport.id가 String(36)이므로)
        """
        print(f"--- TA BATCH ANALYSIS START (Total {len(report_ids)} reports) ---")
        
        for report_id in report_ids:
            report = None # report 변수 스코프 초기화
            try:
                # 0. DB에서 리포트 원본 및 텍스트 조회
                # (주의: AnalysisReport.id는 String(36)이므로 int가 아님)
                report = db.session.get(AnalysisReport, report_id) # 3. .get() 사용
                
                if not report:
                    print(f"[{report_id}] SKIPPING: Report not found in DB.")
                    continue
                
                # (raw_text 필드는 학생용 API에서 사용, TA는 이 필드에 의존하지 않을 수 있음)
                # (만약 TA 업로드 로직이 raw_text를 채운다고 가정)
                if not report.text_snippet: # 4. raw_text 대신 text_snippet으로 체크 (혹은 원본 텍스트 필드명)
                    print(f"[{report_id}] SKIPPING: Report text not available.")
                    continue
                
                print(f"[{report_id}] Analyzing '{report.original_filename}'...")
                report.status = 'processing'
                db.session.commit()

                # --- 1단계: 요약 및 주장 추출 ---
                # (text_snippet이 너무 짧다면 report.raw_text 또는 다른 필드 사용 필요)
                summary_dict = self.extract_summary_and_claims(report.text_snippet) 
                
                if not summary_dict:
                    raise Exception("LLM 요약 추출에 실패했습니다.")
                
                # --- 2단계: 임베딩 생성 ---
                emb_thesis, emb_claim = self._get_embeddings_from_summary(summary_dict)
                if not emb_thesis or not emb_claim:
                    raise Exception("임베딩 생성에 실패했습니다.")
                
                # --- 3단계: 구조적 유사성 검사 ---
                candidate_docs = self.find_structural_similarity(report_id, emb_thesis, emb_claim, top_n=5)
                
                # --- 4단계: 유사 의심 내용 상세 비교 ---
                comparison_results_list = []
                submission_json_str = json.dumps(summary_dict, ensure_ascii=False)

                for candidate in candidate_docs:
                    print(f"  [{report_id}] -> Comparing with {candidate['candidate_id']}...")
                    
                    # 5. 비교 대상의 파일명(original_filename) 가져오기
                    candidate_report = db.session.get(AnalysisReport, candidate['candidate_id'])
                    candidate_filename = candidate_report.original_filename if candidate_report else "Unknown Filename"

                    comparison_text = self.compare_suspicious_content(
                        submission_json_str,
                        candidate['candidate_summary_json_str']
                    )
                    
                    if comparison_text:
                        comparison_results_list.append({
                            "report_id": candidate['candidate_id'], # 6. 'candidate_id' 대신 'report_id'로 통일
                            "original_filename": candidate_filename, # 7. 파일명 추가
                            "weighted_similarity": candidate['weighted_similarity'],
                            "llm_comparison_report": comparison_text
                        })
                    sleep(1) 

                # --- [핵심 수정] 5. DB에 모든 결과 저장 (app.py 로직과 동일하게) ---
                
                # 5a. 20점 이상 후보군 필터링 (헬퍼 함수 사용)
                high_similarity_list = _filter_high_similarity_reports(comparison_results_list)

                # 5b. TA 대시보드 저장을 위한 경량화된 요약 리스트 생성
                candidates_for_storage = []
                for item in high_similarity_list:
                    candidate = {
                        "id": item.get("report_id"), # (comparison_results_list에 report_id로 저장됨)
                        "filename": item.get("original_filename"), # (comparison_results_list에 추가됨)
                        "total_score": item.get("plagiarism_score"),
                        "itemized_scores": item.get("scores_detail")
                    }
                    candidates_for_storage.append(candidate)

                # 5c. DB에 저장
                report.summary = submission_json_str
                report.embedding_keyconcepts_corethesis = json.dumps(emb_thesis)
                report.embedding_keyconcepts_claim = json.dumps(emb_claim)
                
                # 'similarity_details'는 모든 비교 결과를 저장 (상세보기용)
                report.similarity_details = json.dumps(comparison_results_list, ensure_ascii=False)
                
                # 'high_similarity_candidates'에 20점 이상 요약본 저장 (TA 대시보드용)
                report.high_similarity_candidates = json.dumps(candidates_for_storage, ensure_ascii=False)
                
                report.status = 'completed' # 완료
                
                db.session.commit()
                print(f"[{report_id}] SUCCESS: Analysis saved to DB. Found {len(candidates_for_storage)} high-similarity candidates.")

            except Exception as e:
                print(f"[{report_id}] FAILED: {e}")
                traceback.print_exc()
                db.session.rollback()
                try:
                    # 실패 시 DB에 에러 상태 기록 (report 객체가 None이 아닐 경우)
                    if report:
                        report.status = 'error'
                        report.error_message = str(e)[:1000]
                        db.session.commit()
                except Exception as db_err:
                    print(f"[{report_id}] FAILED to update error status: {db_err}")
                    db.session.rollback()
        
        print(f"--- TA BATCH ANALYSIS COMPLETE ---")

    
# --- [핵심 수정] TA용 조회 기능 ---
    
    def get_all_report_overviews(self):
        """
        [TA 기능] TA 대시보드를 위한 모든 리포트의 간략한 개요 목록을 반환합니다.
        (TA API가 호출할 함수)
        """
        try:
            # 8. 쿼리 수정 (User 조인, created_at 사용)
            results = db.session.query(AnalysisReport, User)\
                .join(User, AnalysisReport.user_id == User.id)\
                .order_by(AnalysisReport.created_at.desc())\
                .all()
        except Exception as e:
            print(f"[TA Service] get_all_report_overviews DB Error: {e}")
            return []

        overviews = []
        for r, u in results: # 9. (r, u)로 올바르게 받기
            try:
                # 10. [핵심 수정] high_similarity_candidates 필드 사용
                candidates_list = []
                if r.high_similarity_candidates:
                    candidates_list = json.loads(r.high_similarity_candidates)
                
                overviews.append({
                    "id": r.id,
                    "filename": r.original_filename,
                    "user_email": u.email,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "is_test": r.is_test,
                    # 'top_similarity' 대신 새 필드 반환
                    "high_similarity_candidates": candidates_list 
                })
            except Exception as e:
                print(f"[TA Service] Failed to parse report overview {r.id}: {e}")
                # 파싱 오류가 있어도 중단하지 않고 다음 리포트 처리

        return overviews

    def get_detailed_report_analysis(self, report_id: str):
        """
        [TA 기능] 특정 리포트 ID의 상세 분석 결과(저장된 JSON)를 반환합니다.
        (TA API가 호출할 함수)
        (ID 타입을 int 대신 str으로 가정합니다)
        """
        report = db.session.get(AnalysisReport, report_id) # 11. .get() 사용
        if not report:
            return None
            
        # DB에 저장된 JSON 문자열을 다시 파싱하여 dict로 반환
        return {
            "id": report.id,
            "filename": report.original_filename,
            "status": report.status,
            "summary_data": json.loads(report.summary) if report.summary else None,
            # 12. [필드명 수정] comparison_results -> similarity_details
            "comparison_data": json.loads(report.similarity_details) if report.similarity_details else None,
            "error_message": report.error_message,
            "auto_score_details": report.auto_score_details
        }