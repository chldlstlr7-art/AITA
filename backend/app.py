import os
import threading
import uuid
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import uuid
from services.analysis_service import perform_full_analysis_and_comparison
from services.parsing_service import extract_text
# ⬇️ qa_service 임포트
from services.qa_service import generate_initial_questions, generate_deep_dive_question, generate_refill_questions
import random
import re
import traceback
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
        initial_questions_raw = _distribute_questions(questions_pool, 3)
        report["questions_pool"] = questions_pool

        # qa_history가 1단계에서 생성되었는지 확인 (방어 코드)
        if "qa_history" not in report:
            report["qa_history"] = []
            
        initial_questions_for_client = [] # 클라이언트에게 보낼 리스트

        for q_data in initial_questions_raw:
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

        # 5. (수정) 클라이언트용 리스트를 initialQuestions에 저장
        report["initialQuestions"] = initial_questions_for_client
        
        
        analysis_status[report_id] = "completed" # 3. 상태: 모든 작업 완료
        print(f"[{report_id}] Step 2 (QA) COMPLETE. Status set to 'completed'.")

    except Exception as e:
        print(f"[{report_id}] Step 2 (QA) FAILED: {e}")

        # ⬇️ 2. (추가) 에러의 전체 세부 정보를 터미널에 출력
        print("\n--- 🚨 Step 2 (QA) FULL TRACEBACK 🚨 ---")
        traceback.print_exc()
        print("-------------------------------------------\n")
        # ⬆️ (추가 끝)

        analysis_status[report_id] = "completed"


