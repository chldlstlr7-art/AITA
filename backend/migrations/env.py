from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- [수정 1] Flask 앱, db 객체, 모델 임포트 ---
# -------------------------------------------------
# 이 스크립트가 'app'을 찾을 수 있도록 경로를 추가합니다.
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# [중요] app, db, models를 직접 임포트합니다.
from app import app  # Flask app 임포트
from extensions import db # db 객체 임포트
# Alembic이 감지해야 할 모든 모델을 임포트합니다.
from models import User, Course, Assignment, AnalysisReport, course_enrollment, course_assistant
# -------------------------------------------------


# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# --- [수정 2] Flask 앱의 DB 설정을 Alembic에 적용 ---
# -------------------------------------------------
# 이것이 SQLite/PostgreSQL 오류를 해결하는 핵심입니다.
# app.config['SQLALCHEMY_DATABASE_URI'] 값을 읽어 Alembic 설정에 덮어씁니다.
# (current_app을 사용하는 복잡한 get_engine_url() 함수는 필요 없습니다)
config.set_main_option("sqlalchemy.url", app.config.get('SQLALCHEMY_DATABASE_URI'))
# -------------------------------------------------

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata

# --- [수정 3] target_metadata를 db.metadata로 설정 ---
# -------------------------------------------------
# (current_app을 사용하는 복잡한 get_metadata() 함수는 필요 없습니다)
target_metadata = db.metadata
# -------------------------------------------------


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.
    (이 부분은 수정할 필요 없습니다)
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.
    (current_app 로직을 제거하고 단순화합니다)
    """
    
    # [수정 4] connectable을 Flask 앱의 엔진으로 교체
    # -------------------------------------------------
    # db 객체는 이미 extensions.py에서 임포트되었습니다.
    # db.engine은 app.config의 DB URI를 이미 알고 있습니다.
    connectable = db.engine
    # -------------------------------------------------

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
            # (current_app에서 가져오던 **conf_args 제거)
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()