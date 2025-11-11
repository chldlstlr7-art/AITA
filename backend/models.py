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
    """
    분석 리포트 저장을 위한 DB 모델
    [업데이트] 2개의 임베딩 필드 추가
    """
    __tablename__ = 'analysis_reports'

    # --- 기본 식별자 ---
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) # User 모델이 있다면
    original_filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # --- 상태 관리 ---
    status = db.Column(db.String(50), nullable=False, default='processing') # e.g., processing, processing_analysis, processing_questions, completed, error
    error_message = db.Column(db.Text, nullable=True)
    
    # True이면, DB에는 저장되지만 다른 리포트의 '비교 대조군'으로는 사용되지 않음.
    is_test = db.Column(db.Boolean, nullable=False, default=False)

    # --- 원본 및 분석 데이터 (JSON 문자열로 저장) ---
    text_snippet = db.Column(db.Text) # 원본 텍스트 일부
    
    # [수정] 'summary'는 이제 LLM이 생성한 구조 분석 JSON을 저장합니다 (Core_Thesis, Claim 등)
    summary = db.Column(db.Text, nullable=True)
    
    # [수정] 'similarity_details'는 이제 LLM이 생성한 6개 항목 점수 리포트(들)을 JSON 리스트로 저장합니다
    similarity_details = db.Column(db.Text, nullable=True) 

    # (아래 필드들은 레거시이거나 단순화될 수 있으나, 일단 유지)
    evaluation = db.Column(db.Text, nullable=True) # (e.g., LLM 정밀 비교 결과를 확인하세요.)
    logic_flow = db.Column(db.Text, nullable=True) # (e.g., {})

    # --- QA 및 상호작용 데이터 (JSON 문자열로 저장) ---
    qa_history = db.Column(db.Text, nullable=True) # (e.g., [{"question_id": "...", "question": "...", "answer": "...", "parent_question_id": "..."}, ...])
    questions_pool = db.Column(db.Text, nullable=True) # (e.g., [{"question": "...", "type": "..."}, ...])
    is_refilling = db.Column(db.Boolean, default=False)

    # --- [신규] 임베딩 필드 (벡터를 JSON 문자열로 저장) ---
    embedding_keyconcepts_corethesis = db.Column(db.Text, nullable=True)
    embedding_keyconcepts_claim = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<AnalysisReport {self.id} (User {self.user_id}) - {self.status}>'
