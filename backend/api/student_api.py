import threading
import uuid
import json
from flask import Blueprint, request, jsonify, Response, send_file
from werkzeug.utils import secure_filename
from flask import current_app
import traceback
import io
import plotly.io as pio
# --- [유지] services 폴더의 로직 임포트 ---
from services.parsing_service import extract_text
from services.qa_service import generate_deep_dive_question
from services.advancement_service import generate_advancement_ideas
from services.course_management_service import CourseManagementService
from services.flow_graph_services import _create_flow_graph_figure

from flask_jwt_extended import jwt_required, get_jwt_identity

from config import JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
from extensions import db
from models import AnalysisReport, User
# --- 1. '학생용' Blueprint 생성 ---
student_bp = Blueprint('student_api', __name__)


# --- [수정] 헬퍼 함수: get_report_or_404 ---
def get_report_or_404(report_id, user_id_from_token):
    """
    DB에서 리포트를 조회하고, 소유권 또는 TA/Admin 권한을 확인합니다.
    없거나 권한이 없으면 (None, 404/403_response)를 반환합니다.
    """
    
    # 1. 토큰의 user_id로 현재 사용자 정보 조회
    try:
        token_user_id = int(user_id_from_token)
    except (ValueError, TypeError):
        return None, (jsonify({"error": "Invalid User ID in token"}), 401)

    current_user = db.session.get(User, token_user_id)
    
    if not current_user:
        return None, (jsonify({"error": "User not found"}), 401)

    # 2. 리포트 조회
    report = db.session.get(AnalysisReport, report_id)
    
    # 3. 리포트가 없는 경우
    if not report:
        return None, (jsonify({"error": "Report not found"}), 404)
        
    # 4. [보안] 권한 확인
    is_owner = (report.user_id == current_user.id)
    is_ta_or_admin = (current_user.role == 'ta' or current_user.is_admin)

    # 소유자도 아니고, TA/Admin도 아니면 접근 거부
    if not is_owner and not is_ta_or_admin:
        return None, (jsonify({"error": "Access denied"}), 403)
        
    # 5. 성공 (소유자 또는 TA/Admin)
    return report, None

# --- 2. [이동] API 엔드포인트 ---
@student_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_report():
    """
    POST /api/student/analyze
    프론트엔드에서 파일과 폼 데이터를 받아 분석을 '시작'시킴
    """
    # [핵심 수정] app.py에 정의된 새 함수 이름을 임포트합니다.
    from app import background_analysis_step1_analysis
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
        # [핵심 수정] 새 백그라운드 함수 이름을 타겟으로 지정합니다.
        target=background_analysis_step1_analysis,
        args=(
            report_id, 
            text, 
            doc_type, 
            original_filename,
            JSON_SYSTEM_PROMPT,       # [신규] 5번째 인자
            COMPARISON_SYSTEM_PROMPT  # [신규] 6번째 인자
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
        
    # 'completed' 또는 'processing_comparison', 'processing_questions'
    
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
        ta_score_details_data = json.loads(report.ta_score_details) if report.ta_score_details else None
        auto_score_details_data = json.loads(report.auto_score_details) if report.auto_score_details else None
        high_similarity_candidates_data = json.loads(report.high_similarity_candidates) if report.high_similarity_candidates else []
    
    
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
        "report_title": report.report_title,
        "assignment_id": report.assignment_id,
        "user_rating": report.user_rating,

        "summary": summary_data,
        "logicFlow": logic_flow_data,
        "similarity_details": similarity_details_data, # (이제 리스트)
        "text_snippet": report.text_snippet, 
        "is_test": report.is_test, # [신규] is_test 상태도 전달
        
        "initialQuestions": _get_initial_questions_from_history(qa_history_list), # <-- 파싱된 리스트 전달
        "questions_pool_count": len(questions_pool_list), # <-- 파싱된 리스트의 길이
        "qa_history": qa_history_list, # <-- 파싱된 리스트 전달
        
        "is_refilling": report.is_refilling,
        "advancement_ideas" : report.advancement_ideas,

        # [신규] 채점 및 피드백 정보
        "ta_score_details": ta_score_details_data,
        "auto_score_details": auto_score_details_data,
        "ta_feedback": report.ta_feedback


    }
    
    # [수정] processing_comparison 상태일 때 summary만 반환
    if status == "processing_comparison":
        return jsonify({
            "status": status,
            "data": {
                "summary": summary_data,
                "is_test": report.is_test,
                "text_snippet": report.text_snippet
            }
        })

    # status와 함께 최종 데이터를 반환합니다. (completed, processing_questions)
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

