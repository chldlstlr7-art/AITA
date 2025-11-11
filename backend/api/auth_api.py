import re
import random
import string
import os
import time
import traceback
from flask import Blueprint, request, jsonify
from flask_mail import Message
# [수정] create_access_token 외에 get_jwt, jwt_required 임포트
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
from datetime import datetime, timezone, timedelta
from functools import wraps

from models import User
from extensions import db, mail

# --- 1. '인증용' Blueprint 생성 ---
auth_bp = Blueprint('auth_api', __name__)

# --- 2. 헬퍼 함수 ---
def _generate_otp(length=6):
    """6자리 숫자 OTP 생성"""
    return "".join(random.choices(string.digits, k=length))

# [신규] @snu.ac.kr 형식 검증 헬퍼
def is_valid_snu_email(email):
    """이메일 형식이 @snu.ac.kr인지 확인"""
    if not email:
        return False
    return re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email) is not None

# [신규] 테스트용 OTP 출력 헬퍼
def _send_otp_email(email, otp):
    """ (테스트용) 실제 메일 발송 대신 터미널에 OTP 출력 """
    print("\n--- ⚠️  [TESTING] OTP ---")
    print(f"--- ⚠️  OTP for {email} is: {otp}  ⚠️ ---")
    print(f"[Auth] Sending OTP to {email}...")
    # 실제 mail.send(msg) 로직은 주석 처리
    print("[Auth] OTP sent successfully (Mock).\n")

# [신규] TA 권한 확인 데코레이터
def ta_required():
    """
    JWT 토큰의 'role' 클레임이 'ta'인지 확인하는 데코레이터.
    @jwt_required()가 이미 호출되었다고 가정합니다.
    """
    def wrapper(fn):
        @wraps(fn)
        @jwt_required() # 1. 유효한 JWT 토큰인지 먼저 확인
        def decorator(*args, **kwargs):
            # 2. 토큰에서 전체 클레임(payload) 가져오기
            claims = get_jwt()
            
            # 3. 'role' 클레임 확인
            if claims.get("role") == "ta":
                # 4. 'ta'가 맞으면 원래 함수 실행
                return fn(*args, **kwargs)
            else:
                # 5. 'ta'가 아니면 403 Forbidden 반환
                return jsonify({"error": "조교(TA) 권한이 필요합니다."}), 403
        return decorator
    return wrapper

# --- 3. [복구] 비밀번호 기반 인증 엔드포인트 ---

@auth_bp.route("/register", methods=["POST"])
def register_with_password():
    """
    POST /api/auth/register
    이메일, 비밀번호로 회원가입합니다. (컨텍스트 버전에서 복구)
    """
    data = request.json
    email = data.get("email", "").lower()
    password = data.get("password")
    role = data.get("role", "student")

    if not email or not password:
        return jsonify({"error": "이메일과 비밀번호를 모두 입력해야 합니다."}), 400
        
    if not is_valid_snu_email(email):
        return jsonify({"error": "유효한 @snu.ac.kr 이메일이 아닙니다."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "이미 가입된 이메일입니다."}), 409

    try:
        new_user = User(email=email, role=role)
        new_user.set_password(password) # 비밀번호 설정
        new_user.is_verified = True     # 비밀번호 가입은 즉시 인증
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({"message": f"{email} 계정이 성공적으로 생성되었습니다."}), 201
        
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /register: {e}")
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500

