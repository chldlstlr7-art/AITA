import os
import threading
import uuid
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from services.analysis_service import perform_full_analysis_and_comparison
from services.parsing_service import extract_text
# ⬇️ qa_service 임포트
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions
import random
import re

def _parse_similarity_level(report_text):
    """
    LLM이 생성한 비교 보고서 텍스트에서 'Similarity Level'을 파싱합니다.
    (Key는 영어, Value는 한국어/영어 모두 처리)
    """
    try:
        # 1. (최종 수정) Key는 'Similarity Level'로 고정, **(별표)는 옵션
        #    re.search(r"Similarity Level:.*?\s*(.+)", ...)
        #    - 'Similarity Level:' : 'Similarity Level:' 글자를 찾음
        #    - '.*?' : ':' 뒤에 ** 같은 문자가 있든 없든 모두 통과 (Non-Greedy)
        #    - '\s*' : 공백이 있든 없든 통과
        #    - '(.+)' : 공백 뒤의 '값' (예: '낮음')을 캡처 (그룹 1)
        match = re.search(r"Similarity Level:.*?\s*(.+)", report_text, re.IGNORECASE)
        
        if match:
            level = match.group(1).strip().lower() # 캡처된 값 (예: '낮음')
            
            # 2. 한국어/영어 값 매핑
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
    