def _background_generate_deep_dive(app_context, report_id, parent_question_id):
    """[수정] 백그라운드에서 심화 질문을 생성하고 (동시성 문제 해결) DB에 저장"""
    
    # --- [1. Read Phase] ---
    # AI 호출에 필요한 데이터를 DB에서 미리 읽습니다.
    conversation_history_list = []
    summary_data_dict = {}

    with app_context.app_context():
        print(f"[{report_id}] Deep-dive generation task starting for parent: {parent_question_id}")
        report = db.session.get(AnalysisReport, report_id)
        if not report:
            print(f"[{report_id}] Deep-dive task ABORT: Report not found.")
            return
        
        try:
            qa_history_str = report.qa_history if report.qa_history else "[]"
            qa_history = json.loads(qa_history_str)
            summary_data_dict = json.loads(report.summary) if report.summary else {}
        except json.JSONDecodeError as e:
            print(f"[{report_id}] Deep-dive task ABORT: Failed to parse initial JSON data: {e}")
            return

        history_map = {item['question_id']: item for item in qa_history}
        current_id = parent_question_id

        while current_id is not None:
            if current_id not in history_map:
                print(f"[{report_id}] CRITICAL: History chain broken. ID {current_id} not found.")
                break
            
            parent_qa = history_map[current_id]
            
            if parent_qa.get("answer") is None:
                print(f"[{report_id}] Deep-dive task WARN: Parent answer not found (yet?).")
                break # (안전하게 중단)

            conversation_history_list.insert(0, {
                "question": parent_qa.get("question"),
                "answer": parent_qa.get("answer")
            })
            current_id = parent_qa.get("parent_question_id")
    
    if not conversation_history_list:
            print(f"[{report_id}] Deep-dive task ABORT: Could not reconstruct history or parent not answered.")
            return

    # --- [2. Slow AI Call Phase] ---
    # (DB 세션과 분리된 상태에서 느린 AI 호출 실행)
    try:
        deep_dive_question_text = generate_deep_dive_question(
            conversation_history_list,
            summary_data_dict
        )
    except Exception as e_ai:
        print(f"[{report_id}] Deep-dive AI call FAILED: {e_ai}")
        return

    if not deep_dive_question_text:
        print(f"[{report_id}] Deep-dive task FAILED: AI returned no text.")
        return

    # --- [3. Write Phase] ---
    # (새 앱 컨텍스트를 열고, DB에서 최신 데이터를 다시 읽어서 쓰기)
    with app_context.app_context():
        try:
            # 1. [RE-READ] DB에서 최신 리포트 정보를 다시 가져옵니다.
            # (다른 스레드가 qa_history를 변경했을 수 있으므로)
            report_fresh = db.session.get(AnalysisReport, report_id)
            if not report_fresh:
                print(f"[{report_id}] Deep-dive task FAILED: Report gone after AI call.")
                return

            # 2. 최신 qa_history를 파싱합니다.
            latest_qa_history_str = report_fresh.qa_history if report_fresh.qa_history else "[]"
            latest_qa_history = json.loads(latest_qa_history_str)

            # 3. [MODIFY] 생성된 새 질문을 *최신* 히스토리에 추가합니다.
            new_question_id = str(uuid.uuid4())
            history_entry = {
                "question_id": new_question_id,
                "question": deep_dive_question_text,
                "type": "deep_dive",
                "answer": None,
                "parent_question_id": parent_question_id
            }
            latest_qa_history.append(history_entry)

            # 4. [WRITE] DB에 저장합니다.
            report_fresh.qa_history = json.dumps(latest_qa_history)
            db.session.commit()
            
            print(f"[{report_id}] Deep-dive task SUCCESS. New question {new_question_id} saved.")

        except Exception as e_write:
            print(f"[Deep-dive Task] CRITICAL: Report {report_id} 최종 쓰기 중 오류: {e_write}")
            traceback.print_exc()
            db.session.rollback()
            
