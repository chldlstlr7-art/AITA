import datetime
import re
import uuid
from extensions import db 
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.types import Uuid # UUID 타입을 위해
from sqlalchemy.dialects.postgresql import JSONB # (선택) PostgreSQL의 경우 JSON보다 효율적
import json
class User(db.Model):
    """
    사용자 모델 (DB 테이블)
    @snu.ac.kr 이메일 인증 및 역할(학생/조교) 관리를 담당합니다.
    """
    # [수정] AnalysisReport의 'user.id'와 맞추기 위해 'users' -> 'user'
    __tablename__ = 'user' 
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    
    # 'student' 또는 'ta' (조교)
    role = db.Column(db.String(10), nullable=False, default='student')
    
    # --- 인증 코드 관련 ---
    verification_code_hash = db.Column(db.String(128), nullable=True)
    code_expiry = db.Column(db.DateTime, nullable=True)
    
    # --- 상태 ---
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    # [수정] DB의 기본 시간 함수를 사용하는 것을 권장
    created_at = db.Column(db.DateTime, server_default=db.func.now()) 
    last_login = db.Column(db.DateTime, onupdate=db.func.now(), nullable=True)

    # --- [신규] 1:N 관계 설정 ---
    # User가 삭제되면, 연관된 Report도 모두 삭제 (cascade)
    reports = db.relationship('AnalysisReport', back_populates='user', lazy=True, cascade="all, delete-orphan")
    # --- [신규] ---

    def __init__(self, email, role='student'):
        # [수정] 정규표현식으로 더 정확하게 검증 (기존 제안 반영)
        if not re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email.lower()):
            raise ValueError("유효한 @snu.ac.kr 이메일이 아닙니다.")
        self.email = email.lower()
        self.role = role
        self.is_verified = False # 기본값은 미인증

    def set_verification_code(self, code):
        """인증 코드를 해시하여 DB에 저장 (UTC 기준)"""
        # (10분 유효기간)
        self.code_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=1000)
        self.verification_code_hash = generate_password_hash(code)

    def check_verification_code(self, code):
        """제출된 코드가 유효한지 (기간 만료 + 값 일치) 확인 (UTC 기준)"""
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
        self.last_login = datetime.datetime.now(datetime.timezone.utc)

    def __repr__(self):
        return f'<User {self.email} (Role: {self.role})>'


# --- [신규] 분석 결과를 저장할 모델 ---

class AnalysisReport(db.Model):
    __tablename__ = 'analysis_report'

    # Core Info
    # [수정] UUID를 기본 키로 사용
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status = db.Column(db.String(30), nullable=False, default='processing') # processing, processing_analysis, processing_questions, completed, error
    original_filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    # [신규] User 모델과의 연결 (Foreign Key)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    user = db.relationship('User', back_populates='reports')

    # Analysis Data (복잡한 데이터는 JSON 타입으로 저장)
    # (DB가 PostgreSQL이면 db.JSON 대신 JSONB를 권장합니다)
    summary = db.Column(db.Text, nullable=True)
    evaluation = db.Column(db.Text, default=json.dumps({}))
    logic_flow = db.Column(db.Text, default=json.dumps({}))
    similarity_details = db.Column(db.Text, nullable=True)
    text_snippet = db.Column(db.Text, nullable=True)
    
    # QA Data
    questions_pool = db.Column(db.Text, default=json.dumps([]))
    qa_history = db.Column(db.Text, default=json.dumps([]))
    
    # State Management
    is_refilling = db.Column(db.Boolean, default=False)
    error_message = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<AnalysisReport {self.id} (User {self.user_id})>'