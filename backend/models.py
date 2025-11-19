import re
import uuid
from extensions import db 
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone, timedelta 
import json

# --- 1. User 모델 (수정됨) ---

class User(db.Model):
    """
    사용자 모델 (DB 테이블)
    """
    __tablename__ = 'users' 
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    
    # [추가 1] 사용자 식별자 (선택 사항이지만 추천)
    username = db.Column(db.String(80), unique=True, nullable=True) 
    
    password_hash = db.Column(db.String(256), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='student')
    
    # [추가 2] 관리자 플래그 (관리자 기능 분리)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    # --- 인증 코드 관련 ---
    verification_code_hash = db.Column(db.String(128), nullable=True)
    code_expiry = db.Column(db.DateTime, nullable=True)
    
    # --- 상태 ---
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now()) 
    last_login = db.Column(db.DateTime, onupdate=db.func.now(), nullable=True)

    # --- 관계 설정 ---
    reports = db.relationship('AnalysisReport', back_populates='user', lazy=True, cascade="all, delete-orphan")

    def __init__(self, email, username=None, role='student'):
        if not re.match(r"^[a-zA-Z0-9._%+-]+@snu\.ac\.kr$", email.lower()):
            raise ValueError("유효한 @snu.ac.kr 이메일이 아닙니다.")
        self.email = email.lower()
        self.username = username
        self.role = role
        self.is_verified = False

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def set_verification_code(self, code):
        expires = datetime.now(timezone.utc) + timedelta(minutes=10) 
        self.code_expiry = expires.replace(tzinfo=None) 
        self.verification_code_hash = generate_password_hash(code)

    def check_verification_code(self, code):
        if self.code_expiry is None:
            return False
        current_time_naive_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        if current_time_naive_utc > self.code_expiry:
            return False
        if self.verification_code_hash is None:
            return False
        return check_password_hash(self.verification_code_hash, code)

    def verify_user(self):
        self.is_verified = True
        self.verification_code_hash = None
        self.code_expiry = None
        self.last_login = datetime.now(timezone.utc).replace(tzinfo=None) 

    def __repr__(self):
        return f'<User {self.email} (Role: {self.role})>'


# --- 2. AnalysisReport 모델 (수정됨) ---

class AnalysisReport(db.Model):
    """
    분석 리포트 저장을 위한 DB 모델
    """
    __tablename__ = 'analysis_reports'

    # --- 기본 식별자 ---
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False) 
    original_filename = db.Column(db.String(255))
    
    # [추가 3] 보고서 제목
    report_title = db.Column(db.String(255), nullable=True) 
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=True)
    deep_analysis_data = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # --- 상태 관리 ---
    status = db.Column(db.String(50), nullable=False, default='processing')
    error_message = db.Column(db.Text, nullable=True)
    is_test = db.Column(db.Boolean, nullable=False, default=False)

    # --- 사용자 피드백 ---
    # [추가 4] 사용자 평점
    user_rating = db.Column(db.Integer, nullable=True) 

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
    advancement_ideas = db.Column(db.Text, nullable=True)

    # {"scores": [{"criteria_id": "A", "score": 10}, ...], "total": 90}
    ta_score_details = db.Column(db.Text, nullable=True) 
    # [신규 추가] 자동 평가 시스템의 '참고용 점수'
    # 예: {"scores": [{"criteria_id": "A", "score": 8.5}, ...], "total": 85, "comment": "AI 분석 완료"}
    auto_score_details = db.Column(db.Text, nullable=True)
    
    # (피드백)를 위해 추가:
    ta_feedback = db.Column(db.Text, nullable=True)

    # --- 임베딩 및 유사도 ---
    embedding_keyconcepts_corethesis = db.Column(db.Text, nullable=True)
    embedding_keyconcepts_claim = db.Column(db.Text, nullable=True)
    high_similarity_candidates = db.Column(db.Text, nullable=True)


    assignment = db.relationship('Assignment', back_populates='reports')

    # --- 역관계 설정 ---
    user = db.relationship('User', back_populates='reports')

    def __repr__(self):
        return f'<AnalysisReport {self.id} (User {self.user_id}) - {self.status}>'




class Course(db.Model):
    """
    과목 정보 관리 모델 (예: 소프트웨어 공학, 자료구조 등)
    """
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    course_code = db.Column(db.String(20), unique=True, nullable=False, index=True) # 예: CSE4001
    course_name = db.Column(db.String(100), nullable=False)
    
    # --- 관계 설정 ---
    # 수강 학생 (User.role='student')과의 관계: 다대다 매핑 테이블 필요
    students = db.relationship('User', secondary='course_enrollment', backref='courses_enrolled', lazy='dynamic')
    
    # 조교 (User.role='assistant' 또는 is_admin=True)와의 관계: 다대다 매핑 테이블 필요
    assistants = db.relationship('User', secondary='course_assistant', backref='courses_assisted', lazy='dynamic')
    
    # 과목별 과제 목록
    assignments = db.relationship('Assignment', back_populates='course', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Course {self.course_code}: {self.course_name}>'

# --- 다대다 관계를 위한 보조 테이블 (Association Tables) ---

# Course - Student (User)
course_enrollment = db.Table('course_enrollment',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('course_id', db.Integer, db.ForeignKey('courses.id'), primary_key=True)
)

# Course - Assistant (User)
course_assistant = db.Table('course_assistant',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('course_id', db.Integer, db.ForeignKey('courses.id'), primary_key=True)
)



class Assignment(db.Model):
    """
    과제 정보 및 TA 평가 기준 관리 모델
    """
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False) 
    assignment_name = db.Column(db.String(100), nullable=False)
    
    # 과제 설명 또는 요구사항
    description = db.Column(db.Text, nullable=True) 
    
    # TA로부터 입력받는 평가 기준 및 항목별 배점 (JSON 형태로 저장)
    # 예: {"criterion1": {"name": "논리적 흐름", "max_score": 30}, "criterion2": ...}
    grading_criteria = db.Column(db.Text, nullable=True) 
    
    due_date = db.Column(db.DateTime, nullable=True) 
    
    # --- 관계 설정 ---
    course = db.relationship('Course', back_populates='assignments')
    
    # 이 과제에 제출된 모든 리포트 목록
    reports = db.relationship('AnalysisReport', back_populates='assignment', lazy=True, cascade="all, delete-orphan")

    def get_criteria_dict(self):
        """grading_criteria를 딕셔너리로 변환하여 반환"""
        if self.grading_criteria:
            try:
                return json.loads(self.grading_criteria)
            except json.JSONDecodeError:
                return {}
        return {}
        
    def __repr__(self):
        return f'<Assignment {self.assignment_name} (Course {self.course_id})>'