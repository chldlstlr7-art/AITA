from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_jwt_extended import JWTManager

# 앱에 연결되지 않은 순수 확장 객체를 생성합니다.
db = SQLAlchemy()
mail = Mail()
jwt = JWTManager()