import os
import threading
import uuid
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import re
import traceback
import json


# --- [유지] 서비스 로직 임포트 ---
from services.analysis_service import perform_full_analysis_and_comparison
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions



from config import Config, JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
from flask_sqlalchemy import SQLAlchemy
# --- 1. Flask 앱 설정 ---
app = Flask(__name__)
# config.py의 'Config' 클래스에서 설정 로드
app.config.from_object(Config)
from extensions import db, mail, jwt

CORS(app, resources={r"/api/*": {"origins": ["*.vercel.app", "http://localhost:3000"]}})


#확장 객체 앱에 연결 
db.init_app(app)
mail.init_app(app)
jwt.init_app(app)

from models import User, AnalysisReport

# --- [신규] API Blueprint 임포트 ---
from api.student_api import student_bp
from api.auth_api import auth_bp
from api.ta_api import ta_bp # [신규] TA 블루프린트 임포트
    
# --- 3. [유지] 헬퍼 함수 ---
def _parse_comparison_scores(report_text):
    """
    [신규] LLM이 생성한 비교 보고서 텍스트에서 6개 항목의 점수를 파싱합니다.
    """
    scores = {
        "Core Thesis": 0,
        "Problem Framing": 0,
        "Claim": 0,
        "Reasoning": 0,
        "Flow Pattern": 0,
        "Conclusion Framing": 0,
    }
    total_score = 0
    
    try:
        # [수정] LLM의 응답이 마크다운(**)을 포함하는 경우(예: 1. **Core Thesis**...)와
        # 마크다운이 없는 경우(예: 1. Core Thesis...) 모두를 처리하도록 정규식 수정
        # 또한 하이픈(-)과 엔대시(–)를 모두 허용
        score_pattern = re.compile(
            r"\d+\.\s*(?:\*\*)?(.*?)(?:\*\*)?\s*Similarity:\s*(\d)\s*[–-]",  # 마크다운(**) 및 대시(-) 지원
            re.IGNORECASE
        )
        matches = score_pattern.findall(report_text)
        
        key_mapping = {
            "core thesis": "Core Thesis",
            "problem framing": "Problem Framing",
            "claim": "Claim",
            "reasoning": "Reasoning",
            "flow pattern": "Flow Pattern",
            "conclusion framing": "Conclusion Framing",
        }

        parsed_count = 0 # (디버깅용)
        for key, score_str in matches:
            normalized_key = key.strip().lower()
            if normalized_key in key_mapping:
                mapped_key = key_mapping[normalized_key]
                score = int(score_str)
                scores[mapped_key] = score
                parsed_count += 1
        
        if parsed_count < 6:
            print(f"[_parse_comparison_scores] WARNING: Parsed {parsed_count}/6 scores. (Total: {sum(scores.values())})")
        else:
            print(f"[_parse_comparison_scores] Parsed {parsed_count}/6 scores successfully.")

        # [재설계 2] 요청하신 '가중치 적용' 및 '총점 20점' 기준 재적용
        # (가중치 합 = 10)
        # Core Thesis (x3), Claim (x3), Reasoning (x2), Flow (x1), Framing (x1)
        scores["Core Thesis"] = scores["Core Thesis"] * 3 # (15)
        scores["Claim"] = scores["Claim"] * 3 # (15)
        scores["Reasoning"] = scores["Reasoning"] * 2 # (10)
        scores["Flow Pattern"] = scores["Flow Pattern"] * 1 # (5)
        scores["Problem Framing"] = scores["Problem Framing"] * 1 # (5)
        scores["Conclusion Framing"] = scores["Conclusion Framing"] * 0 # (0) - 제외
        # 총점 50점 만점
        total_score = sum(scores.values())

    except Exception as e:
        print(f"[_parse_comparison_scores] 파싱 중 에러: {e}")
        return 0, scores # 실패 시 0점
    
    return total_score, scores

def _filter_high_similarity_reports(similarity_details_list, threshold=20):
    """
    [신규]후보 리포트 리스트(DB저장값)를 받아,
    총점이 threshold(기본 20점) 이상인 리포트만 필터링합니다.
    """
    high_similarity_reports = []
    if not similarity_details_list:
        return []
        
    # similarity_details_list는 이제 analysis_data['comparison_results_list']
    # (e.g., [{"candidate_id": "...", "llm_comparison_report": "..."}, ...])
    for candidate_report in similarity_details_list:
        report_text = candidate_report.get("llm_comparison_report", "")
        
        # 새 파서 호출
        total_score = _parse_comparison_scores(report_text)
        
        candidate_report["plagiarism_score"] = total_score # [신규] 점수 필드 추가
        
        if total_score >= threshold:
            high_similarity_reports.append(candidate_report)
            
    return high_similarity_reports
    
