import re
import uuid
from extensions import db 
from werkzeug.security import generate_password_hash, check_password_hash

# [수정] datetime, timezone, timedelta를 모두 임포트
from datetime import datetime, timezone, timedelta 

import json

# --- 1. User 모델 (AnalysisReport보다 먼저 정의) ---

class User(db.Model):
    """
    사용자 모델 (DB 테이블)
    @snu.ac.kr 이메일 인증 및 역할(학생/조교) 관리를 담당합니다.
    """
    # [수정 1] 'users' (복수)로 Foreign Key와 일치
    __tablename__ = 'users' 
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    
    # [신규] 비밀번호 해시 저장
    password_hash = db.Column(db.String(256), nullable=True) # 비밀번호(선택)
    
    role = db.Column(db.String(10), nullable=False, default='student')
    
    # --- 인증 코드 관련 ---
    verification_code_hash = db.Column(db.String(128), nullable=True)
    code_expiry = db.Column(db.DateTime, nullable=True) # Naive UTC 시간이 저장됨
    
    # --- 상태 ---
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now()) 
    last_login = db.Column(db.DateTime, onupdate=db.func.now(), nullable=True)

    # --- 관계 설정 ---
    reports = db.relationship('AnalysisReport', back_populates='user', lazy=True, cascade="all, delete-orphan")

    def __init__(self, email, role='student'):
        if not re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email.lower()):
            raise ValueError("유효한 @snu.ac.kr 이메일이 아닙니다.")
        self.email = email.lower()
        self.role = role
        self.is_verified = False

    def set_password(self, password):
        """[신규] 비밀번호를 해시하여 저장합니다."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """[신규] 비밀번호가 맞는지 확인합니다."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def set_verification_code(self, code):
        """인증 코드를 해시하여 DB에 저장 (Naive UTC 기준)"""
        
        # [수정 4] 유효 시간을 10분으로 수정
        expires = datetime.now(timezone.utc) + timedelta(minutes=10) 
        
        # [수정 1] Naive 객체로 변환하여 저장 (DB 호환성)
        self.code_expiry = expires.replace(tzinfo=None) 
        self.verification_code_hash = generate_password_hash(code)

    def check_verification_code(self, code):
        """제출된 코드가 유효한지 (기간 만료 + 값 일치) 확인 (Naive UTC 기준)"""
        if self.code_expiry is None:
            return False
            
        # [수정 2] Naive 객체(현재시간)와 Naive 객체(만료시간)를 비교
        current_time_naive_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        if current_time_naive_utc > self.code_expiry:
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
        
        # [수정 3] Naive 객체로 변환하여 저장
        self.last_login = datetime.now(timezone.utc).replace(tzinfo=None) 

    def __repr__(self):
        return f'<User {self.email} (Role: {self.role})>'


# --- 2. AnalysisReport 모델 ---

class AnalysisReport(db.Model):
    """
    분석 리포트 저장을 위한 DB 모델

    """
    __tablename__ = 'analysis_reports'

    # --- 기본 식별자 ---
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    original_filename = db.Column(db.String(255))
    
    # [수정 4] Naive UTC 시간을 기본값으로 사용
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # --- 상태 관리 ---
    status = db.Column(db.String(50), nullable=False, default='processing')
    error_message = db.Column(db.Text, nullable=True)
    is_test = db.Column(db.Boolean, nullable=False, default=False)

    # --- 원본 및 분석 데이터 (JSON 문자열로 저장) ---
    text_snippet = db.Column(db.Text)
    summary = db.Column(db.Text, nullable=True)
    similarity_details = db.Column(db.Text, nullable=True) 
    evaluation = db.Column(db.Text, nullable=True)
    logic_flow = db.Column(db.Text, nullable=True)

    # --- QA 및 상호작용 데이터 (JSON 문자열로 저장) ---
    qa_history = db.Column(db.Text, nullable=True)
    questions_pool = db.Column(db.Text, nullable=True)
    is_refilling = db.Column(db.Boolean, default=False)

    # --- advancement_ideas 필드 추가 ---
    
    advancement_ideas = db.Column(db.Text, nullable=True)


    # --- [신규] 임베딩 필드 (벡터를 JSON 문자열로 저장) ---
    embedding_keyconcepts_corethesis = db.Column(db.Text, nullable=True)
    embedding_keyconcepts_claim = db.Column(db.Text, nullable=True)

    # --- [신규] TA 오버뷰용 '최고 유사도' 요약 필드 ---
    high_similarity_candidates = db.Column(db.Text, nullable=True)

    # --- [기존] TA 오버뷰용 '최고 유사도' 요약 필드 (더 이상 사용되지 않음) ---
    # (대시보드 로딩 성능 최적화를 위함)
    # top_similarity_score = db.Column(db.Float, nullable=True, index=True)
    # top_similar_report_id = db.Column(db.String(36), nullable=True)
    # top_similar_filename = db.Column(db.String(255), nullable=True)

    # --- [수정] 'back_populates'를 위한 역관계 설정 ---
    user = db.relationship('User', back_populates='reports')

    def __repr__(self):
        return f'<AnalysisReport {self.id} (User {self.user_id}) - {self.status}>'