@auth_bp.route("/login", methods=["POST"])
def login_with_password():
    """
    POST /api/auth/login
    이메일, 비밀번호로 로그인하고 JWT를 발급받습니다. (컨텍스트 버전에서 복구)
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
        
    # 2. 비밀번호가 설정되지 않은 사용자(OTP 전용)인 경우
    if not user.password_hash:
        return jsonify({
            "error": "비밀번호가 설정되지 않은 계정입니다.",
            "message": "'이메일로 로그인하기' (OTP)를 이용해 주세요."
        }), 401

    # 3. 비밀번호가 틀린 경우
    if not user.check_password(password):
        return jsonify({"error": "이메일 또는 비밀번호가 잘못되었습니다."}), 401
        
    # 4. 로그인 성공
    try:
        # [수정] JWT에 'role', 'email' 클레임 추가 및 만료 시간 설정
        additional_claims = {"role": user.role, "email": user.email}
        access_token = create_access_token(
            identity=str(user.id), 
            additional_claims=additional_claims,
            expires_delta=timedelta(hours=1) # 1시간 유효
        )
        
        # 마지막 로그인 시간 업데이트
        user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
        db.session.commit()
        
        # [수정] 응답 형식 통일
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
        print(f"[Auth] Error in /login: {e}")
        return jsonify({"error": "토큰 발급 중 오류가 발생했습니다."}), 500

# --- 4. [유지] OTP 기반 인증 엔드포인트 ---

@auth_bp.route("/request-login-code", methods=["POST"])
def request_login_code():
    """
    POST /api/auth/request-login-code
    이메일을 받아 OTP를 발송합니다. 계정이 없으면 생성합니다.
    """
    data = request.json
    email = data.get("email", "").lower()

    if not is_valid_snu_email(email):
        return jsonify({"error": "유효한 @snu.ac.kr 이메일 주소를 입력해주세요."}), 400

    try:
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"[Auth] New user: {email}. Creating entry.")
            user = User(email=email, role='student')
            db.session.add(user)
            # (주의: 이 단계에서는 is_verified=False 상태)

        otp_code = _generate_otp()
        user.set_verification_code(otp_code) # 해시하여 DB에 저장
        
        db.session.commit()
        
        # [수정] 실제 메일 발송 로직 대신 테스트용 헬퍼 함수 호출
        _send_otp_email(email, otp_code)
        
        # [삭제] --- 실제 메일 발송 로직 (테스트를 위해 주석 처리) ---
        # print(f"[Auth] Sending OTP to {email}...")
        
        # sender_email = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))
        # if not sender_email:
        #      print("[Auth] CRITICAL: MAIL_DEFAULT_SENDER is not set.")
        #      return jsonify({"error": "메일 서버 설정 오류입니다. (발신자 없음)"}), 500

        # msg = Message(
        #     subject="[AITA] 서울대학교 인증 코드",
        #     sender=sender_email,
        #     recipients=[email]
        # )
        # msg.body = f"AITA 로그인 인증 코드는 [ {otp_code} ] 입니다. 10분 이내에 입력해주세요."
        
        # mail.send(msg)
        # print(f"[Auth] OTP sent successfully.")
        # --- [삭제 완료] ---
        
        return jsonify({"message": f"{email}로 인증 코드를 발송했습니다. 10분 이내에 확인해주세요."}), 200

    except ValueError as e:
        # (models.py의 이메일 형식 오류)
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        print(f"[Auth] Error in /request-login-code: {e}")
        traceback.print_exc() # [신규] 상세 오류 로깅
        return jsonify({"error": "서버 오류가 발생했습니다. (메일 발송 실패 등)"}), 500


@auth_bp.route("/verify-login-code", methods=["POST"])
def verify_login_code():
    """
    POST /api/auth/verify-login-code
    이메일과 OTP 코드를 받아 검증하고, 성공 시 JWT를 발급합니다.
    """
    data = request.json
    email = data.get("email", "").lower()
    code = data.get("code")

    if not email or not code:
        return jsonify({"error": "이메일과 코드를 모두 입력해야 합니다."}), 400

    try:
        user = User.query.filter_by(email=email).first()

        if not user or not user.check_verification_code(code):
            print(f"[Auth] Failed OTP verification for {email}.")
            time.sleep(1) # [신규] 무차별 대입 공격 방지 딜레이
            return jsonify({"error": "인증 코드가 잘못되었거나 만료되었습니다."}), 401
            
        # [성공] 사용자 인증 처리
        print(f"[Auth] Verification successful for {email}.")
        user.verify_user() # is_verified=True로 변경, 코드/만료 시간 삭제
        
        # [수정] JWT에 'role', 'email' 클레임 추가 및 만료 시간 설정
        additional_claims = {"role": user.role, "email": user.email}
        access_token = create_access_token(
            identity=str(user.id), 
            additional_claims=additional_claims,
            expires_delta=timedelta(hours=1) # 1시간 유효
        )
        
        db.session.commit()
        
        # [수정] 상세한 응답 반환
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
        traceback.print_exc() # [신규] 상세 오류 로깅
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500