@student_bp.route("/report/<report_id>/question/deep-dive", methods=["POST"])
@jwt_required()
def post_deep_dive_question(report_id):
    """
    [수정] 'parent_question_id'를 받아, 심화 질문 생성을 '시작'시킵니다.
    (AI 호출은 백그라운드 스레드에서 수행)
    """
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response
        
    data = request.json
    parent_question_id = data.get("parent_question_id")
    if not parent_question_id:
        return jsonify({"error": "Missing parent_question_id to deep-dive from"}), 400

    # (선택적: 이미 생성 중인지 확인하는 플래그를 DB에 추가할 수 있음)
    # (예: if report.is_generating_deep_dive: return 409)

    # --- [수정] ---
    # 1. 백그라운드 작업 시작
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_background_generate_deep_dive, # <-- 신규 백그라운드 함수
        args=(app, report_id, parent_question_id)
    )
    thread.daemon = True
    thread.start()

    # 2. 즉시 202 Accepted 반환
    return jsonify({
        "message": "Deep-dive question generation started. Please poll the report status."
    }), 202

def _background_generate_advancement(app_context, report_id):
    """백그라운드에서 AI를 호출하고 DB에 저장하는 함수"""
    with app_context.app_context():
        print(f"[Advancement Task] Report {report_id} 발전 아이디어 생성 시작...")
        report = None
        try:
            report = db.session.get(AnalysisReport, report_id)
            if not report:
                print(f"[Advancement Task] Report {report_id}를 찾을 수 없음.")
                return

            # report.advancement_ideas가 이미 채워져 있으면 실행 중단 (중복 방지)
            if report.advancement_ideas:
                 print(f"[Advancement Task] Report {report_id}는 이미 아이디어가 있습니다.")
                 return
                 
            # report.is_generating_advancement = True # (상태 플래그가 있다면)
            # db.session.commit()

            # --- [느린 작업] ---
            summary_dict = json.loads(report.summary)
            qa_history_list = json.loads(report.qa_history)
            snippet = report.text_snippet

            ideas_json = generate_advancement_ideas(
                summary_dict,
                snippet,
                qa_history_list
            )
            # --------------------

            if ideas_json:
                report.advancement_ideas = json.dumps(ideas_json)
                print(f"[Advancement Task] Report {report_id} 아이디어 저장 완료.")
            else:
                 print(f"[Advancement Task] Report {report_id} 아이디어 생성 실패.")
                 # (실패 시 에러 상태 저장도 가능)

            # report.is_generating_advancement = False # (상태 플래그가 있다면)
            db.session.commit()

        except Exception as e:
            print(f"[Advancement Task] CRITICAL: Report {report_id} 작업 중 오류: {e}")
            db.session.rollback()
            # (오류 상태 저장)
            # if report:
            #     report.is_generating_advancement = False 
            #     db.session.commit()


@student_bp.route('/report/<report_id>/advancement', methods=['POST']) # <-- GET에서 POST로 변경
@jwt_required()
def request_advancement_ideas(report_id):
    """
    [수정] 발전 아이디어 생성을 '요청'하고 백그라운드 작업을 시작합니다.
    """
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response

    # 1. 이미 데이터가 있는지 확인
    if report.advancement_ideas:
        try:
            # 이미 있으면 200 OK와 함께 즉시 데이터를 반환합니다.
            ideas_json = json.loads(report.advancement_ideas)
            return jsonify(ideas_json), 200
        except json.JSONDecodeError:
            # 데이터가 깨졌으면 재생성 유도 (혹은 500 에러)
            pass # 아래로 내려가서 재생성

    # 2. (선택적) 이미 생성 중인지 확인 (is_generating_advancement 같은 플래그가 있다면)
    # if report.is_generating_advancement:
    #     return jsonify({"message": "Generation is already in progress."}), 409 # Conflict
            
    # 3. 백그라운드 작업 시작
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_background_generate_advancement,
        args=(app, report_id)
    )
    thread.daemon = True
    thread.start()

    # 4. 즉시 202 Accepted 반환
    return jsonify({
        "message": "Advancement idea generation started. Please poll the report status."
    }), 202



