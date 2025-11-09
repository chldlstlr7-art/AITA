import datetime
import random
import string
import re
import time
import traceback
import os # os.environ.get()을 위해 추가
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from flask_mail import Message

# (순환 참조 방지) app.py에서 생성된 확장 객체들을 함수 내부에서 임포트
# from app import db, mail
# from models import User

# app.py에서 url_prefix='/api/auth'로 등록될 것이므로, 여기서는 prefix가 없습니다.
auth_bp = Blueprint('auth_api', __name__)

def generate_otp(length=6):
    """6자리 숫자 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=length))

def is_valid_snu_email(email):
    """이메일 형식이 @snu.ac.kr인지 확인"""
    if not email:
        return False
    # 표준 @snu.ac.kr 이메일 형식 검증
    return re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email) is not None


@auth_bp.route('/request-login-code', methods=['POST'])
def request_login_code():
    """
    POST /api/auth/request-login-code
    사용자의 @snu.ac.kr 이메일을 받아 인증 코드를 발송합니다.
    """
    # (순환 참조 방지) 함수가 호출될 때 app의 객체들을 임포트
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
            # 우선은 이메일 도메인만 보고 역할을 'student'로 고정
            user = User(email=email, role='student')
            db.session.add(user)
        
        # 2. 인증 코드 생성 및 DB 저장
        otp_code = generate_otp()
        user.set_verification_code(otp_code) # 해시하여 DB에 저장
        
        db.session.commit()

        # 3. 이메일 발송
        print(f"[Auth] Sending OTP to {email}...")
        
        # config.py의 MAIL_DEFAULT_SENDER 값을 읽어옴
        sender_email = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))
        if not sender_email:
             print("[Auth] CRITICAL: MAIL_DEFAULT_SENDER is not set.")
             return jsonify({"error": "메일 서버 설정 오류입니다. (발신자 없음)"}), 500

        msg = Message(
            subject="[AITA] 서울대학교 인증 코드",
            sender=sender_email, # 발신자
            recipients=[email]  # 수신자
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
        return jsonify({"error": "서버 오류가 발생했습니다. (메일 발송 실패 등)"}), 500


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
            additional_claims=additional_claims,
            expires_delta=datetime.timedelta(hours=1) # 1시간 유효
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
