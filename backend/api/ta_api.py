from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity

# 1. auth_api에서 ta_required 데코레이터 임포트
from api.auth_api import ta_required

ta_bp = Blueprint('ta_api', __name__)

@ta_bp.route("/dashboard", methods=["GET"])
@ta_required() # 2. @jwt_required() 대신 사용 (내부적으로 @jwt_required 호출)
def get_ta_dashboard():
    """
    TA만 접근 가능한 대시보드 데이터
    """
    current_user_id = get_jwt_identity() # TA의 user_id
    
    # (TODO: DB에서 TA 관련 데이터 조회)
    # 예: 모든 학생의 분석 리포트 목록 조회
    
    return jsonify({
        "message": "TA 대시보드에 오신 것을 환영합니다.",
        "ta_user_id": current_user_id,
        "student_reports": [
            {"student_email": "student1@snu.ac.kr", "report_id": "uuid-1"},
            {"student_email": "student2@snu.ac.kr", "report_id": "uuid-2"},
        ]
    })