def _distribute_questions(questions_pool, count=3):
    """
    질문 풀(9개)에서 3가지 유형을 최대한 균등하게 섞어서 3개를 뽑습니다.
    """
    if not questions_pool:
        return []
    
    # 유형별로 분리
    critical_q = [q for q in questions_pool if q.get('type') == 'critical']
    perspective_q = [q for q in questions_pool if q.get('type') == 'perspective']
    innovative_q = [q for q in questions_pool if q.get('type') == 'innovative']
    
    initial_set = []
    
    # 각 풀에서 하나씩 안전하게 뽑기
    if critical_q:
        initial_set.append(critical_q.pop(0))
    if perspective_q:
        initial_set.append(perspective_q.pop(0))
    if innovative_q:
        initial_set.append(innovative_q.pop(0))
        
    # 뽑힌 질문은 원본 풀에서도 제거해야 함 (중요)
    for q in initial_set:
        questions_pool.remove(q)
        
    return initial_set

# --- 4. [유지] 백그라운드 작업 함수 ---
# (Blueprint에서 이 함수들을 import하여 사용합니다)

def background_analysis_step1(report_id, text, doc_type, original_filename, json_prompt_template, comparison_prompt_template):
    """(1단계) 핵심 분석 수행. [DB UPDATE]"""
    
    analysis_data = None # [신규] 스레드 2에 전달할 변수 선언
    summary_dict = {}
    similarity_details_list = []
    snippet = text[:4000] # [신규] 스레드 2에 전달할 변수 선언

    with app.app_context():
        try:
            # 1. DB에서 리포트 객체 찾기
            report = db.session.get(AnalysisReport, report_id)
            if not report:
                print(f"[{report_id}] Step 1 FAILED: Report ID not found in DB.")
                return

            print(f"[{report_id}] Step 1 (Analysis) starting...")
            report.status = "processing_analysis"
            db.session.commit()

            # 2. 핵심 분석 (report_id 전달)
            analysis_data = perform_full_analysis_and_comparison(
                report_id, 
                text, 
                original_filename, 
                json_prompt_template,
                comparison_prompt_template
            )
            
            if not analysis_data:
                raise Exception("perform_full_analysis_and_comparison returned None")

            print(f"[{report_id}] Step 1 (Analysis) COMPLETE. Updating DB.")
            
            # 3. [DB UPDATE] (신규 딕셔너리 구조 반영)
            summary_dict = analysis_data.get('summary_json', {})
            embedding_thesis_list = analysis_data.get('embedding_thesis', [])
            embedding_claim_list = analysis_data.get('embedding_claim', [])
            similarity_details_list = analysis_data.get('comparison_results_list', [])

            report.summary = json.dumps(summary_dict)
            report.embedding_keyconcepts_corethesis = json.dumps(embedding_thesis_list)
            report.embedding_keyconcepts_claim = json.dumps(embedding_claim_list)
            report.similarity_details = json.dumps(similarity_details_list)

            report.qa_history = json.dumps([])
            report.questions_pool = json.dumps([])
            report.is_refilling = False
            
            report.status = "processing_questions"
            db.session.commit() # [중요] 스레드 2 시작 전에 commit

        except Exception as e:
            print(f"[{report_id}] Step 1 (Analysis) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "error"
                    report.error_message = str(e)
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state to DB: {e_inner}")
            
            return # [중요] 1단계 실패 시 2단계 호출 방지

    # --- [수정] 4. 2단계(QA) 스레드 호출 ---
    # (1단계 commit이 완료된 후, app.app_context() 바깥에서 호출)
    # (1단계의 분석 데이터를 인자로 직접 전달)
    print(f"[{report_id}] Triggering Step 2 (QA) in background...")
    qa_thread = threading.Thread(
        target=background_analysis_step2_qa, 
        args=(
            report_id, 
            summary_dict, 
            similarity_details_list,
            snippet
        )
    )
    qa_thread.start()

def background_analysis_step2_qa(report_id, summary_dict, similarity_details_list, snippet):
    """(2단계) QA 질문 생성. [DB UPDATE]"""
    
    try:
        print(f"[{report_id}] Step 2 (QA) thread started...")
        
        # [수정] Step 1에서 받은 인자를 사용 (DB 재조회 X)
        if not summary_dict:
             # (이론상 Step 1에서 예외처리되어 여기까지 오지 않아야 함)
            raise Exception("Step 2 received empty summary_dict from Step 1")

        current_qa_history = [] # (초기 생성 시 항상 비어있음)

        # [신규] '총점 20점' 필터링 로직 (헬퍼 함수 사용)
        high_similarity_reports = _filter_high_similarity_reports(similarity_details_list)
        print(f"[{report_id}] QA Filter: Found {len(high_similarity_reports)} 'High Similarity' (>=20) reports.")
        
        # 3. 9개의 질문 풀 생성 (qa_service 호출)
        questions_pool = generate_initial_questions(
            summary_dict, 
            high_similarity_reports,
            snippet
        )
        
        # [Fallback] LLM 실패 시 더미 데이터
        if not questions_pool:
            print(f"[{report_id}] WARNING: QA service failed. Using dummy questions.")
            questions_pool = [
                {"type": "critical", "question": "[Dummy] 이 주장의 핵심 근거는 무엇인가요?"},
                {"type": "critical", "question": "[Dummy] 논리적 비약은 없나요?"},
                {"type": "critical", "question": "[Dummy] 반론을 생각해보셨나요?"},
                {"type": "perspective", "question": "[Dummy] 이 주제를 다른 관점에서 본다면?"},
                {"type": "perspective", "question": "[Dummy] 독자가 이 주장을 어떻게 받아들일까요?"},
                {"type": "perspective", "question": "[Dummy] 10년 뒤에도 이 주장이 유효할까요?"},
                {"type": "innovative", "question": "[Dummy] 이 문제를 해결할 다른 방법은?"},
                {"type": "innovative", "question": "[Dummy] 이 아이디어를 다른 분야에 적용한다면?"},
                {"type": "innovative", "question": "[Dummy] 이 주장의 가장 큰 한계점은?"}
            ]
        
        # 4. 3개 분배
        # (pool 자체는 9개 전체, initial_questions는 3개만 뽑은 것)
        initial_questions = _distribute_questions(questions_pool, 3)
        
        for q_data in initial_questions:
            q_id = str(uuid.uuid4())
            history_entry = {
                "question_id": q_id,
                "question": q_data.get("question", "Failed to parse"),
                "type": q_data.get("type", "unknown"),
                "answer": None,
                "parent_question_id": None
            }
            current_qa_history.append(history_entry)
        
        # 5. [DB UPDATE] (app.app_context() 필요)
        with app.app_context():
            report = db.session.get(AnalysisReport, report_id)
            if not report:
                print(f"[{report_id}] Step 2 FAILED: Report disappeared from DB.")
                return
                
            report.questions_pool = json.dumps(questions_pool) # 9개 풀 저장
            report.qa_history = json.dumps(current_qa_history) # 3개 초기 질문 저장
            report.status = "completed"
            db.session.commit()
            
        print(f"[{report_id}] Step 2 (QA) COMPLETE. Status set to 'completed' in DB.")

    except Exception as e:
        print(f"[{report_id}] Step 2 (QA) FAILED: {e}")
        traceback.print_exc()
        try:
            # (app.app_context() 필요)
            with app.app_context():
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "completed" 
                    report.error_message = f"Step 2 QA FAILED (but analysis is OK): {e}"
                    db.session.commit()
        except Exception as e_inner:
            print(f"[{report_id}] CRITICAL: Failed to write error state (Step 2) to DB: {e_inner}")

def background_refill(report_id):
    """백그라운드 리필. [DB UPDATE]"""
    
    # ⬇️ [신규] 백그라운드 스레드에서 app context 생성
    with app.app_context():
        report = db.session.get(AnalysisReport, report_id)
        if not report:
            print(f"[{report_id}] Refill FAILED: Report not found in DB.")
            return

        print(f"[{report_id}] Refill thread started...")
        
        try:
            # 1. DB에서 데이터 가져오기
            summary = json.loads(report.summary) if report.summary else {}
            
            # [수정] 버그 수정 및 새 로직 적용
            similarity_details = json.loads(report.similarity_details) if report.similarity_details else []
            # [신규] 새 헬퍼 함수 사용 (20점 기준)
            similar = _filter_high_similarity_reports(similarity_details, threshold=20) 
            
            text_snippet = report.text_snippet
            
            # [수정] generate_refill_questions도 새 데이터 구조를 처리해야 함
            new_questions = generate_refill_questions(summary, similar, text_snippet)
            current_pool = json.loads(report.questions_pool) if report.questions_pool else []
            
            if new_questions:
                current_pool.extend(new_questions)
                report.questions_pool = current_pool # [DB UPDATE]
                print(f"[{report_id}] Refill complete. New pool size: {len(current_pool)}")
            else:
                print(f"[{report_id}] Refill FAILED: generate_refill_questions returned None")
                
        except Exception as e:
            print(f"[{report_id}] Refill thread error: {e}")
            
        finally:
            # 2. [DB UPDATE] 잠금 해제
            report.is_refilling = False
            db.session.commit()
            print(f"[{report_id}] Refill lock released in DB.")

# --- 5. [신규] API 엔드포인트(Blueprint) 등록 ---

app.register_blueprint(student_bp, url_prefix='/api/student')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(ta_bp, url_prefix='/api/ta')


# --- 11. (선택) DB 초기화 CLI 명령어 ---
# (flask shell에서 db.create_all()을 실행하기 위한 헬퍼)
@app.shell_context_processor
def make_shell_context():
    from models import User # models.py에서 User 모델 임포트
    return {'db': db, 'User': User}

# --- 10. 루트 확인용 ---
@app.route("/")
def hello_world():
    return jsonify({"message": "AITA Backend is running!"})

# (flask run을 위한 메인 실행 부분)
if __name__ == '__main__':
    app.run(debug=True)