# ⬇️ 질문 분배를 위한 헬퍼 함수
def _distribute_questions(questions_pool, count=3):
    """
    질문 풀(9개)에서 3가지 유형을 최대한 균등하게 섞어서 3개를 뽑습니다.
    (간단한 버전: 3개 유형에서 1개씩 뽑기)
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

# --- 1. Flask 앱 설정 ---
app = Flask(__name__)
# Vercel 프론트엔드 및 로컬 개발 환경에서의 접근을 허용 (매우 중요)
CORS(app, resources={r"/api/*": {"origins": ["*.vercel.app", "http://localhost:3000"]}})

# 분석 결과를 저장할 임시 딕셔너리 (나중엔 DB로)
analysis_results = {}
analysis_status = {}

def background_analysis_step1(report_id, text, doc_type, original_filename):
    """(1단계) 핵심 분석만 수행하고, 2단계(QA) 스레드를 호출합니다."""
    
    print(f"[{report_id}] Step 1 (Analysis) starting...")
    analysis_status[report_id] = "processing_analysis" # 1. 상태: 분석 중
    
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
        
        # 1. 모든 후보 보고서를 가져옵니다.
        all_candidate_reports = report["similarity_details"]["structural_similarity_details"]
        
        # 2. 'High' 또는 'Very High'인 보고서만 필터링합니다.
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
        
        # 5. (중요) 기존 report 객체에 질문 데이터 *업데이트*
        report["initialQuestions"] = initial_questions
        report["questions_pool"] = questions_pool
        
        analysis_status[report_id] = "completed" # 3. 상태: 모든 작업 완료
        print(f"[{report_id}] Step 2 (QA) COMPLETE. Status set to 'completed'.")

    except Exception as e:
        print(f"[{report_id}] Step 2 (QA) FAILED: {e}")
        # (참고) QA가 실패하더라도 분석은 성공했으므로, 
        # 상태를 'error'로 바꾸는 대신 'completed'로 두어 분석 결과는 볼 수 있게 함
        analysis_status[report_id] = "completed"


# ⬇️ 5. (추가) 리필 전용 백그라운드 스레드 함수
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
        # 리필에 필요한 재료 (summary, similar, snippet)
        summary = report["summary"]
        similar = report["similarity_details"]["structural_similarity_details"]
        text_snippet = report.get("text_snippet", "") # (혹시 모를 에러 방지)
        
        # ⭐️ qa_service의 6개 생성 함수 호출
        new_questions = generate_refill_questions(summary, similar, text_snippet)
        
        if new_questions:
            report["questions_pool"].extend(new_questions)
            print(f"[{report_id}] Refill complete. New pool size: {len(report['questions_pool'])}")
        else:
            print(f"[{report_id}] Refill FAILED: generate_refill_questions returned None")
            
    except Exception as e:
        print(f"[{report_id}] Refill thread error: {e}")
        
    finally:
        # ⭐️ (중요) 성공하든 실패하든, 잠금을 해제합니다.
        report["is_refilling"] = False
        print(f"[{report_id}] Refill lock released.")
# --- 3. API 라우트(주소) 정의 ---

@app.route("/api/analyze", methods=["POST"])
def analyze_report():
    """
    POST /api/analyze
    프론트엔드에서 파일과 폼 데이터를 받아 분석을 '시작'시킴
    """
    
    # (파일 파싱 로직)
    file = request.files.get("file")
    text = request.form.get("text")
    doc_type = request.form.get("docType")
    original_filename = "new_submission.txt" # 기본값

    if not text and file:
        original_filename = secure_filename(file.filename)
        text = extract_text(file) # parsing_service.py
    elif text:
        pass # 텍스트 직접 입력 사용
    else:
        return jsonify({"error": "No content provided (file or text)"}), 400
    
    if not text or len(text) < 50:
        return jsonify({"error": "Text is too short for analysis"}), 400

    report_id = str(uuid.uuid4())
    analysis_status[report_id] = "processing"
    
    # (매우 중요) 분석을 백그라운드 스레드에서 시작시킴
    thread = threading.Thread(
        target=background_analysis_step1,
        args=(report_id, text, doc_type, original_filename)
    )
    thread.start()
    
    # 프론트엔드에는 즉시 reportId를 반환 (202 Accepted)
    return jsonify({"reportId": report_id}), 202


# ⬇️⬇️⬇️ 3. (수정) /api/report/<report_id> 엔드포트 ⬇️⬇️⬇️
@app.route("/api/report/<report_id>", methods=["GET"])
def get_report(report_id):
    """
    GET /api/report/<report_id>
    분석 상태와 데이터를 반환합니다. (상태 세분화)
    """
    status = analysis_status.get(report_id)
    report_data = analysis_results.get(report_id)

    if not status:
        return jsonify({"error": "Report not found"}), 404

    if status == "processing_analysis":
        # 1. 아직 분석 중
        return jsonify({"status": "processing_analysis", "data": None})

    if status == "processing_questions":
        # 2. 분석 완료, QA 생성 중 (프론트가 이 데이터를 표시할 수 있음)
        return jsonify({"status": "processing_questions", "data": report_data})

    if status == "completed":
        # 3. 모든 작업 완료 (QA 질문 포함)
        return jsonify({"status": "completed", "data": report_data})
        
    if status == "error":
        # 4. 1단계(분석)에서 오류 발생
        return jsonify({"status": "error", "data": report_data}), 500

# --- ⬇️ 6. (추가) QA 상호작용을 위한 새 API 엔드포인트 ---

@app.route("/api/report/<report_id>/question/next", methods=["POST"])
def get_next_question(report_id):
    """
    POST /api/report/<report_id>/question/next
    사용자가 '새로고침' 또는 '추가 질문'을 요청할 때 호출됩니다.
    """
    report = analysis_results.get(report_id)
    if not report or "questions_pool" not in report:
        return jsonify({"error": "Report not found or not completed"}), 404

    pool = report["questions_pool"]
    if not pool:
        # ⭐️ (중요) 풀이 비었을 때의 리필 로직
        print(f"[{report_id}] 질문 풀이 비어 리필을 시도합니다.")
        # (간단한 구현: 여기서는 새 질문 5개를 동기식으로 생성)
        # (고급 구현: 백그라운드 스레드로 생성 트리거)
        
        # (임시로 하드코딩된 5개 리필)
        new_pool = [
            {"type": "critical", "question": "리필 질문 1: (백그라운드 생성 필요)"},
            {"type": "perspective", "question": "리필 질문 2"},
            {"type": "innovative", "question": "리필 질문 3"},
            {"type": "critical", "question": "리필 질문 4"},
            {"type": "perspective", "question": "리필 질문 5"},
        ]
        report["questions_pool"] = new_pool
        pool = new_pool
        
        # (참고: 백그라운드 리필 로직은 여기에 구현해야 함)
        # if len(pool) <= 1:
        #    trigger_background_refill(report_id, 5) # (별도 스레드 함수 필요)

    # 풀에서 하나를 뽑아서 반환
    next_question = pool.pop(0)
    
    # (선택) 뽑은 질문을 QA 기록으로 이동
    report["qa_history"].append({
        "question": next_question["question"],
        "type": next_question["type"],
        "answer": None # 답변 대기
    })

    return jsonify(next_question)


@app.route("/api/report/<report_id>/question/deep-dive", methods=["POST"])
def post_deep_dive_question(report_id):
    """
    POST /api/report/<report_id>/question/deep-dive
    사용자가 답변을 제출하고 심화 질문을 요청할 때 호출됩니다.
    
    JSON Body:
    {
        "original_question": "...",
        "user_answer": "..."
    }
    """
    report = analysis_results.get(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
        
    data = request.json
    original_question = data.get("original_question")
    user_answer = data.get("user_answer")
    
    if not original_question or not user_answer:
        return jsonify({"error": "Missing original_question or user_answer"}), 400

    # (참고) qa_history 업데이트 로직은 여기서 생략
    
    # 심화 질문 생성
    deep_dive_question = generate_deep_dive_question(
        original_question,
        user_answer,
        report["summary"] # 원본 요약본을 맥락으로 전달
    )
    
    if not deep_dive_question:
        return jsonify({"error": "Failed to generate deep-dive question"}), 500

    return jsonify({"question": deep_dive_question})
    
# --- 4. (선택 사항) 루트 확인용 ---
@app.route("/")
def hello_world():
    return jsonify({"message": "AITA Backend is running!"})
