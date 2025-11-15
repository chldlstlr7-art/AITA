import threading
import uuid
import json
from flask import Blueprint, request, jsonify, Response
from werkzeug.utils import secure_filename


# --- [유지] services 폴더의 로직 임포트 ---
from services.parsing_service import extract_text
from services.qa_service import generate_deep_dive_question
from services.advancement_service import generate_advancement_ideas
from services import flow_graph_services

from flask_jwt_extended import jwt_required, get_jwt_identity

from config import JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
from extensions import db
from models import AnalysisReport
# --- 1. '학생용' Blueprint 생성 ---
student_bp = Blueprint('student_api', __name__)

# --- [수정] 헬퍼 함수: get_report_or_404 ---
def get_report_or_404(report_id, user_id):
    """
    DB에서 리포트를 조회하고, 소유권을 확인합니다.
    없거나 소유자가 다르면 (None, 404_response)를 반환합니다.
    """
    # 1. JWT user_id를 정수로 변환 (토큰 identity는 문자열이기 때문)
    try:
        token_user_id = int(user_id)  # ⬅️ 여기가 핵심 수정 부분
    except ValueError:
        # 혹시 토큰의 identity가 숫자가 아닌 이상한 값일 경우
        return None, (jsonify({"error": "Invalid User ID in token"}), 401)

    # 2. 리포트 조회
    # (db.session.get()은 filter_by보다 최신 Flask-SQLAlchemy에서 권장됨)
    report = db.session.get(AnalysisReport, report_id)
    
    # 3. 리포트가 없는 경우
    if not report:
        return None, (jsonify({"error": "Report not found"}), 404)
        
    # 4. [보안] 리포트 소유자가 현재 로그인한 유저가 아닌 경우
    # DB의 정수(report.user_id)와 토큰에서 변환한 정수(token_user_id)를 비교
    if report.user_id != token_user_id:
        return None, (jsonify({"error": "Access denied"}), 403)
        
    # 5. 성공
    return report, None

# --- 2. [이동] API 엔드포인트 ---
@student_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_report():
    """
    POST /api/student/analyze
    프론트엔드에서 파일과 폼 데이터를 받아 분석을 '시작'시킴
    """
    from app import background_analysis_step1
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
    # [신규] is_test 플래그 파싱 (DB 저장을 위해)
    is_test_str = request.form.get("is_test", "false").lower()
    is_test = is_test_str == 'true'
    print(f"[Debug] is_test 플래그: {is_test} (원본: '{is_test_str}')")

    if not text and file:
        original_filename = secure_filename(file.filename)
        text = extract_text(file) # parsing_service.py
    elif text:
        pass # 텍스트 직접 입력 사용
    else:
        return jsonify({"error": "No content provided (file or text)"}), 400
    
    if not text or len(text) < 50:
        return jsonify({"error": "Text is too short for analysis"}), 400
    print(f"[Debug] 비동기 제출 모드 (is_test={is_test}) 실행...")

    # 1. JWT 토큰에서 identity (user_id)를 문자열로 가져옴
    token_identity = get_jwt_identity() 
    
    # 2. 문자열 identity를 정수(Integer)로 변환 (DB user_id 타입과 일치시키기 위해)
    try:
        user_id = int(token_identity) 
    except ValueError:
        # 토큰의 identity가 숫자가 아닌 경우 오류 처리
        return jsonify({"error": "Invalid user identity in token (not a number)"}), 401
    
    
    try:
        new_report = AnalysisReport(
            user_id=user_id,
            status="processing", # 초기 상태
            original_filename=original_filename,
            text_snippet=text[:10000],
            is_test=is_test,
            
            # --- [신규] 새 임베딩 필드 초기화 ---
            embedding_keyconcepts_corethesis=None,
            embedding_keyconcepts_claim=None
            # --- [신규] ---
        )
        db.session.add(new_report)
        db.session.commit()
        report_id = new_report.id # DB가 생성한 UUID
    except Exception as e:
        db.session.rollback()
        print(f"Failed to create initial report entry: {e}")
        return jsonify({"error": "Failed to initialize report in database"}), 500
    
    thread = threading.Thread(
        target=background_analysis_step1,
        args=(
            report_id, 
            text, 
            doc_type, 
            original_filename,
            JSON_SYSTEM_PROMPT,        # [신규] 5번째 인자
            COMPARISON_SYSTEM_PROMPT   # [신규] 6번째 인자
        )
    )
    thread.start()
    
    return jsonify({"reportId": report_id}), 202


