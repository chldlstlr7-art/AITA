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

# --- [신규] API Blueprint 임포트 ---
from api.student_api import student_bp
from api.auth_api import auth_bp

# --- [유지] 서비스 로직 임포트 ---
from services.analysis_service import perform_full_analysis_and_comparison
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions

# 로그인 인증 기능
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_mail import Mail

from config import Config
# --- 4. [신규] 확장 객체 초기화 (앱 연결 전) ---
db = SQLAlchemy()
mail = Mail()
jwt = JWTManager()

# --- 1. Flask 앱 설정 ---
app = Flask(__name__)
# config.py의 'Config' 클래스에서 설정 로드
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": ["*.vercel.app", "http://localhost:3000"]}})

# --- 2. [중요] 전역 변수 (임시 DB) ---
# (Blueprint에서 이 변수들을 import하여 사용합니다)
analysis_results = {}
analysis_status = {}

#확장 객체 앱에 연결 
db.init_app(app)
mail.init_app(app)
jwt.init_app(app)

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
    """(1단계) 핵심 분석만 수행하고, 2단계(QA) 스레드를 호출합니다."""
    
    print(f"[{report_id}] Step 1 (Analysis) starting...")
    analysis_status[report_id] = "processing_analysis"
    
    try:
        # 1. 핵심 분석 (analysis_service)
        analysis_data = perform_full_analysis_and_comparison(text, original_filename)
        
        if not analysis_data:
            raise Exception("perform_full_analysis_and_comparison returned None")

        print(f"[{report_id}] Step 1 (Analysis) COMPLETE. Saving partial data.")
        text_snippet = text[:4000] 

        # 2. (중요) 질문이 *없는* 부분적인(partial) 결과 저장
        partial_result = {
            "summary": analysis_data['submission_summary'], 
            "evaluation": {
                "structural_similarity_comment": "LLM 정밀 비교 결과를 확인하세요." 
            },
            "logicFlow": {},
            "similarity_details": {
                "structural_similarity_details": analysis_data['llm_comparison_results']
            },
            "text_snippet": text_snippet, # (QA가 나중에 사용할 재료)
            "initialQuestions": [],   # (아직 비어있음)
            "questions_pool": [],     # (아직 비어있음)
            "qa_history": [],
            "is_refilling": False
        }
        
        analysis_results[report_id] = partial_result
        analysis_status[report_id] = "processing_questions" # 2. 상태: 질문 생성 중

        # 3. 2단계(QA) 백그라운드 스레드를 즉시 호출
        print(f"[{report_id}] Triggering Step 2 (QA) in background...")
        qa_thread = threading.Thread(target=background_analysis_step2_qa, args=(report_id,))
        qa_thread.start()

    except Exception as e:
        print(f"[{report_id}] Step 1 (Analysis) FAILED: {e}")
        analysis_status[report_id] = "error"
        analysis_results[report_id] = {"error": str(e)}

def background_analysis_step2_qa(report_id):
    """(2단계) QA 질문만 생성해서 기존 결과에 append합니다."""
    
    print(f"[{report_id}] Step 2 (QA) thread started...")
    try:
        # 1단계에서 저장한 데이터 가져오기
        report = analysis_results.get(report_id)
        if not report:
            raise Exception("Report data not found for QA generation")

        summary = report["summary"]
        similar = report["similarity_details"]["structural_similarity_details"]
        snippet = report["text_snippet"]
        
        # ... (high_similarity_reports 필터링 로직 - 생략 없이 전체 복사) ...
        all_candidate_reports = report["similarity_details"]["structural_similarity_details"]
        high_similarity_reports = []
        for candidate_report in all_candidate_reports:
            report_text = candidate_report.get("llm_comparison_report", "")
            level = _parse_similarity_level(report_text)
            
            if level in ["High", "Very High"]:
                high_similarity_reports.append(candidate_report)
                
        print(f"[{report_id}] QA Filter: Found {len(high_similarity_reports)} 'High/Very High' reports.")
        
        # 3. 9개의 질문 풀 생성 (qa_service)
        questions_pool = generate_initial_questions(summary, similar, snippet)
        
        if not questions_pool:
            print(f"[{report_id}] WARNING: QA generation failed. Using dummies.")
            questions_pool = [
                {"type": "critical", "question": "임시 질문 1: 주장의 근거가 약합니다."},
                {"type": "perspective", "question": "임시 질문 2: 다른 관점은 없나요?"},
                {"type": "innovative", "question": "임시 질문 3: 그래서 어떻게 적용하죠?"}
            ]
        
        # 4. 3개 분배
        initial_questions = _distribute_questions(questions_pool, 3)
        report["questions_pool"] = questions_pool # 남은 6개 저장

        if "qa_history" not in report:
            report["qa_history"] = []
            
        initial_questions_for_client = [] # 클라이언트에게 보낼 리스트

        for q_data in initial_questions:
            # 4-1. 고유 ID 생성
            q_id = str(uuid.uuid4())
            
            # 4-2. qa_history에 (answer: null) 상태로 저장
            history_entry = {
                "question_id": q_id,
                "question": q_data.get("question", "Failed to parse"),
                "type": q_data.get("type", "unknown"),
                "answer": None,
                "parent_question_id": None # 최상위 질문
            }
            report["qa_history"].append(history_entry)
            
            # 4-3. 클라이언트에게 보낼 리스트에 ID와 함께 추가
            client_entry = {
                "question_id": q_id,
                "question": q_data.get("question", "Failed to parse"),
                "type": q_data.get("type", "unknown")
            }
            initial_questions_for_client.append(client_entry)

        # 5. 클라이언트용 리스트를 initialQuestions에 저장
        report["initialQuestions"] = initial_questions_for_client
        
        analysis_status[report_id] = "completed" # 3. 상태: 모든 작업 완료
        print(f"[{report_id}] Step 2 (QA) COMPLETE. Status set to 'completed'.")

    except Exception as e:
        print(f"[{report_id}] Step 2 (QA) FAILED: {e}")
        print("\n--- 🚨 Step 2 (QA) FULL TRACEBACK 🚨 ---")
        traceback.print_exc()
        print("-------------------------------------------\n")
        analysis_status[report_id] = "completed"

def background_refill(report_id):
    """
    백그라운드에서 질문 풀을 6개 리필하고 잠금을 해제합니다.
    """
    report = analysis_results.get(report_id)
    if not report:
        print(f"[{report_id}] Refill FAILED: Report not found.")
        return

    print(f"[{report_id}] Refill thread started...")
    
    try:
        summary = report["summary"]
        similar = report["similarity_details"]["structural_similarity_details"]
        text_snippet = report.get("text_snippet", "")
        
        new_questions = generate_refill_questions(summary, similar, text_snippet)
        
        if new_questions:
            report["questions_pool"].extend(new_questions)
            print(f"[{report_id}] Refill complete. New pool size: {len(report['questions_pool'])}")
        else:
            print(f"[{report_id}] Refill FAILED: generate_refill_questions returned None")
            
    except Exception as e:
        print(f"[{report_id}] Refill thread error: {e}")
        
    finally:
        report["is_refilling"] = False
        print(f"[{report_id}] Refill lock released.")


# --- 5. [신규] API 엔드포인트(Blueprint) 등록 ---
# '/api/student' 접두사로 학생용 API를 모두 등록합니다.
app.register_blueprint(student_bp, url_prefix='/api/student')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
# (나중에 조교용 API를 만들면 여기에 추가)
# from api.ta_api import ta_bp
# app.register_blueprint(ta_bp, url_prefix='/api/ta')

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
