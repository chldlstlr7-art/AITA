import re
import random
import string
import os
import time
import traceback
from flask import Blueprint, request, jsonify, g
from flask_mail import Message
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
from datetime import datetime, timezone, timedelta
from functools import wraps

from models import User
from extensions import db, mail

# --- [v4 수정] TA, 개발자용 토큰, 비밀 키 설정 ---

# 1. TA 권한을 자동으로 부여할 이메일 리스트 (set으로 빠른 조회)
PREDEFINED_TA_LIST = {
    "ta.kim@snu.ac.kr",
    "ta.lee@snu.ac.kr",
}


# [신규] 관리자 권한을 자동으로 부여할 이메일 리스트
PREDEFINED_ADMIN_LIST = {
    "admin.park@snu.ac.kr",
    "dev@snu.ac.kr",       # 개발자 계정은 관리자로 취급
    "dabok2@snu.ac.kr",   # seed.py에서 사용된 이메일
    "admin@snu.ac.kr"     # seed.py에서 사용된 이메일
}

# 2. 무제한/개발용 토큰을 발급받을 이메일
DEV_EMAIL = "dev@snu.ac.kr"

# 3. [v4 신규] 개발용 토큰 발급을 위한 비밀 키
# (주의: 실제 배포 시에는 .env 또는 환경 변수로 옮겨야 합니다)
DEV_SECRET_KEY = "my_super_secret_dev_key_12345!" 

# --- 1. '인증용' Blueprint 생성 ---
auth_bp = Blueprint('auth_api', __name__)

# --- 2. 헬퍼 함수 ---
def _generate_otp(length=6):
    """6자리 숫자 OTP 생성"""
    return "".join(random.choices(string.digits, k=length))

def is_valid_snu_email(email):
    """이메일 형식이 @snu.ac.kr인지 확인"""
    if not email:
        return False
    # dev@snu.ac.kr도 허용
    if email == DEV_EMAIL:
        return True
    return re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email) is not None

def _send_otp_email(email, otp, subject_prefix="[AITA]"):
    """
    실제 메일 발송과 터미널 로깅을 동시에 수행합니다.
    """
    
    # ----------------------------------------------------
    # --- 1. 터미널에 OTP 출력 (테스트 및 로깅용) ---
    # ----------------------------------------------------
    print("\n--- 📧 [Email Send & Log] ---")
    print(f"--- 📧  {subject_prefix} OTP for {email} is: {otp} ---")
    print(f"[Auth] Preparing to send OTP to {email}...")

    # ----------------------------------------------------
    # --- 2. 실제 메일 발송 로직 (Flask-Mail) ---
    # ----------------------------------------------------
    try:
        # 메시지 객체 생성
        subject = f"{subject_prefix} 이메일 인증 코드입니다."
        msg = Message(subject,
                      sender=os.environ.get('MAIL_USERNAME'), # 발신자 주소 (환경변수)
                      recipients=[email]) # 수신자 주소
        
        # 메일 본문 (HTML 또는 텍스트)
        msg.body = f"인증 코드는 [{otp}] 입니다."
        # 예시: msg.html = f"<h1>인증 코드: {otp}</h1>"

        # 실제 메일 발송
        # current_app.app_context() 내에서 실행되도록 보장 (만약 앱 컨텍스트 밖이라면)
        # with current_app.app_context():
        mail.send(msg)
        
        print(f"[Auth] Successfully sent email to {email}.")
        print("------------------------------------------\n")

    except Exception as e:
        # 메일 발송 실패 시 로깅
        print(f"\n--- ❌ [Email Error] ---")
        print(f"[Auth] Failed to send email to {email}. Error: {e}")
        print("--------------------------\n")
        # 실패 시에도 OTP는 터미널에 이미 출력되었음
        # 필요시 여기서 에러를 다시 발생시킬 수 있음
        # raise e