@student_bp.route("/report/<report_id>", methods=["GET"])
@jwt_required()
def get_report(report_id):
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response

    status = report.status

    if status in ["processing", "processing_analysis"]:
        return jsonify({"status": status, "data": None})
        
    if status == "error":
        return jsonify({"status": "error", "data": {"error": report.error_message}}), 500
        
    # 'completed' 또는 'processing_questions'
    
    # --- [유지] ---
    # DB의 JSON '문자열' 필드들을 파이썬 '객체'로 변환합니다.
    # (주의: 필드가 비어있을 경우(None)를 대비해 기본값( {} 또는 [] )을 설정합니다.)
    try:
        summary_data = json.loads(report.summary) if report.summary else {}
        evaluation_data = json.loads(report.evaluation) if report.evaluation else {}
        logic_flow_data = json.loads(report.logic_flow) if report.logic_flow else {}
        # [수정] similarity_details_data는 이제 리스트입니다.
        similarity_details_data = json.loads(report.similarity_details) if report.similarity_details else []
        qa_history_list = json.loads(report.qa_history) if report.qa_history else []
        questions_pool_list = json.loads(report.questions_pool) if report.questions_pool else []
    
    except json.JSONDecodeError as e:
        # JSON 파싱에 실패하면(데이터가 깨졌을 경우) 에러를 반환합니다.
        print(f"[get_report:{report_id}] CRITICAL: JSONDecodeError: {e}")
        return jsonify({"status": "error", "data": {"error": f"Failed to parse report data: {e}"}}), 500
    # --- [유지 완료] ---


    # 헬퍼: qa_history에서 초기 질문(parent_id=None)만 추출
    def _get_initial_questions_from_history(qa_hist_list): # <-- 인자 이름 변경 (리스트임을 명시)
        client_list = []
        if not qa_hist_list: return []
        # 이제 qa_hist_list는 실제 '리스트'이므로 'item'은 '딕셔너리'입니다.
        for item in qa_hist_list: 
            if item.get("parent_question_id") is None and item.get("answer") is None:
                client_list.append({
                    "question_id": item.get("question_id"),
                    "question": item.get("question"),
                    "type": item.get("type")
                })
        return client_list

    # 
    # 클라이언트에게 전달할 'data' 페이로드를 조립합니다.
    # report.* (문자열) 대신 파싱된 객체 변수(summary_data 등)를 사용합니다.
    data = {
        "summary": summary_data,
        "evaluation": evaluation_data,
        "logicFlow": logic_flow_data,
        "similarity_details": similarity_details_data, # (이제 리스트)
        "text_snippet": report.text_snippet, 
        "is_test": report.is_test, # [신규] is_test 상태도 전달
        
        "initialQuestions": _get_initial_questions_from_history(qa_history_list), # <-- 파싱된 리스트 전달
        "questions_pool_count": len(questions_pool_list), # <-- 파싱된 리스트의 길이
        "qa_history": qa_history_list, # <-- 파싱된 리스트 전달
        
        "is_refilling": report.is_refilling,
        "advancement_ideas" : report.advancement_ideas

    }
    
    # status와 함께 최종 데이터를 반환합니다.
    return jsonify({"status": status, "data": data})

