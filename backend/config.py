import os

class Config:
    """
    Flask 애플리케이션 설정을 위한 기본 클래스.
    환경 변수(GitHub Secrets)에서 값을 불러옵니다.
    """
    
    # --- 1. Flask & JWT 비밀 키 ---
    # (터미널에서 python -c 'import secrets; print(secrets.token_hex(16))'로 생성)
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')

    # --- 2. 데이터베이스 설정 ---
    # (기본값: 'sqlite:///aita.db' - backend 폴더에 파일 생성)
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///aita.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- 3. [수정] 이메일(Gmail) 설정 ---
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
    
    # (예: aita.service@gmail.com)
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') 
    
    # (Gmail 16자리 앱 비밀번호)
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') 
    
    # (보내는 사람: "AITA 관리자 <aita.service@gmail.com>")
    # (기본값: MAIL_USERNAME과 동일하게 설정)
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))
