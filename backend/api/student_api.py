import threading
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename


# --- [유지] services 폴더의 로직 임포트 ---
from services.parsing_service import extract_text
from services.qa_service import generate_deep_dive_question

from flask_jwt_extended import jwt_required, get_jwt_identity

# --- 1. '학생용' Blueprint 생성 ---
student_bp = Blueprint('student_api', __name__)


# --- 2. [이동] API 엔드포인트 ---
@student_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_report():
    """
    POST /api/student/analyze
    프론트엔드에서 파일과 폼 데이터를 받아 분석을 '시작'시킴
    """
    # ⬇️ [신규] app 변수를 함수 내부에서 임포트
    from app import analysis_results, analysis_status, background_analysis_step1
    
    print("\n--- [Debug] /api/student/analyze ---")
    try:
        print(f"Request Headers: {request.headers}")
        print(f"Request Form Data (request.form): {request.form}")
        print(f"Request Files (request.files): {request.files}")
        
        # 만약 form-data가 아닌 raw-json으로 왔는지 확인
        if request.is_json:
            print(f"Request JSON Data (request.json): {request.get_json()}")
            
    except Exception as e:
        print(f"Error during request debug print: {e}")
    print("--------------------------------------\n")
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
    
    thread = threading.Thread(
        target=background_analysis_step1,
        args=(report_id, text, doc_type, original_filename)
    )
    thread.start()
    
    return jsonify({"reportId": report_id}), 202


@student_bp.route("/report/<report_id>", methods=["GET"])
@jwt_required()
def get_report(report_id):
    """
    GET /api/student/report/<report_id>
    분석 상태와 데이터를 반환합니다. (상태 세분화)
    """
    # ⬇️ [신규] app 변수를 함수 내부에서 임포트
    from app import analysis_results, analysis_status

    status = analysis_status.get(report_id)
    report_data = analysis_results.get(report_id)

    if not status:
        return jsonify({"error": "Report not found"}), 404

    if status == "processing_analysis":
        return jsonify({"status": "processing_analysis", "data": None})

    if status == "processing_questions":
        return jsonify({"status": "processing_questions", "data": report_data})

    if status == "completed":
        return jsonify({"status": "completed", "data": report_data})
        
    if status == "error":
        return jsonify({"status": "error", "data": report_data}), 500


@student_bp.route("/report/<report_id>/question/next", methods=["POST"])
@jwt_required()
def get_next_question(report_id):
    """
    POST /api/student/report/<report_id>/question/next
    사용자가 '새로고침' 또는 '추가 질문'을 요청할 때 호출됩니다.
    """
    # ⬇️ [신규] app 변수를 함수 내부에서 임포트
    from app import analysis_results, background_refill

    report = analysis_results.get(report_id)
    if not report or "questions_pool" not in report:
        return jsonify({"error": "Report not found or not completed"}), 404

    pool = report["questions_pool"]
    is_refilling = report.get("is_refilling", False) # 상태 잠금 확인

    if not pool:
        if is_refilling:
            return jsonify({"error": "No questions available, refill in progress. Please wait."}), 503
        else:
            print(f"[{report_id}] Pool is empty and not refilling. Triggering emergency refill.")
            report["is_refilling"] = True
            refill_thread = threading.Thread(target=background_refill, args=(report_id,))
            refill_thread.start()
            return jsonify({"error": "No questions available, starting emergency refill. Please wait."}), 503

    next_question = pool.pop(0)
    
    if len(pool) <= 2 and not is_refilling:
        print(f"[{report_id}] Pool size ({len(pool)}) <= 2. Triggering background refill.")
        report["is_refilling"] = True
        refill_thread = threading.Thread(target=background_refill, args=(report_id,))
        refill_thread.start()

    if "qa_history" not in report:
        report["qa_history"] = []

    question_id = str(uuid.uuid4())
    
    history_entry = {
        "question_id": question_id, 
        "question": next_question.get("question", "Failed to parse question"),
        "type": next_question.get("type", "unknown"),
        "answer": None, 
        "parent_question_id": None
    }
    report["qa_history"].append(history_entry)

    client_response = {
        "question_id": question_id, 
        "question": history_entry["question"],
        "type": history_entry["type"]
    }

    return jsonify(client_response)


