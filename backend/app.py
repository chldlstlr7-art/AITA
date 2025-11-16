import os
import threading
import uuid
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS # 1. CORS 임포트
import random
import re
import traceback
import json
 
from services.analysis_service import perform_full_analysis_and_comparison, _parse_comparison_scores, _filter_high_similarity_reports
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions, _distribute_questions
from services.analysis_ta_service import AnalysisTAService 
from services.grading_service import GradingService
from services.course_management_service import CourseManagementService
from config import Config, JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
from flask_sqlalchemy import SQLAlchemy


# --- 1. Flask 앱 설정 ---
app = Flask(__name__)
app.config.from_object(Config)
from flask_migrate import Migrate
# --- 2. [핵심 수정!] 확장(extensions) 임포트 ---
from extensions import db, mail, jwt

# --- 3. [핵심 수정!] CORS를 *먼저* 초기화합니다 ---
CORS(app, 
     origins=[
         "https://aita-kappa.vercel.app", 
         "http://localhost:3000", 
         "http://localhost:5173",
         "https://cautious-doodle-q75wx75gv596hx57r-5173.app.github.dev",
         "https://laughing-carnival-75w7wwr4rq7fx4qx-5173.app.github.dev"
     ],
     supports_credentials=True
)

# --- 4. [핵심 수정!] *그 다음에* 다른 확장들을 초기화합니다 ---
db.init_app(app)
mail.init_app(app)
jwt.init_app(app) # ⬅️ CORS보다 늦게 초기화
migrate = Migrate(app, db)
from models import User, AnalysisReport

# --- 5. [신규] 중앙 서비스 초기화 ---
# app.py에서 한번만 생성하여 앱 컨텍스트(app 객체)에 바인딩합니다.
try:
    # app 객체에 서비스 인스턴스를 속성으로 추가합니다.
    app.analysis_ta_service = AnalysisTAService(
        json_prompt_template=JSON_SYSTEM_PROMPT,
        comparison_prompt_template=COMPARISON_SYSTEM_PROMPT
    )
    app.course_service = CourseManagementService()
    app.grading_service = GradingService()
    print("[App] 모든 서비스가 성공적으로 초기화되었습니다.")
except Exception as e:
    print(f"[App] CRITICAL: 서비스 초기화 실패: {e}")
    # 서비스 로딩 실패 시 None으로 설정 (API에서 체크 가능)
    app.analysis_ta_service = None
    app.course_service = None
    app.grading_service = None

# --- 5. 백그라운드 함수 정의 (순서 중요) ---