def ta_required():
    """
    [수정됨]
    JWT 토큰의 'role'이 'ta'이거나 'is_admin'이 True인지 
    확인하는 데코레이터.
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required() 
        def decorator(*args, **kwargs):
            claims = get_jwt()
            
            # [수정] 'ta' 역할이거나 'is_admin' 클레임이 True이면 통과
            if claims.get("role") == "ta" or claims.get("is_admin") == True:
                # [신규] g.user에 사용자 정보 저장 (ta_api.py에서 사용)
                g.user = User.query.get(claims.get("sub"))
                if not g.user:
                     return jsonify({"error": "토큰에 해당하는 사용자를 찾을 수 없습니다."}), 404
                
                return fn(*args, **kwargs)
            else:
                return jsonify({"error": "조교(TA) 또는 관리자 권한이 필요합니다."}), 403
        return decorator
    return wrapper

# --- 3. [유지] 비밀번호 기반 (이메일 인증) 엔드포인트 ---
@auth_bp.route("/register", methods=["POST"])
def register_request():
    """
    ... (설명 동일) ...
    [수정됨] Admin 리스트에 있으면 is_admin=True로 설정
    """
    data = request.json
    email = data.get("email", "").lower()
    password = data.get("password")

    # ... (이메일, 비밀번호, @snu.ac.kr 유효성 검사) ...
    
    try:
        # ... (이미 인증된 사용자 확인) ...
        
        user = User.query.filter_by(email=email).first()

        if not user:
            # 신규 사용자
            default_role = "student"
            user_is_admin = False # [수정] 기본값

            if email in PREDEFINED_ADMIN_LIST:
                role = "ta" # 관리자는 TA 역할을 겸임
                user_is_admin = True # [수정] is_admin 플래그 설정
                print(f"[Auth] Register: {email} is in ADMIN list. Granting TA role and Admin flag.")
            elif email in PREDEFINED_TA_LIST:
                role = "ta"
                print(f"[Auth] Register: {email} is in TA list. Granting TA role.")
            else:
                role = data.get("role", default_role)
            
            user = User(email=email, role=role)
            user.is_admin = user_is_admin # [수정] 생성 후 is_admin 속성 설정
            db.session.add(user)
        
        # [수정] 기존 사용자가 가입 시도 시, Admin/TA 리스트에 새로 추가되었는지 확인
        if email in PREDEFINED_ADMIN_LIST:
            user.is_admin = True
            user.role = "ta" # TA 역할도 부여
        elif email in PREDEFINED_TA_LIST:
            user.role = "ta"

        user.set_password(password) # 비밀번호 저장
        user.is_verified = False    # 미인증 상태로 설정
        
        otp_code = _generate_otp()
        user.set_verification_code(otp_code) # 인증 코드 저장
        
        db.session.commit()
        
        _send_otp_email(email, otp_code, subject_prefix="[AITA] 회원가입 인증")
        
        return jsonify({"message": f"{email}로 인증 코드를 발송했습니다. 이메일을 확인해 회원가입을 완료해주세요."}), 200
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /register: {e}")
        traceback.print_exc()
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500

@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """
    POST /api/auth/verify-email
    회원가입 시 받은 OTP(인증 코드)를 검증하여 계정을 활성화합니다.
    성공 시 JWT 토큰을 발급하지 않습니다. (로그인은 /login 에서)
    """
    data = request.json
    email = data.get("email", "").lower()
    code = data.get("code")

    if not email or not code:
        return jsonify({"error": "이메일과 인증 코드를 모두 입력해야 합니다."}), 400

    try:
        user = User.query.filter_by(email=email).first()

        if not user:
             return jsonify({"error": "등록되지 않은 이메일입니다."}), 404

        if user.is_verified:
            return jsonify({"message": "이미 인증된 계정입니다. 바로 로그인해주세요."}), 200

        if not user.check_verification_code(code):
            print(f"[Auth] Failed email verification for {email}.")
            time.sleep(1) 
            return jsonify({"error": "인증 코드가 잘못되었거나 만료되었습니다."}), 401
            
        # [성공] 사용자 인증 처리
        print(f"[Auth] Email verification successful for {email}.")
        user.verify_user() # is_verified=True로 변경, 코드/만료 시간 삭제
        db.session.commit()
        
        return jsonify({"message": "이메일 인증에 성공했습니다. 이제 비밀번호로 로그인할 수 있습니다."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /verify-email: {e}")
        traceback.print_exc() 
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500


@auth_bp.route("/login", methods=["POST"])
def login_with_password():
    """
    POST /api/auth/login
    이메일, 비밀번호로 로그인하고 JWT를 발급받습니다.
    'is_verified=True'인 사용자만 로그인을 허용합니다.
    """
    data = request.json
    email = data.get("email", "").lower()
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "이메일과 비밀번호를 입력해야 합니다."}), 400

    user = User.query.filter_by(email=email).first()

    # 1. 사용자가 없는 경우
    if not user:
        return jsonify({"error": "이메일 또는 비밀번호가 잘못되었습니다."}), 401
        
    # 2. 이메일 인증이 완료되지 않은 경우
    if not user.is_verified:
         return jsonify({
            "error": "계정이 인증되지 않았습니다.",
            "message": "이메일 인증을 먼저 완료해주세요. (인증 메일을 받지 못했다면 /register 를 다시 시도하세요)"
        }), 403 

    # 3. 비밀번호가 설정되지 않은 사용자(이전 OTP 방식)이거나
    if not user.password_hash:
        return jsonify({
            "error": "비밀번호가 설정되지 않은 계정입니다.",
            "message": "계정 생성 시 오류가 있었을 수 있습니다. /register를 다시 시도해주세요."
        }), 401

    # 4. 비밀번호가 틀린 경우
    if not user.check_password(password):
        return jsonify({"error": "이메일 또는 비밀번호가 잘못되었습니다."}), 401
        
    # 5. 로그인 성공
    try:
        token_expires_delta = timedelta(hours=1) 
        if user.email == DEV_EMAIL:
            token_expires_delta = False
            print(f"[Auth] Issuing non-expiring token for DEV_EMAIL: {user.email}")

        # [수정] is_admin 플래그를 클레임에 추가
        additional_claims = {
            "role": user.role, 
            "email": user.email,
            "is_admin": user.is_admin 
        }
        
        access_token = create_access_token(
            identity=str(user.id), 
            additional_claims=additional_claims,
            expires_delta=token_expires_delta 
        )
        
        user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
        db.session.commit()
        
        return jsonify({
            "message": "로그인에 성공했습니다.",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "is_admin": user.is_admin # [수정] 응답에도 추가
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /login: {e}")
        return jsonify({"error": "토큰 발급 중 오류가 발생했습니다."}), 500

# --- 4. [v4 신규] 개발자용 토큰 발급 엔드포인트 ---

@auth_bp.route("/dev-token", methods=["POST"])
def get_dev_token():
    """
    POST /api/auth/dev-token
    [v4 신규] 개발용 비밀 키를 받아, 만료 기간 없는 개발자용 JWT 토큰을 발급합니다.
    DEV_EMAIL 계정이 없으면 'ta' 권한으로 자동 생성합니다.
    """
    data = request.json
    secret_key = data.get("secret_key")

    if not secret_key:
        return jsonify({"error": "비밀 키가 필요합니다."}), 400

    # 1. 하드코딩된 비밀 키와 일치하는지 확인
    if secret_key != DEV_SECRET_KEY:
        return jsonify({"error": "유효하지 않은 개발용 비밀 키입니다."}), 401
    
    print(f"[Auth] Valid DEV_SECRET_KEY received. Issuing dev token.")

    try:
        # 2. DEV_EMAIL 사용자를 찾거나 생성 (TA 권한, 자동 인증)
        user = User.query.filter_by(email=DEV_EMAIL).first()
        
        if not user:
            print(f"[Auth] Creating new dev user: {DEV_EMAIL}")
            user = User(email=DEV_EMAIL, role="ta")
            user.set_password("dev_password_placeholder") # (임시 비밀번호)
            user.is_verified = True # (개발용이므로 즉시 인증)
            user.is_admin = True
            db.session.add(user)
            db.session.commit()
        
        # 3. 만료 기간 없는 토큰 발급
        additional_claims = {"role": user.role, "email": user.email}
        access_token = create_access_token(
            identity=str(user.id), 
            additional_claims=additional_claims,
            expires_delta=False # (만료 기간 없음)
        )
        
        return jsonify({
            "message": "개발용 토큰이 성공적으로 발급되었습니다. (만료 기간 없음)",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /dev-token: {e}")
        traceback.print_exc() 
        return jsonify({"error": "개발용 토큰 발급 중 서버 오류가 발생했습니다."}), 500


@auth_bp.route('/my-reports', methods=['GET']) # 또는 app.route(...)
@jwt_required()
def get_my_reports():
    """
    [신규 API] 현재 인증된 사용자가 제출한 모든 과제 리포트의 ID 목록을 반환합니다.
    가장 최근에 제출한 순서대로 정렬됩니다.
    """
    try:
        # 1. JWT 토큰에서 사용자 ID (identity)를 가져옵니다.
        current_user_id = get_jwt_identity()
        
        # 2. ID(PK)를 기준으로 DB에서 사용자를 찾습니다. (filter_by(email=...) 아님)
        user = User.query.get(current_user_id) 

        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # 3. (정상 동작)
        report_tuples = db.session.query(AnalysisReport.id)\
                                  .filter_by(user_id=user.id)\
                                  .order_by(AnalysisReport.created_at.desc())\
                                  .all()

        # 4. 쿼리 결과는 튜플의 리스트 [('id-1',), ('id-2',)] 형태이므로,
        #    ID 문자열만 추출하여 리스트 ['id-1', 'id-2']로 변환합니다.
        report_ids = [r[0] for r in report_tuples]

        # 5. 성공 응답을 JSON 형식으로 반환합니다.
        return jsonify({
            "message": "Successfully retrieved report list",
            "user_id": user.id,
            "report_count": len(report_ids),
            "report_ids": report_ids
        }), 200

    except Exception as e:
        # (선택 사항) 실제 운영 시에는 에러 로깅을 하는 것이 좋습니다.
        # current_app.logger.error(f"Error fetching reports for {current_user_email}: {e}")
        return jsonify({"error": "An internal server error occurred"}), 500
        
# /verify-login-code (삭제됨)
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc2MzEwODUyNCwianRpIjoiOGZmMDBkYWEtOTBhNS00MjA1LWJkOTUtMzUxYTllMjBkZTZkIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjMiLCJuYmYiOjE3NjMxMDg1MjQsImNzcmYiOiI5NmQ1M2I3NC1kYWI4LTRjNDUtYjczMy1iNjdkOGIzMTg1NDgiLCJyb2xlIjoidGEiLCJlbWFpbCI6ImRldkBzbnUuYWMua3IifQ.OZX6_ESx6-QCaYuZWBKxjwEa9KPrpaPdf3tYGCAY4A4
