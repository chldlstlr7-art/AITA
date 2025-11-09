import threading
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

# --- [수정] app.py로부터의 최상위 임포트 제거 ---
# (이 라인들이 순환 참조를 유발했습니다)
# from app import analysis_results, analysis_status, background_analysis_step1, background_refill

# --- [유지] services 폴더의 로직 임포트 ---
# (이것은 app.py를 참조하지 않으므로 안전합니다)
from services.parsing_service import extract_text
from services.qa_service import generate_deep_dive_question

# --- 1. '학생용' Blueprint 생성 ---
student_bp = Blueprint('student_api', __name__)


# --- 2. [이동] API 엔드포인트 ---
@student_bp.route("/analyze", methods=["POST"])
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


auth_bp = Blueprint('auth_api', __name__)

def generate_otp(length=6):
    """6자리 숫자 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=length))

def is_valid_snu_email(email):
    """이메일 형식이 @snu.ac.kr인지 확인"""
    if not email:
        return False
    return re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email) is not None


@auth_bp.route('/request-login-code', methods=['POST'])
def request_login_code():
    """
    POST /api/auth/request-login-code
    사용자의 @snu.ac.kr 이메일을 받아 인증 코드를 발송합니다.
    """
    # (순환 참조 방지) 함수 내부에서 임포트
    from app import db, mail
    from models import User

    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not is_valid_snu_email(email):
        return jsonify({"error": "유효한 @snu.ac.kr 이메일 주소를 입력해주세요."}), 400

    try:
        # 1. 사용자 찾기 (없으면 새로 생성)
        user = db.session.scalar(db.select(User).where(User.email == email))
        if not user:
            print(f"[Auth] New user: {email}. Creating entry.")
            # (향후) TA/학생 역할 구분 로직 필요
            user = User(email=email, role='student')
            db.session.add(user)
        
        # 2. 인증 코드 생성 및 DB 저장
        otp_code = generate_otp()
        user.set_verification_code(otp_code) # 해시하여 DB에 저장
        
        db.session.commit()

        # 3. 이메일 발송
        print(f"[Auth] Sending OTP to {email}...")
        msg = Message(
            subject="[AITA] 서울대학교 인증 코드",
            # (중요) MAIL_DEFAULT_SENDER는 config.py에 설정된 발신자
            sender=os.environ.get('MAIL_DEFAULT_SENDER'),
            recipients=[email]
        )
        msg.body = f"AITA 로그인 인증 코드는 [ {otp_code} ] 입니다. 10분 이내에 입력해주세요."
        
        mail.send(msg)
        print(f"[Auth] OTP sent successfully.")

        return jsonify({"message": f"{email}로 인증 코드를 발송했습니다. 10분 이내에 확인해주세요."}), 200

    except ValueError as ve:
        # (models.py의 이메일 유효성 검사 실패)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /request-login-code: {e}")
        traceback.print_exc()
        return jsonify({"error": "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."}), 500


@auth_bp.route('/verify-login-code', methods=['POST'])
def verify_login_code():
    """
    POST /api/auth/verify-login-code
    이메일과 인증 코드를 받아 검증하고, 성공 시 JWT 토큰을 발급합니다.
    """
    # (순환 참조 방지) 함수 내부에서 임포트
    from app import db
    from models import User
    
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()

    if not email or not code:
        return jsonify({"error": "이메일과 인증 코드를 모두 입력해주세요."}), 400

    try:
        user = db.session.scalar(db.select(User).where(User.email == email))
        
        # 1. 사용자가 없거나 코드가 일치하지 않음
        if not user or not user.check_verification_code(code):
            # (보안) 실패 시도를 줄이기 위해 약간의 딜레이
            time.sleep(1)
            return jsonify({"error": "인증 코드가 정확하지 않거나 만료되었습니다."}), 401

        # 2. 인증 성공
        print(f"[Auth] Verification successful for {email}.")
        user.verify_user() # DB에 '인증됨'으로 표시하고 코드 삭제
        db.session.commit()

        # 3. JWT 토큰 발급
        # (추가 정보) 토큰에 사용자의 ID와 역할(role)을 담음
        additional_claims = {"role": user.role, "email": user.email}
        access_token = create_access_token(
            identity=user.id, 
            additional_claims=additional_claims
        )

        return jsonify({
            "message": "로그인에 성공했습니다.",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /verify-login-code: {e}")
        traceback.print_exc()
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500