def background_analysis_step1(report_id, text, doc_type, original_filename, json_prompt_template, comparison_prompt_template):
    analysis_data = None
    summary_dict = {}
    similarity_details_list = []
    snippet = text[:4000]
    
    with app.app_context():
        try:
            report = db.session.get(AnalysisReport, report_id)
            if not report: 
                print(f"[{report_id}] Step 1 ABORT: Report not found.")
                return

            report.status = "processing_analysis"
            db.session.commit()
            
            # 1. 분석 서비스 호출 (기존과 동일)
            analysis_data = perform_full_analysis_and_comparison(
                report_id, text, original_filename, 
                json_prompt_template, comparison_prompt_template
            )
            
            if not analysis_data: 
                raise Exception("perform_full_analysis_and_comparison returned None")

            summary_dict = analysis_data.get('summary_json', {})
            embedding_thesis_list = analysis_data.get('embedding_thesis', [])
            embedding_claim_list = analysis_data.get('embedding_claim', [])
            
            # 2. 모든 비교 결과 리스트 (상세보기용)
            similarity_details_list = analysis_data.get('comparison_results_list', [])

            # --- [핵심 수정] 20점 이상 후보군 필터링 및 요약 ---
            
            # 3. 20점 이상인 결과만 필터링 (필터 함수가 점수 계산 및 추가)
            high_similarity_list = _filter_high_similarity_reports(similarity_details_list)
            
            # 4. TA 대시보드 저장을 위한 경량화된 요약 리스트 생성
            candidates_for_storage = []
            for item in high_similarity_list:
                # services/analysis_service가 반환하는 키가 'report_id'와 'original_filename'이라고 가정
                candidate = {
                    "candidate_id": item.get("candidate_id"), 
                    "filename": item.get("candidate_filename"),
                    "total_score": item.get("plagiarism_score"), # _filter_... 함수에서 추가된 값
                    "itemized_scores": item.get("scores_detail") # _filter_... 함수에서 추가된 값
                }
                candidates_for_storage.append(candidate)
            
            # 5. DB에 저장
            report.summary = json.dumps(summary_dict)
            report.embedding_keyconcepts_corethesis = json.dumps(embedding_thesis_list)
            report.embedding_keyconcepts_claim = json.dumps(embedding_claim_list)
            
            # [수정] 'similarity_details'는 모든 비교 결과를 저장 (상세보기용)
            report.similarity_details = json.dumps(similarity_details_list)
            
            # [신규] 'high_similarity_candidates'에 20점 이상 요약본 저장 (TA 대시보드용)
            report.high_similarity_candidates = json.dumps(candidates_for_storage)

            report.qa_history = json.dumps([])
            report.questions_pool = json.dumps([])
            report.is_refilling = False
            report.status = "processing_questions"
            
            db.session.commit()
            
            print(f"[{report_id}] Step 1 (Analysis) SUCCESS. Found {len(candidates_for_storage)} high-similarity candidates.")

        except Exception as e:
            print(f"[{report_id}] Step 1 (Analysis) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "error"
                    report.error_message = f"Step 1 FAILED: {str(e)}"
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state to DB: {e_inner}")
            return # 실패 시 2단계(QA) 스레드를 시작하지 않음

    # 6. 2단계(QA) 스레드 시작 (기존과 동일)
    qa_thread = threading.Thread(
        target=background_analysis_step2_qa, 
        args=(report_id, summary_dict, similarity_details_list, snippet)
    )
    qa_thread.start()

def background_analysis_step2_qa(report_id, summary_dict, similarity_details_list, snippet):
    # ... (이하 모든 background_... 함수 내용은 제공해주신 원본과 동일) ...
    try:
        if not summary_dict: raise Exception("Step 2 received empty summary_dict")
        current_qa_history = []
        high_similarity_reports = _filter_high_similarity_reports(similarity_details_list)
        questions_pool = generate_initial_questions(
            summary_dict, high_similarity_reports, snippet
        )
        if not questions_pool:
            print(f"[{report_id}] WARNING: QA service failed. Using dummy questions.")
            questions_pool = [
                {"type": "critical", "question": "[Dummy] ..."},
            ]
        initial_questions = _distribute_questions(questions_pool, 3)
        for q_data in initial_questions:
            q_id = str(uuid.uuid4())
            history_entry = {
                "question_id": q_id, "question": q_data.get("question", "Failed to parse"),
                "type": q_data.get("type", "unknown"), "answer": None,
                "parent_question_id": None
            }
            current_qa_history.append(history_entry)
        with app.app_context():
            report = db.session.get(AnalysisReport, report_id)
            if not report: return
            report.questions_pool = json.dumps(questions_pool)
            report.qa_history = json.dumps(current_qa_history)
            report.status = "completed"
            db.session.commit()
    except Exception as e:
        print(f"[{report_id}] Step 2 (QA) FAILED: {e}")
        traceback.print_exc()
        try:
            with app.app_context():
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "completed"
                    report.error_message = f"Step 2 QA FAILED: {e}"
                    db.session.commit()
        except Exception as e_inner:
            print(f"[{report_id}] CRITICAL: Failed to write error state (Step 2) to DB: {e_inner}")

def background_refill(report_id):
    # ... (이하 모든 background_... 함수 내용은 제공해주신 원본과 동일) ...
    with app.app_context():
        report = db.session.get(AnalysisReport, report_id)
        if not report: return
        try:
            summary = json.loads(report.summary) if report.summary else {}
            similarity_details = json.loads(report.similarity_details) if report.similarity_details else []
            similar = _filter_high_similarity_reports(similarity_details) 
            text_snippet = report.text_snippet
            new_questions = generate_refill_questions(summary, similar, text_snippet)
            current_pool = json.loads(report.questions_pool) if report.questions_pool else []
            if new_questions:
                current_pool.extend(new_questions)
                report.questions_pool = json.dumps(current_pool)
            else:
                print(f"[{report_id}] Refill FAILED: ...")
        except Exception as e:
            print(f"[{report_id}] Refill thread error: {e}")
        finally:
            report.is_refilling = False
            db.session.commit()

# --- 6. [핵심 수정!] "모든 정의가 끝난 후" Blueprint 임포트 ---
from api.student_api import student_bp
from api.auth_api import auth_bp
from api.ta_api import ta_bp 

# --- 7. Blueprint 등록 ---
app.register_blueprint(student_bp, url_prefix='/api/student')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(ta_bp, url_prefix='/api/ta')

# --- 8. DB 초기화 헬퍼 ---
@app.shell_context_processor
def make_shell_context():
    from models import User
    return {'db': db, 'User': User}

# --- 9. 루트 확인용 ---
@app.route("/")
def hello_world():
    return jsonify({"message": "AITA Backend is running!"})

# --- 10. [핵심 수정!] 메인 실행 ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
    # [수정!] host='0.0.0.0'을 추가하여 외부 접속을 허용합니다.
    app.run(debug=True, host='0.0.0.0', port=5000)