# --- [신규] 학생 대시보드 API ---
@student_bp.route('/dashboard/<int:target_student_id>', methods=['GET'])
@jwt_required() # (student_required가 아닌 jwt_required 사용)
def get_student_dashboard_by_id(target_student_id):
    """
    학생 대시보드 조회 (수강 과목, 제출 리포트)
    - 학생 본인은 자기 ID로만 조회 가능
    - TA/Admin은 모든 학생 ID로 조회 가능
    """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    try:
        # 1. 요청을 보낸 사용자의 ID와 정보 확인
        current_user_id_str = get_jwt_identity()
        current_user_id = int(current_user_id_str)
        current_user = db.session.get(User, current_user_id)
        
        if not current_user:
            return jsonify({"error": "요청한 사용자를 찾을 수 없습니다."}), 401

        # 2. 권한 확인
        is_owner = (current_user.id == target_student_id)
        is_ta_or_admin = (current_user.role == 'ta' or current_user.is_admin)

        # 본인도 아니고, TA/Admin도 아니면 접근 거부
        if not is_owner and not is_ta_or_admin:
            return jsonify({"error": "Access denied. You can only view your own dashboard."}), 403
        
        # 3. 권한이 확인되면, 서비스 로직 호출
        details = current_app.course_service.get_student_dashboard_details(target_student_id)
        return jsonify(details), 200
    
    except ValueError as e:
        # (예: "학생을 찾을 수 없습니다." 등)
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[Student API /dashboard/{target_student_id} GET] Error: {e}")
        return jsonify({"error": "대시보드 조회 중 서버 오류 발생"}), 500

# --- [신규] 학생 리포트 과제 제출 API ---
@student_bp.route("/report/<report_id>/submit", methods=["POST"])
@jwt_required()
def submit_report_to_assignment(report_id):
    """
    POST /api/student/report/<report_id>/submit
    이미 분석이 완료된 리포트를 특정 과제에 '제출'합니다.
    Request Body: {"assignment_id": <int>}
    """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    try:
        # 1. 토큰에서 학생 ID 가져오기
        user_id_str = get_jwt_identity()
        student_id = int(user_id_str)
        
        # 2. Request Body에서 과제 ID 가져오기
        data = request.json
        assignment_id = data.get("assignment_id")
        
        if not assignment_id:
            return jsonify({"error": "Missing 'assignment_id' in request body"}), 400
            
        # 3. 서비스 로직 호출
        report = current_app.course_service.submit_report_to_assignment(
            report_id, 
            assignment_id, 
            student_id
        )
        
        return jsonify({
            "status": "success",
            "message": "Report submitted successfully.",
            "report_id": report.id,
            "assignment_id": report.assignment_id
        }), 200

    except ValueError as e:
        error_message = str(e)
        if "Access denied" in error_message:
            return jsonify({"error": error_message}), 403 # 금지됨
        if "not found" in error_message:
            return jsonify({"error": error_message}), 404 # 찾을 수 없음
        if "not yet complete" in error_message or "already been submitted" in error_message:
            return jsonify({"error": error_message}), 409 # 충돌 (Conflict)
        if "not enrolled" in error_message:
             return jsonify({"error": error_message}), 403 # 금지됨 (등록되지 않음)
        
        return jsonify({"error": error_message}), 400 # 기타 잘못된 요청
    
    except Exception as e:
        print(f"[Student API /report/{report_id}/submit POST] Error: {e}")
        return jsonify({"error": "An unexpected server error occurred."}), 500

