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
from services.qa_service import generate_initial_questions, generate_deep_dive_question
import random

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

# --- 2. 백그라운드 분석 스레드 ---
def background_analysis(report_id, text, doc_type, original_filename):
    """(매우 중요) 백그라운드 스레드에서 무거운 작업을 처리"""
    print(f"[{report_id}] 백그라운드 분석 시작...")
    try:
        # 1. 핵심 분석 (LLM 요약 -> S-BERT 검색 -> LLM 1:1 비교)
        analysis_data = perform_full_analysis_and_comparison(text, original_filename)
        
        if not analysis_data:
            raise Exception("perform_full_analysis_and_comparison returned None")
        # ⬇️ 5. (수정) qa_service 호출
        print(f"[{report_id}] 핵심 분석 완료. QA 질문 생성 시작...")
        submission_summary = analysis_data['submission_summary']
        similar_summaries = analysis_data['llm_comparison_results'] # llm 비교 결과가 유사 요약본임
        
        # 9개의 질문 풀 생성
        questions_pool = generate_initial_questions(submission_summary, similar_summaries, text)
        
        if not questions_pool:
            print(f"[{report_id}] WARNING: QA 질문 풀 생성 실패. 임시 질문으로 대체합니다.")
            questions_pool = [
                {"type": "critical", "question": "임시 질문 1: 주장의 근거가 약합니다."},
                {"type": "perspective", "question": "임시 질문 2: 다른 관점은 없나요?"},
                {"type": "innovative", "question": "임시 질문 3: 그래서 어떻게 적용하죠?"}
            ]
        
        # 9개 풀에서 3개 분배 (분배 후 'questions_pool'은 6개가 됨)
        initial_questions = _distribute_questions(questions_pool, 3)
        # ⬆️ 5.


        # 3. 최종 결과 취합
        final_result = {
            "summary": analysis_data['submission_summary'], 
            "evaluation": {
                "structural_similarity_comment": "LLM 정밀 비교 결과를 확인하세요." 
            },
            "logicFlow": {}, # (임시) 논리 흐름도는 아직 없음
            "similarity_details": {
                "structural_similarity_details": analysis_data['llm_comparison_results']
            },
            "initialQuestions": initial_questions,
            "qa_history": [], # ⬅️ 사용자와의 QA 기록 시작
            "questions_pool": questions_pool # ⬅️ 남은 6개 질문 저장
        }
        
        analysis_results[report_id] = final_result
        analysis_status[report_id] = "completed"
        print(f"[{report_id}] 분석 완료 및 저장됨. (질문 풀 {len(questions_pool)}개)")

    except Exception as e:
        print(f"[{report_id}] 백그라운드 분석 중 오류 발생: {e}")
        analysis_status[report_id] = "error"
        analysis_results[report_id] = {"error": str(e)}


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
        target=background_analysis, 
        args=(report_id, text, doc_type, original_filename)
    )
    thread.start()
    
    # 프론트엔드에는 즉시 reportId를 반환 (202 Accepted)
    return jsonify({"reportId": report_id}), 202


@app.route("/api/report/<report_id>", methods=["GET"])
def get_report_status(report_id):
    """
    GET /api/report/<report_id>
    프론트엔드가 이 주소를 '폴링'하여 분석 상태를 확인
    """
    status = analysis_status.get(report_id, "not_found")
    
    if status == "completed":
        data = analysis_results.get(report_id)
        return jsonify({"status": "completed", "data": data})
    elif status == "processing":
        return jsonify({"status": "processing"})
    elif status == "error":
        data = analysis_results.get(report_id, {"error": "Unknown error"})
        return jsonify({"status": "error", "data": data}), 500
    else:
        return jsonify({"status": "not_found"}), 404

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
