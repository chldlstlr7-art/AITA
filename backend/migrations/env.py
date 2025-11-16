import logging
from logging.config import fileConfig

from flask import current_app

from alembic import context
# --- [수정 1] Flask 앱, db 객체, 모델 임포트 ---
# -------------------------------------------------
# 이 스크립트가 'app'을 찾을 수 있도록 경로를 추가합니다.
import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

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
# 이것이 SQLite 오류를 해결하는 핵심입니다.
# app.config['SQLALCHEMY_DATABASE_URI'] 값을 읽어 Alembic 설정에 덮어씁니다.
config.set_main_option("sqlalchemy.url", app.config.get('SQLALCHEMY_DATABASE_URI'))
# -------------------------------------------------

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')
# --- [수정 3] target_metadata를 db.metadata로 설정 ---
# -------------------------------------------------
target_metadata = db.metadata
# -------------------------------------------------


def get_engine():
    try:
        # this works with Flask-SQLAlchemy<3 and Alchemical
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        # this works with Flask-SQLAlchemy>=3
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace(
            '%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
config.set_main_option('sqlalchemy.url', get_engine_url())
target_db = current_app.extensions['migrate'].db

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_metadata():
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    return target_db.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=get_metadata(), literal_binds=True
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.zzzcomputing.com/en/latest/cookbook.html
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    conf_args = current_app.extensions['migrate'].configure_args
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    connectable = db.engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