@student_bp.route("/report/<report_id>/answer", methods=["POST"])
@jwt_required()
def submit_answer(report_id):
    """
    POST /api/student/report/<report_id>/answer
    사용자가 '답변만' 제출할 때 호출됩니다.
    """
    # ⬇️ [신규] app 변수를 함수 내부에서 임포트
    from app import analysis_results

    report = analysis_results.get(report_id)
    if not report:
        return jsonify({"error": "Report not found"}), 404
    
    data = request.json
    
    question_id = data.get("question_id") 
    user_answer = data.get("user_answer")

    if not question_id or user_answer is None: 
        return jsonify({"error": "Missing question_id or user_answer"}), 400

    if "qa_history" not in report:
        report["qa_history"] = []

    history_updated = False
    for item in reversed(report["qa_history"]): 
        if item.get("question_id") == question_id and item.get("answer") is None:
            item["answer"] = user_answer 
            history_updated = True
            break
    
    if not history_updated:
        print(f"[{report_id}] CRITICAL: submit_answer couldn't find matching question_id: {question_id}")
        return jsonify({"error": f"Failed to save answer. Question ID {question_id} not found or already answered."}), 404
        
    print(f"[{report_id}] Answer saved successfully for {question_id}.")
    return jsonify({"status": "success", "message": "Answer saved successfully"})


@student_bp.route("/report/<report_id>/question/deep-dive", methods=["POST"])
@jwt_required()
def post_deep_dive_question(report_id):
    """
    POST /api/student/report/<report_id>/question/deep-dive
    'parent_question_id'를 받아, 전체 대화 맥락을 탐색하여 심화 질문을 생성
    """
    # ⬇️ [신규] app 변수를 함수 내부에서 임포트
    from app import analysis_results

    report = analysis_results.get(report_id)
    if not report or "qa_history" not in report:
        return jsonify({"error": "Report not found or history is empty"}), 404
        
    data = request.json
    parent_question_id = data.get("parent_question_id")
    if not parent_question_id:
        return jsonify({"error": "Missing parent_question_id to deep-dive from"}), 400

    history_map = {item['question_id']: item for item in report["qa_history"]}
    
    conversation_history_list = [] 
    current_id = parent_question_id

    while current_id is not None:
        if current_id not in history_map:
            print(f"[{report_id}] CRITICAL: History chain broken. ID {current_id} not found.")
            break 
        
        parent_qa = history_map[current_id]
        
        if parent_qa.get("answer") is None:
            if current_id == parent_question_id:
                 return jsonify({"error": f"Parent question ID {parent_question_id} has not been answered yet."}), 400
            break

        conversation_history_list.insert(0, {
            "question": parent_qa.get("question"),
            "answer": parent_qa.get("answer")
        })
        
        current_id = parent_qa.get("parent_question_id")

    if not conversation_history_list:
        return jsonify({"error": f"Could not reconstruct valid history for {parent_question_id}."}), 404

    # (generate_deep_dive_question은 services에서 임포트했으므로 OK)
    deep_dive_question_text = generate_deep_dive_question(
        conversation_history_list, 
        report["summary"] 
    )
    
    if not deep_dive_question_text:
        return jsonify({"error": "Failed to generate deep-dive question"}), 500

    new_question_id = str(uuid.uuid4())
    
    history_entry = {
        "question_id": new_question_id, 
        "question": deep_dive_question_text,
        "type": "deep_dive", 
        "answer": None,
        "parent_question_id": parent_question_id 
    }
    report["qa_history"].append(history_entry)

    client_response = {
        "question_id": new_question_id,
        "question": deep_dive_question_text
    }

    return jsonify(client_response)


