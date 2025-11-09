import datetime
from app import db # app.py에서 생성된 db 객체를 임포트
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    """
    사용자 모델 (DB 테이블)
    @snu.ac.kr 이메일 인증 및 역할(학생/조교) 관리를 담당합니다.
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    
    # 'student' 또는 'ta' (조교)
    role = db.Column(db.String(10), nullable=False, default='student')
    
    # --- 인증 코드 관련 ---
    # (실제 코드가 아닌 해시된 코드를 저장)
    verification_code_hash = db.Column(db.String(128), nullable=True)
    code_expiry = db.Column(db.DateTime, nullable=True)
    
    # --- 상태 ---
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __init__(self, email, role='student'):
        if not email.endswith('@snu.ac.kr'):
            raise ValueError("서울대학교(@snu.ac.kr) 이메일만 가입할 수 있습니다.")
        self.email = email
        self.role = role
        self.is_verified = False # 기본값은 미인증

    def set_verification_code(self, code):
        """인증 코드를 해시하여 DB에 저장"""
        # (10분 유효기간)
        self.code_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        self.verification_code_hash = generate_password_hash(code)

    def check_verification_code(self, code):
        """제출된 코드가 유효한지 (기간 만료 + 값 일치) 확인"""
        if self.code_expiry is None or datetime.datetime.utcnow() > self.code_expiry:
            # 기간 만료
            return False
        
        if self.verification_code_hash is None:
            return False
            
        return check_password_hash(self.verification_code_hash, code)

    def verify_user(self):
        """사용자를 '인증됨' 상태로 변경하고 코드 정보 삭제"""
        self.is_verified = True
        self.verification_code_hash = None
        self.code_expiry = None

    def __repr__(self):
        return f'<User {self.email} (Role: {self.role})>'
