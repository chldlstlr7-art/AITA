# ta_api.py
import threading
from flask import Blueprint, request, jsonify, current_app

# 1. 인증 데코레이터 (auth_api.py 파일에 정의되어 있다고 가정)
from .auth_api import ta_required

# 2. TA 서비스 로직 및 모델
from models import AnalysisReport
from extensions import db
from services.analysis_ta_service import AnalysisTAService # 이전 단계에서 작성한 서비스

# 3. 설정값 (프롬프트 템플릿)
# (config.py 또는 앱 설정에서 프롬프트를 불러온다고 가정)
try:
    from config import JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
except ImportError:
    print("[TA API] CRITICAL: config.py에서 프롬프트 템플릿을 불러올 수 없습니다.")
    # 실제 운영 환경에서는 적절한 기본값 또는 설정 로딩이 필요합니다.
    JSON_SYSTEM_PROMPT = "DEFAULT_JSON_PROMPT"
    COMPARISON_SYSTEM_PROMPT = "DEFAULT_COMPARISON_PROMPT"


# ----------------------------------------------------
# --- Blueprint 및 서비스 초기화 ---
# ----------------------------------------------------

ta_bp = Blueprint('ta_api', __name__)

# [중요]
# AnalysisTAService는 앱 시작 시 1회 초기화되어야 합니다.
# (analysis_ta_service.py의 전역 모델 로딩이 완료된 후)
try:
    ta_service = AnalysisTAService(
        json_prompt_template=JSON_SYSTEM_PROMPT,
        comparison_prompt_template=COMPARISON_SYSTEM_PROMPT
    )
    print("[TA API] AnalysisTAService 초기화 완료.")
except Exception as e:
    print(f"[TA API] CRITICAL: AnalysisTAService 초기화 실패: {e}")
    ta_service = None

# ----------------------------------------------------
# --- TA API 엔드포인트 정의 ---
# ----------------------------------------------------

@ta_bp.route('/reports', methods=['GET'])
@ta_required()
def get_all_reports_overview():
    """
    GET /api/ta/reports
    TA 대시보드용: 현재까지 업로드된 모든 리포트의 개요 목록을 반환합니다.
    """
    if not ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503 # Service Unavailable

    try:
        overviews = ta_service.get_all_report_overviews()
        return jsonify({"reports": overviews}), 200
    except Exception as e:
        print(f"[TA API /reports] Error: {e}")
        return jsonify({"error": "리포트 목록 조회 중 서버 오류가 발생했습니다."}), 500

# ---

@ta_bp.route('/report/<int:report_id>', methods=['GET'])
@ta_required()
def get_detailed_report(report_id):
    """
    GET /api/ta/report/<report_id>
    특정 리포트의 상세 분석 결과(요약, 유사성 검사 결과 등)를 조회합니다.
    """
    if not ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    try:
        report_details = ta_service.get_detailed_report_analysis(report_id)
        
        if not report_details:
            return jsonify({"error": "리포트를 찾을 수 없습니다."}), 404
            
        return jsonify(report_details), 200
    except Exception as e:
        print(f"[TA API /report/{report_id}] Error: {e}")
        return jsonify({"error": "리포트 상세 조회 중 서버 오류가 발생했습니다."}), 500

# ---

@ta_bp.route('/analyze-batch', methods=['POST'])
@ta_required()
def trigger_batch_analysis():
    """
    POST /api/ta/analyze-batch
    TA가 선택한 리포트 ID 목록을 받아 백그라운드에서 일괄 분석을 실행(또는 재실행)합니다.
    Request Body: { "report_ids": [1, 5, 10] }
    """
    if not ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    data = request.json
    report_ids = data.get('report_ids')

    if not report_ids or not isinstance(report_ids, list):
        return jsonify({"error": "'report_ids' (list)가 필요합니다."}), 400

    # [중요] 일괄 분석은 시간이 오래 걸리므로 반드시 백그라운드 스레드로 실행합니다.
    # (Flask-APScheduler, Celery, RQ 등을 사용하는 것이 더 좋습니다.)
    
    # current_app._get_current_object()는 스레드에서 Flask 앱 컨텍스트를
    # 안전하게 사용하기 위해 필요합니다. (DB 접근 등)
    app = current_app._get_current_object()

    def background_batch_task(app_context, ids_to_process):
        """백그라운드 스레드에서 실행될 작업"""
        with app_context.app_context():
            try:
                print(f"[TA Batch] 백그라운드 분석 시작 (총 {len(ids_to_process)}개)...")
                # 서비스의 일괄 분석 함수 호출
                ta_service.run_batch_analysis_for_ta(ids_to_process)
                print(f"[TA Batch] 백그라운드 분석 완료.")
            except Exception as e:
                print(f"[TA Batch] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc()

    # 스레드 생성 및 시작
    thread = threading.Thread(
        target=background_batch_task,
        args=(app, report_ids)
    )
    thread.daemon = True # 메인 앱 종료 시 스레드도 종료
    thread.start()

    # API는 즉시 응답 (202 Accepted)
    return jsonify({
        "message": f"총 {len(report_ids)}개의 리포트에 대한 일괄 분석 작업을 백그라운드에서 시작했습니다."
    }), 202