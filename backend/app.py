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
def background_analysis_step1_analysis(report_id, text, doc_type, original_filename, json_prompt_template, comparison_prompt_template):
    """
    [1단계] 분석 및 임베딩 생성 (빠른 완료)
    - analysis_service.perform_step1_analysis_and_embedding 호출
    - 'summary'와 'embedding' 필드를 DB에 저장
    - 상태를 'processing_comparison'으로 변경
    - 2단계(비교) 스레드 시작
    """
    analysis_data = None
    summary_dict = {}
    
    with app.app_context():
        report = None
        try:
            report = db.session.get(AnalysisReport, report_id)
            if not report: 
                print(f"[{report_id}] Step 1 ABORT: Report not found.")
                return

            report.status = "processing_analysis"
            db.session.commit()
            
            # 1. [신규] 1단계 서비스 호출 (분석 + 임베딩)
            analysis_data = perform_step1_analysis_and_embedding(
                report_id, text, json_prompt_template
            )
            
            if not analysis_data: 
                raise Exception("perform_step1_analysis_and_embedding returned None")

            summary_dict = analysis_data.get('summary_json', {})
            embedding_thesis_list = analysis_data.get('embedding_thesis', [])
            embedding_claim_list = analysis_data.get('embedding_claim', [])

            # 2. [신규] 1단계 결과(요약, 임베딩)를 DB에 즉시 저장
            report.summary = json.dumps(summary_dict)
            report.embedding_keyconcepts_corethesis = json.dumps(embedding_thesis_list)
            report.embedding_keyconcepts_claim = json.dumps(embedding_claim_list)
            
            # 3. [신규] 2단계(비교)를 위한 상태 업데이트
            report.status = "processing_comparison" 
            
            # (QA 필드는 3단계(QA) 스레드에서 채워지므로 여기서 초기화)
            report.qa_history = json.dumps([])
            report.questions_pool = json.dumps([])
            report.is_refilling = False

            db.session.commit()
            
            print(f"[{report_id}] Step 1 (Analysis & Embedding) SUCCESS. DB saved.")

        except Exception as e:
            print(f"[{report_id}] Step 1 (Analysis) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                if report: # report 객체가 유효할 때만
                    report.status = "error"
                    report.error_message = f"Step 1 FAILED: {str(e)}"
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state to DB: {e_inner}")
            return # 실패 시 2단계 스레드를 시작하지 않음

    # 4. [신규] 2단계(비교) 스레드 시작
    # (analysis_data에는 1단계 결과가, comparison_prompt_template는 2단계에 필요)
    comparison_thread = threading.Thread(
        target=background_analysis_step2_comparison, 
        args=(report_id, analysis_data, comparison_prompt_template)
    )
    comparison_thread.start()


# [핵심 수정 2/3]
# 2단계(비교)를 수행하는 새로운 백그라운드 함수
def background_analysis_step2_comparison(report_id, analysis_data, comparison_prompt_template):
    """
    [2단계] 유사도 비교 (중간 시간 소요)
    - 1단계에서 받은 임베딩으로 analysis_service.perform_step2_comparison 호출
    - 'similarity_details', 'high_similarity_candidates' 필드를 DB에 저장
    - 상태를 'processing_questions'로 변경
    - 3단계(QA) 스레드 시작
    """
    summary_dict = {}
    similarity_details_list = []
    snippet = "" # 3단계(QA)에 전달하기 위해 DB에서 로드

    with app.app_context():
        report = None
        try:
            report = db.session.get(AnalysisReport, report_id)
            if not report: 
                print(f"[{report_id}] Step 2 ABORT: Report not found.")
                return

            # 1. 1단계 결과물 추출
            summary_dict = analysis_data.get('summary_json', {})
            embedding_thesis_list = analysis_data.get('embedding_thesis', [])
            embedding_claim_list = analysis_data.get('embedding_claim', [])
            submission_json_str = json.dumps(summary_dict) # 비교를 위해 JSON 문자열로
            snippet = report.text_snippet # 3단계(QA)에 전달할 스니펫 로드

            # 2. [신규] 2단계 서비스 호출 (비교)
            similarity_details_list = perform_step2_comparison(
                report_id,
                embedding_thesis_list,
                embedding_claim_list,
                submission_json_str,
                comparison_prompt_template
            )

            # 3. 20점 이상 후보군 필터링 (기존 로직)
            high_similarity_list = _filter_high_similarity_reports(similarity_details_list)
            
            candidates_for_storage = []
            for item in high_similarity_list:
                candidate = {
                    "candidate_id": item.get("candidate_id"), 
                    "filename": item.get("candidate_filename"),
                    "total_score": item.get("plagiarism_score"), 
                    "itemized_scores": item.get("scores_detail") 
                }
                candidates_for_storage.append(candidate)
            
            # 4. [신규] 2단계 결과(비교 결과)를 DB에 저장
            report.similarity_details = json.dumps(similarity_details_list)
            report.high_similarity_candidates = json.dumps(candidates_for_storage)
            
            # 5. [신규] 3단계(QA)를 위한 상태 업데이트
            report.status = "processing_questions"
            db.session.commit()

            print(f"[{report_id}] Step 2 (Comparison) SUCCESS. Found {len(candidates_for_storage)} high-similarity candidates.")

        except Exception as e:
            print(f"[{report_id}] Step 2 (Comparison) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                if report:
                    report.status = "error"
                    report.error_message = f"Step 2 FAILED: {str(e)}"
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state (Step 2) to DB: {e_inner}")
            return # 실패 시 3단계(QA) 스레드를 시작하지 않음

    # 6. [신규] 3단계(QA) 스레드 시작 (기존 로직과 동일한 인자 전달)
    qa_thread = threading.Thread(
        target=background_analysis_step3_qa, 
        args=(report_id, summary_dict, similarity_details_list, snippet)
    )
    qa_thread.start()


# [핵심 수정 3/3]
# 'background_analysis_step2_qa' -> 'background_analysis_step3_qa'로 이름 변경
def background_analysis_step3_qa(report_id, summary_dict, similarity_details_list, snippet):
    """
    [3단계] QA 생성 (중간 시간 소요)
    - 2단계에서 받은 요약/비교 결과로 generate_initial_questions 호출
    - 'qa_history', 'questions_pool' 필드를 DB에 저장
    - 상태를 'completed'로 변경 (최종 완료)
    """
    with app.app_context():
        report = None
        try:
            report = db.session.get(AnalysisReport, report_id)
            if not report: 
                print(f"[{report_id}] Step 3 ABORT: Report not found.")
                return
            
            if not summary_dict: raise Exception("Step 3 received empty summary_dict")
            
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

            # 3단계(QA) 결과 저장 및 최종 'completed' 상태 업데이트
            report.questions_pool = json.dumps(questions_pool)
            report.qa_history = json.dumps(current_qa_history)
            report.status = "completed"
            db.session.commit()
            print(f"[{report_id}] Step 3 (QA) SUCCESS. Process complete.")

        except Exception as e:
            print(f"[{report_id}] Step 3 (QA) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                if report:
                    report.status = "completed" # QA가 실패해도 일단 '완료' 처리 (분석/비교는 성공)
                    report.error_message = f"Step 3 QA FAILED: {e}"
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state (Step 3) to DB: {e_inner}")

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