@student_bp.route("/report/<report_id>/question/next", methods=["POST"])
@jwt_required()
def get_next_question(report_id):
    """
    POST /api/student/report/<report_id>/question/next
    [DB]의 questions_pool에서 질문을 하나 꺼내고, qa_history에 추가합니다.
    """
    from app import background_refill
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response

    # --- [수정] JSON 파싱 추가 ---
    try:
        pool = json.loads(report.questions_pool) if report.questions_pool else []
        current_history = json.loads(report.qa_history) if report.qa_history else []
    except json.JSONDecodeError:
        return jsonify({"error": "Corrupted questions_pool or qa_history data in database"}), 500
    # --- [수정 완료] ---
    
    is_refilling = report.is_refilling

    if not pool:
        if is_refilling:
            return jsonify({"error": "No questions available, refill in progress. Please wait."}), 503
        else:
            print(f"[{report_id}] Pool is empty. Triggering emergency refill.")
            report.is_refilling = True
            db.session.commit() # 잠금 상태 즉시 저장
            
            refill_thread = threading.Thread(target=background_refill, args=(report_id,))
            refill_thread.start()
            return jsonify({"error": "No questions available, starting refill. Please wait."}), 503

    # 1. 풀에서 질문 뽑기
    next_question = pool.pop(0)
    report.questions_pool = json.dumps(pool) # [DB UPDATE] 변경된 풀을 JSON 문자열로 저장
    
    # 2. 리필 트리거 확인
    if len(pool) <= 2 and not is_refilling:
        print(f"[{report_id}] Pool size ({len(pool)}) <= 2. Triggering background refill.")
        report.is_refilling = True # [DB UPDATE] 잠금
        refill_thread = threading.Thread(target=background_refill, args=(report_id,))
        refill_thread.start()

    # 3. qa_history에 새 질문 추가
    # current_history는 이미 리스트(JSON 파싱됨)
    question_id = str(uuid.uuid4())
    
    history_entry = {
        "question_id": question_id, 
        "question": next_question.get("question", "Failed to parse question"),
        "type": next_question.get("type", "unknown"),
        "answer": None, 
        "parent_question_id": None
    }
    current_history.append(history_entry)
    report.qa_history = json.dumps(current_history) # [DB UPDATE] 변경된 히스토리를 JSON 문자열로 저장

    # 4. DB 커밋
    db.session.commit()

    # 5. 클라이언트 응답
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
    [DB]의 qa_history에서 해당 question_id를 찾아 'answer'를 업데이트합니다.
    """
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response
    
    data = request.json
    question_id = data.get("question_id") 
    user_answer = data.get("user_answer")

    if not question_id or user_answer is None: 
        return jsonify({"error": "Missing question_id or user_answer"}), 400

    # --- [수정] JSON 파싱 추가 (오류 해결) ---
    current_history_str = report.qa_history if report.qa_history else "[]"
    try:
        current_history = json.loads(current_history_str)
    except json.JSONDecodeError:
        return jsonify({"error": "Corrupted qa_history data in database"}), 500
    # --- [수정 완료] ---
    
    history_updated = False
    
    # (주의) JSON 객체 내부를 수정하려면, 리스트 전체를 다시 할당해야 할 수 있음
    for item in reversed(current_history): 
        # item은 이제 딕셔너리이므로 .get() 사용 가능 (오류 해결)
        if item.get("question_id") == question_id and item.get("answer") is None:
            item["answer"] = user_answer 
            history_updated = True
            break
    
    if not history_updated:
        print(f"[{report_id}] CRITICAL: submit_answer couldn't find matching question_id: {question_id}")
        return jsonify({"error": f"Failed to save answer. Question ID {question_id} not found or already answered."}), 404
        
    report.qa_history = json.dumps(current_history) # [DB UPDATE] 변경된 히스토리 전체를 JSON 문자열로 다시 할당
    db.session.commit()
            
    print(f"[{report_id}] Answer saved successfully for {question_id}.")
    return jsonify({"status": "success", "message": "Answer saved successfully"})

@student_bp.route("/report/<report_id>/question/deep-dive", methods=["POST"])
@jwt_required()
def post_deep_dive_question(report_id):
    """
    POST /api/student/report/<report_id>/question/deep-dive
    'parent_question_id'를 받아, 전체 대화 맥락을 탐색하여 심화 질문을 생성
    """
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response
        
    data = request.json
    parent_question_id = data.get("parent_question_id")
    if not parent_question_id:
        return jsonify({"error": "Missing parent_question_id to deep-dive from"}), 400

    # 1. DB에서 히스토리 가져오기 및 JSON 파싱
    # --- [수정] JSON 파싱 추가 ---
    qa_history_str = report.qa_history if report.qa_history else "[]"
    try:
        qa_history = json.loads(qa_history_str)
    except json.JSONDecodeError:
        return jsonify({"error": "Corrupted qa_history data in database"}), 500
    # --- [수정 완료] ---

    # 2. 히스토리 재구성 (기존 로직 동일)
    history_map = {item['question_id']: item for item in qa_history}
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

    # 3. 심화 질문 생성 (서비스 호출)
    try:
        summary_data_dict = json.loads(report.summary) if report.summary else {}
    except json.JSONDecodeError:
        print(f"[{report_id}] CRITICAL: Deep-dive failed to parse report.summary JSON.")
        return jsonify({"error": "Corrupted summary data in database"}), 500
    
    deep_dive_question_text = generate_deep_dive_question(
        conversation_history_list,
        summary_data_dict # [수정] 딕셔너리 전달
    )
    # --- [수정 완료] ---

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
    # qa_history는 이미 리스트(JSON 파싱됨)
    qa_history.append(history_entry) 
    report.qa_history = json.dumps(qa_history) # 변경 사항을 JSON 문자열로 DB에 저장
    
    db.session.commit()
    # 5. 클라이언트 응답
    client_response = {
        "question_id": new_question_id,
        "question": deep_dive_question_text
    }

    return jsonify(client_response)

@student_bp.route('/report/<report_id>/advancement', methods=['GET'])
@jwt_required()
def get_advancement_ideas(report_id):
    # ... (사용자 인증 및 report 객체 로드) ...
    report = db.session.get(AnalysisReport, report_id)
    # ... (report 소유권 확인) ...

    try:
        summary_dict = json.loads(report.summary)
        qa_history_list = json.loads(report.qa_history)
        snippet = report.text_snippet

        # 새로운 서비스 호출 (이제 ideas_json은 Python List 객체)
        ideas_json = generate_advancement_ideas(
            summary_dict,
            snippet,
            qa_history_list
        )

        if not ideas_json:
            return jsonify({"error": "Failed to generate advancement ideas"}), 500

        # [수정] DB에 저장 시: Python 객체 -> JSON 문자열로 변환
        report.advancement_ideas = json.dumps(ideas_json) 
        db.session.commit()

        # [수정] 프론트엔드에 반환 시: Python 객체를 바로 jsonify
        # (Flask가 자동으로 'application/json' 헤더와 함께 문자열로 변환해줌)
        return jsonify(ideas_json), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@student_bp.route("/report/<report_id>/flow-graph", methods=["GET"])
@jwt_required()
def get_flow_graph(report_id):
    """
    GET /api/student/report/<report_id>/flow-graph
    Report의 summary 필드 내 "Flow_Pattern" 데이터를 기반으로 
    Plotly.js용 그래프 JSON을 반환합니다.
    """
    # 1. 사용자 인증 및 리포트 소유권 확인 (기존 헬퍼 함수 사용)
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response

    # 2. 리포트 상태 확인 (완료된 리포트인지)
    if report.status not in ["completed", "processing_questions"]:
        return jsonify({
            "error": "Graph cannot be generated. Report analysis is not complete."
        }), 409

    # 3. DB에서 summary (JSON 문자열) 가져오기
    summary_str = report.summary
    if not summary_str:
        return jsonify({"error": "No summary data found for this report"}), 404

    # 4. JSON 문자열을 Python 객체(dict)로 파싱
    try:
        summary_dict = json.loads(summary_str)
    except json.JSONDecodeError:
        print(f"[{report_id}] CRITICAL: Failed to parse summary JSON.")
        return jsonify({"error": "Corrupted summary data in database"}), 500

    # 5. summary 딕셔너리에서 "flow pattern" 추출 (핵심 수정 사항)
    logic_flow_data = summary_dict.get("Flow_Pattern")
    
    if not logic_flow_data or not isinstance(logic_flow_data, dict):
        return jsonify({"error": "No 'flow pattern' data found within the summary"}), 404

    # 6. 파싱된 "flow pattern" 데이터에서 nodes와 edges 추출
    nodes = logic_flow_data.get("nodes")
    edges = logic_flow_data.get("edges")

    if not nodes or not isinstance(edges, list): # edges는 리스트여야 함
        return jsonify({"error": "Flow pattern data is incomplete (missing nodes or edges)"}), 404

    # 7. flow_graph_services를 호출하여 Plotly JSON "문자열" 생성
    try:
        graph_json_string = flow_graph_services.generate_flow_graph_json(
            nodes,
            edges
        )
        
        # 8. 생성된 JSON 문자열을 그대로 Response로 반환
        return Response(graph_json_string, content_type="application/json")

    except ValueError as ve:
        # (예: "nodes가 비어 있습니다." 등 서비스 내부 오류)
        print(f"[{report_id}] Graph generation failed (ValueError): {ve}")
        return jsonify({"error": f"Graph generation error: {ve}"}), 500
    except Exception as e:
        # (예: Plotly 라이브러리 오류 등)
        print(f"[{report_id}] Graph generation failed (Exception): {e}")
        return jsonify({"error": "An unexpected error occurred while generating the graph"}), 500