# app.py

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
        text_snippet = report.get("text_snippet", "")
        
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
    (최종본: '2개 이하일 때 백그라운드 리필' 로직 포함)
    """
    report = analysis_results.get(report_id)
    if not report or "questions_pool" not in report:
        return jsonify({"error": "Report not found or not completed"}), 404

    pool = report["questions_pool"]
    is_refilling = report.get("is_refilling", False) # 상태 잠금 확인

    if not pool:
        if is_refilling:
            # 풀이 비었지만 리필 중일 때
            return jsonify({"error": "No questions available, refill in progress. Please wait."}), 503
        else:
            # 풀이 비었고 리필 중도 아닐 때 (비상 상황)
            print(f"[{report_id}] Pool is empty and not refilling. Triggering emergency refill.")
            report["is_refilling"] = True
            refill_thread = threading.Thread(target=background_refill, args=(report_id,))
            refill_thread.start()
            return jsonify({"error": "No questions available, starting emergency refill. Please wait."}), 503

    # ⬇️⬇️⬇️ 여기가 핵심 로직 ⬇️⬇️⬇️
    # 1. 풀에서 하나를 뽑아서 반환
    next_question = pool.pop(0)
    
    # 2. (핵심) 남은 질문이 2개 이하이고, *현재 리필 중이 아닐 때*
    if len(pool) <= 2 and not is_refilling:
        print(f"[{report_id}] Pool size ({len(pool)}) <= 2. Triggering background refill.")
        # 즉시 잠금
        report["is_refilling"] = True
        
        # 백그라운드 스레드 시작
        refill_thread = threading.Thread(target=background_refill, args=(report_id,))
        refill_thread.start()
    # ⬆️⬆️⬆️ 핵심 로직 끝 ⬆️⬆️⬆️

    # (선택) 뽑은 질문을 QA 기록으로 이동
    if "qa_history" not in report:
        report["qa_history"] = []


    # 4. 고유 ID 생성 및 qa_history에 추가
    question_id = str(uuid.uuid4())
    
    # qa_history에 저장할 데이터
    history_entry = {
        "question_id": question_id, # ⬅️ 고유 ID 추가
        "question": next_question.get("question", "Failed to parse question"),
        "type": next_question.get("type", "unknown"),
        "answer": None, # 답변 대기
        "parent_question_id": None
    }
    report["qa_history"].append(history_entry)

    # 5. 클라이언트에게 반환할 데이터 (ID 포함)
    # (주의: history_entry 전체가 아닌, 필요한 정보만 반환)
    client_response = {
        "question_id": question_id, # ⬅️ 클라이언트가 이 ID를 받아야 함
        "question": history_entry["question"],
        "type": history_entry["type"]
    }

    return jsonify(client_response)

@app.route("/api/report/<report_id>/answer", methods=["POST"])
def submit_answer(report_id):
    """
    POST /api/report/<report_id>/answer
    사용자가 일반/심화 질문에 대한 '답변만' 제출할 때 호출됩니다.
    (이 엔드포인트는 심화 질문을 생성하지 않습니다.)
    """
    report = analysis_results.get(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    
    data = request.json
    # ⬇️⬇️⬇️ [수정된 부분] ⬇️⬇️⬇️
    # 1. 텍스트 대신 'question_id'를 받음
    question_id = data.get("question_id") 
    user_answer = data.get("user_answer")

    if not question_id or user_answer is None: 
        return jsonify({"error": "Missing question_id or user_answer"}), 400

    # user_answer는 빈 문자열일 수 있으므로 None과 비교
    if not original_question or user_answer is None: 
        return jsonify({"error": "Missing original_question or user_answer"}), 400

    if "qa_history" not in report:
        report["qa_history"] = []

    # 2. qa_history에서 'question_id'로 해당 질문을 찾아 답변을 업데이트
    history_updated = False
    for item in reversed(report["qa_history"]): # 최근 항목부터 검색
        if item.get("question_id") == question_id and item.get("answer") is None:
            item["answer"] = user_answer # 사용자 답변 추가
            history_updated = True
            break
    # (예외 처리) history에 질문이 없는 경우
    if not history_updated:
        print(f"[{report_id}] WARNING: submit_answer couldn't find matching question. Appending new.")
        report["qa_history"].append({
            "question": original_question,
            "type": "unknown_submission", # 타입을 알 수 없음
            "answer": user_answer
        })
        
    print(f"[{report_id}] Answer saved successfully.")
    return jsonify({"status": "success", "message": "Answer saved successfully"})

@app.route("/api/report/<report_id>/question/deep-dive", methods=["POST"])
def post_deep_dive_question(report_id):
    """
    POST /api/report/<report_id>/question/deep-dive
    (수정) 'parent_question_id'를 받아, *전체 대화 맥락*을 
    재귀적으로 탐색하여 심화 질문을 생성
    """
    report = analysis_results.get(report_id)
    if not report or "qa_history" not in report:
        return jsonify({"error": "Report not found or history is empty"}), 404
        
    data = request.json
    parent_question_id = data.get("parent_question_id") # (예: Q1.1의 ID)
    if not parent_question_id:
        return jsonify({"error": "Missing parent_question_id to deep-dive from"}), 400

    # 1. (핵심) 대화 체인 재구성 (Recursive chain traversal)
    # -----------------------------------------------------------------
    # 편의를 위해 qa_history를 ID 기반 맵으로 변환
    history_map = {item['question_id']: item for item in report["qa_history"]}
    
    conversation_history_list = [] # LLM에 전달할 Q/A 쌍 리스트
    current_id = parent_question_id

    while current_id is not None:
        if current_id not in history_map:
            print(f"[{report_id}] CRITICAL: History chain broken. ID {current_id} not found.")
            break # 체인이 끊기면 탐색 중지
        
        parent_qa = history_map[current_id]
        
        # 답변이 없는 Q/A 쌍은 맥락에 포함할 수 없음
        if parent_qa.get("answer") is None:
            # (예외) 단, 지금 막 답변한 '첫 번째 부모'는 반드시 답변이 있어야 함
            if current_id == parent_question_id:
                 return jsonify({"error": f"Parent question ID {parent_question_id} has not been answered yet."}), 400
            # 그 이전의 부모가 답변이 없으면 탐색 중지
            break

        # Q/A 쌍을 리스트 *앞쪽*에 추가 (오래된 것이 0번 인덱스가 되도록)
        conversation_history_list.insert(0, {
            "question": parent_qa.get("question"),
            "answer": parent_qa.get("answer")
        })
        
        # 다음 부모로 이동
        current_id = parent_qa.get("parent_question_id")

    if not conversation_history_list:
        return jsonify({"error": f"Could not reconstruct valid history for {parent_question_id}."}), 404
    # -----------------------------------------------------------------

    # 2. (수정) qa_service의 함수에 *전체 히스토리 리스트* 전달
    deep_dive_question_text = generate_deep_dive_question(
        conversation_history_list, # ⬅️ [핵심] 전체 맥락 리스트 전달
        report["summary"] 
    )
    
    if not deep_dive_question_text:
        return jsonify({"error": "Failed to generate deep-dive question"}), 

    # 3. (기존 로직) 새 질문을 '연결'하여 저장
    new_question_id = str(uuid.uuid4())
    
    history_entry = {
        "question_id": new_question_id, 
        "question": deep_dive_question_text,
        "type": "deep_dive", 
        "answer": None,
        "parent_question_id": parent_question_id # ⬅️ 부모는 *직전*의 ID
    }
    report["qa_history"].append(history_entry)

    # 4. (기존 로직) 새 질문 정보 반환
    client_response = {
        "question_id": new_question_id,
        "question": deep_dive_question_text
    }

    return jsonify(client_response)
    
# --- 4. (선택 사항) 루트 확인용 ---
@app.route("/")
def hello_world():
    return jsonify({"message": "AITA Backend is running!"})