# --- [신규] 학생용 과제 목록 조회 API ---
@student_bp.route('/courses/<int:course_id>/assignments', methods=['GET'])
@jwt_required()
def get_student_assignments_for_course(course_id):
    """
    [신규] 학생이 수강 중인 과목의 과제 목록을 조회합니다.
    """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        
        # [신규] 학생이 수강 중인지 확인하는 서비스 로직 호출
        assignments_list = current_app.course_service.get_assignments_for_student(course_id, user_id)
        
        return jsonify({"assignments": assignments_list}), 200
    except ValueError as e:
        # (예: "과목을 찾을 수 없습니다." 또는 "수강 중이 아닙니다.")
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[Student API /courses/{course_id}/assignments GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 목록 조회 중 서버 오류 발생"}), 500


@student_bp.route("/report/<report_id>/flow-graph", methods=["GET"])
@jwt_required()
def get_flow_graph(report_id):
    """
    [신규] 분석 리포트의 논리 흐름(logic_flow) 데이터를 
    Plotly 그래프 PNG 이미지로 반환합니다.
    """
    user_id = get_jwt_identity()
    report, error_response = get_report_or_404(report_id, user_id)
    if error_response:
        return error_response

    # 1. 완료/에러 상태 확인 ( ...이전 코드 동일... )
    completed_states = ["processing_comparison", "processing_questions", "processing_advancement", "completed"]
    if report.status not in completed_states:
        if report.status == "error":
            return jsonify({"status": "error", "message": report.error_message or "Unknown error"}), 500
        # processing, processing_analysis 상태
        return jsonify({"status": report.status, "message": "Report analysis is not yet complete."}), 202

    # 2. [수정] summary 데이터 파싱
    try:
        # report.logic_flow 대신 report.summary를 파싱합니다.
        summary_data = json.loads(report.summary) if report.summary else {}
    except json.JSONDecodeError as e:
        print(f"[get_flow_graph:{report_id}] CRITICAL: JSONDecodeError (summary): {e}")
        return jsonify({"status": "error", "message": "Failed to parse summary data."}), 500
    
    nodes_dict = {} # 최종적으로 서비스에 넘길 딕셔너리
    edges = []      # 엣지 리스트
    
    try:
        flow_pattern_data = summary_data.get("Flow_Pattern", {})
        
        # 'nodes'는 이제 리스트일 것으로 예상
        nodes_list_or_dict = flow_pattern_data.get("nodes", []) 
        edges = flow_pattern_data.get("edges", [])

        # 4. [수정] 'nodes' 데이터 형식을 딕셔너리로 변환/통일
        
        # [신규] 'nodes'가 리스트(List)인 경우 (새로운 형식)
        if isinstance(nodes_list_or_dict, list):
            for node_obj in nodes_list_or_dict:
                # 각 항목이 {id: ..., summary: ...} 형태인지 확인
                if isinstance(node_obj, dict) and "id" in node_obj and "summary" in node_obj:
                    # { "A1": "문제 제기\n..." } 형식으로 변환
                    nodes_dict[node_obj["id"]] = node_obj["summary"]
                else:
                    print(f"[get_flow_graph:{report_id}] WARNING: Invalid node object in nodes list: {str(node_obj)}")
        
        # [기존] 'nodes'가 딕셔너리(Dict)인 경우 (이전 형식 호환)
        elif isinstance(nodes_list_or_dict, dict):
            print(f"[get_flow_graph:{report_id}] INFO: 'nodes' field is a dict (legacy format). Using as-is.")
            nodes_dict = nodes_list_or_dict
        
        # 'nodes' 변수에 최종 변환된 딕셔너리를 할당
        nodes = nodes_dict

    except AttributeError as e:
        # summary_data가 딕셔너리가 아닌 경우 등
        print(f"[get_flow_graph:{report_id}] CRITICAL: Invalid summary structure: {e}")
        nodes = {} # 에러 시 빈 딕셔너리로 초기화
        edges = []

    # 5. [기존 4번] 노드 유효성 검사 (변환된 'nodes' 딕셔너리 기준)
    if not nodes: # nodes_dict가 비어있는 경우
        print(f"[get_flow_graph:{report_id}] No valid nodes found after parsing summary's Flow_Pattern.")
        return jsonify({"status": "error", "message": "No logic flow data available to generate graph."}), 404

    # 6. [기존 5번] 그래프 생성
    try:
        # _create_flow_graph_figure는 이제 항상 딕셔너리 형태의 'nodes'를 받음
        fig = _create_flow_graph_figure(nodes, edges)
        
        # 7. [기존 6번] PNG 이미지 바이트로 변환 ( ...이하 동일... )
        img_bytes = pio.to_image(fig, format="png")
        
        # 8. [기존 7번] PNG 바이트를 send_file을 통해 반환
        return send_file(
            io.BytesIO(img_bytes),
            mimetype='image/png',
            as_attachment=False 
        )
    
    except Exception as e:
        # [수정] 에러 메시지 명확화
        print(f"[get_flow_graph:{report_id}] CRITICAL: Failed to generate graph image: {e}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": "An error occurred while generating the graph image."}), 500