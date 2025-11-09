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
# --- [신규] API Blueprint 임포트 ---
from api.student_api import student_bp
from api.auth_api import auth_bp
from api.ta_api import ta_bp # [신규] TA 블루프린트 임포트

# --- [유지] 서비스 로직 임포트 ---
from services.analysis_service import perform_full_analysis_and_comparison
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions


from config import Config

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

from models import AnalysisReport

from flask_sqlalchemy import SQLAlchemy

    
# --- 3. [유지] 헬퍼 함수 ---
def _parse_similarity_level(report_text):
    """
    LLM이 생성한 비교 보고서 텍스트에서 'Similarity Level'을 파싱합니다.
    """
    try:
        match = re.search(r"Similarity Level:.*?\s*(.+)", report_text, re.IGNORECASE)
        
        if match:
            level = match.group(1).strip().lower() # 캡처된 값
            
            # 한국어/영어 값 매핑
            if "very high" in level or "매우 높음" in level:
                return "Very High"
            if "high" in level or "높음" in level:
                return "High"
            if "moderate" in level or "보통" in level:
                return "Moderate"
            if "low" in level or "낮음" in level:
                return "Low"
            
    except Exception as e:
        print(f"[_parse_similarity_level] 파싱 중 에러 발생: {e}")
        pass
    
    return "Unknown" # 파싱 실패
    
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

def background_analysis_step1(report_id, text, doc_type, original_filename):
    """(1단계) 핵심 분석 수행. [DB UPDATE]"""
    
    # ⬇️ [신규] 백그라운드 스레드에서 app context 생성
    with app.app_context():
        try:
            # 1. DB에서 리포트 객체 찾기
            # (주의: db.session.get()은 Flask-SQLAlchemy 3.x, 구버전은 .query.get())
            report = db.session.get(AnalysisReport, report_id)
            if not report:
                print(f"[{report_id}] Step 1 FAILED: Report ID not found in DB.")
                return

            print(f"[{report_id}] Step 1 (Analysis) starting...")
            report.status = "processing_analysis"
            db.session.commit()

            # 2. 핵심 분석 (동일)
            analysis_data = perform_full_analysis_and_comparison(text, original_filename)
            
            if not analysis_data:
                raise Exception("perform_full_analysis_and_comparison returned None")

            print(f"[{report_id}] Step 1 (Analysis) COMPLETE. Updating DB.")
            text_snippet = text[:4000] 

            # 3. [DB UPDATE] 딕셔너리 대신 DB 객체 필드 업데이트
            if 'summary' in analysis_data:
                report.summary = json.dumps(analysis_data['summary'])
            else:
                # 혹은 요약 데이터가 없는 경우를 대비
                report.summary = json.dumps({"default_summary": "No summary available"})
            
            report.evaluation = json.dumps({
                "structural_similarity_comment": "LLM 정밀 비교 결과를 확인하세요." 
            })
            report.logic_flow = json.dumps({}) 
            report.similarity_details = json.dumps({
                "structural_similarity_details": analysis_data['llm_comparison_results']
            })
            
            report.text_snippet = text_snippet
            report.qa_history = json.dumps([])
            report.questions_pool = json.dumps([])
            report.is_refilling = False
            
            report.status = "processing_questions" # 2. 상태: 질문 생성 중
            db.session.commit()

            # 4. 2단계(QA) 스레드 호출 (동일)
            print(f"[{report_id}] Triggering Step 2 (QA) in background...")
            qa_thread = threading.Thread(target=background_analysis_step2_qa, args=(report_id,))
            qa_thread.start()

        except Exception as e:
            print(f"[{report_id}] Step 1 (Analysis) FAILED: {e}")
            db.session.rollback()
            try:
                # 에러 상태를 DB에 기록
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "error"
                    report.error_message = str(e)
                    db.session.commit()
            except Exception as e_inner:
                print(f"[{report_id}] CRITICAL: Failed to write error state to DB: {e_inner}")

def background_analysis_step2_qa(report_id):
    """(2단계) QA 질문 생성. [DB UPDATE]"""
    
    # ⬇️ [신규] 백그라운드 스레드에서 app context 생성
    with app.app_context():
        try:
            # 1. DB에서 리포트 객체 찾기
            report = db.session.get(AnalysisReport, report_id)
            if not report:
                print(f"[{report_id}] Step 2 FAILED: Report ID not found in DB.")
                return
            
            print(f"[{report_id}] Step 2 (QA) thread started...")

            # ⬇️ [핵심 수정] DB에서 읽은 JSON 문자열을 Python 객체로 복원 (역직렬화) ⬇️
            # summary 필드는 이제 dict 형태여야 합니다.
            summary_data = json.loads(report.summary) if report.summary else None
            similarity_details_data = json.loads(report.similarity_details) if report.similarity_details else None
            
            # 여기서 빈 리포트 체크 로직을 다시 작성합니다.
            if not summary_data or not similarity_details_data:
                 raise Exception("Report data from Step 1 (summary/similarity) not found in DB")

            # 1단계의 데이터 추출
            summary = summary_data # 이제 dict 형태
            
            snippet = report.text_snippet
            
            
            questions_pool = json.loads(report.questions_pool) if report.questions_pool else []
            current_qa_history = json.loads(report.qa_history) if report.qa_history else []

            # ... (high_similarity_reports 필터링 로직 - 동일) ...
            all_candidate_reports = similarity_details_data.get("structural_similarity_details", [])
            high_similarity_reports = []
            for candidate_report in all_candidate_reports:
                report_text = candidate_report.get("llm_comparison_report", "")
                level = _parse_similarity_level(report_text)
                
                if level in ["High", "Very High"]:
                    high_similarity_reports.append(candidate_report)
            print(f"[{report_id}] QA Filter: Found {len(high_similarity_reports)} 'High/Very High' reports.")

            
            # 3. 9개의 질문 풀 생성 (동일)
            # (주의) similar 변수명을 high_similarity_reports로 변경하여 전달
            questions_pool = generate_initial_questions(summary, high_similarity_reports, snippet)
            
            # ... (dummy data 로직 - 동일) ...
            
            # 4. 3개 분배 (동일)
            initial_questions = _distribute_questions(questions_pool, 3)
            
            # 5. [DB UPDATE] DB 객체에 저장
            report.questions_pool = json.dumps(questions_pool) # 남은 6개
            
            for q_data in initial_questions:
                q_id = str(uuid.uuid4())
                history_entry = {
                    "question_id": q_id,
                    "question": q_data.get("question", "Failed to parse"),
                    "type": q_data.get("type", "unknown"),
                    "answer": None,
                    "parent_question_id": None # 최상위 질문
                }
                current_qa_history.append(history_entry)
                
                # (client_entry는 get_report에서 동적으로 생성되므로 여기선 필요 없음)
            
            # 6. [DB UPDATE]
            report.qa_history = json.dumps(current_qa_history)
            # (주의: report.initialQuestions = ... 라인 제거됨)
            report.status = "completed"
            db.session.commit()
            
            print(f"[{report_id}] Step 2 (QA) COMPLETE. Status set to 'completed' in DB.")

        except Exception as e:
            print(f"[{report_id}] Step 2 (QA) FAILED: {e}")
            traceback.print_exc()
            db.session.rollback()
            try:
                report = db.session.get(AnalysisReport, report_id)
                if report:
                    report.status = "error" # 또는 "completed"
                    report.error_message = f"Step 2 QA FAILED: {e}"
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
            similar = similarity_data.get("structural_similarity_details", [])
            text_snippet = report.text_snippet
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
