# ta_api.py (기존 파일에 이어서 추가)

import threading
import traceback # 백그라운드 작업 에러 로깅용 (기존 코드에 없었다면 추가)
from flask import Blueprint, request, jsonify, current_app, g # 'g' import 추가

# 1. 인증 데코레이터 (auth_api.py 파일에 정의되어 있다고 가정)
from .auth_api import ta_required

# 2. TA 서비스 로직 및 모델
from models import AnalysisReport, Course, Assignment, User # 모델 import 추가
from extensions import db

# 3. 설정값 (프롬프트 템플릿)
try:
    from config import JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
except ImportError:
    print("[TA API] CRITICAL: config.py에서 프롬프트 템플릿을 불러올 수 없습니다.")
    JSON_SYSTEM_PROMPT = "DEFAULT_JSON_PROMPT"
    COMPARISON_SYSTEM_PROMPT = "DEFAULT_COMPARISON_PROMPT"
    

# ----------------------------------------------------
# --- Blueprint 및 서비스 초기화 ---
# ----------------------------------------------------

ta_bp = Blueprint('ta_api', __name__)

# ----------------------------------------------------
# --- (기존) AI 리포트 분석 API ---
# ----------------------------------------------------

@ta_bp.route('/reports', methods=['GET'])
@ta_required()
def get_all_reports_overview():
    # ... (기존 코드와 동일) ...
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    try:
        overviews = current_app.analysis_ta_service.get_all_report_overviews()
        return jsonify({"reports": overviews}), 200
    except Exception as e:
        print(f"[TA API /reports] Error: {e}")
        return jsonify({"error": "리포트 목록 조회 중 서버 오류가 발생했습니다."}), 500

@ta_bp.route('/report/<report_id>', methods=['GET'])
@ta_required()
def get_detailed_report(report_id):
    # ... (기존 코드와 동일) ...
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    try:
        report_details = current_app.analysis_ta_service.get_detailed_report_analysis(report_id)
        if not report_details:
            return jsonify({"error": "리포트를 찾을 수 없습니다."}), 404
        return jsonify(report_details), 200
    except Exception as e:
        print(f"[TA API /report/{report_id}] Error: {e}")
        return jsonify({"error": "리포트 상세 조회 중 서버 오류가 발생했습니다."}), 500


@ta_bp.route('/analyze-batch', methods=['POST'])
@ta_required()
def trigger_batch_analysis():
    # ... (기존 코드와 동일) ...
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    data = request.json
    report_ids = data.get('report_ids')
    if not report_ids or not isinstance(report_ids, list):
        return jsonify({"error": "'report_ids' (list)가 필요합니다."}), 400
    
    app = current_app._get_current_object()

    def background_batch_task(app_context, ids_to_process):
        with app_context.app_context():
            try:
                print(f"[TA Batch] 백그라운드 분석 시작 (총 {len(ids_to_process)}개)...")
                
                # [수정] 스레드 내에서 current_app 프록시를 통해 중앙 서비스에 접근합니다.
                service = current_app.analysis_ta_service
                if not service:
                    print(f"[TA Batch] FAILED: 스레드 내에서 서비스를 찾을 수 없습니다.")
                    return

                service.run_batch_analysis_for_ta(ids_to_process)
                print(f"[TA Batch] 백그라운드 분석 완료.")
            except Exception as e:
                print(f"[TA Batch] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc()

    thread = threading.Thread(
        target=background_batch_task,
        args=(app, report_ids)
    )
    thread.daemon = True
    thread.start()

    return jsonify({
        "message": f"총 {len(report_ids)}개의 리포트에 대한 일괄 분석 작업을 백그라운드에서 시작했습니다."
    }), 202

# ----------------------------------------------------
# --- (신규) 과목 및 과제 관리 API ---
# ----------------------------------------------------

# --- 1. 과목 (Course) 관리 ---

@ta_bp.route('/courses', methods=['POST'])
@ta_required() # g.user (TA)가 로드되었다고 가정
def create_course():
    """ 1. 과목 생성 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        # @ta_required가 g.user에 현재 TA 유저 객체를 로드한다고 가정
        ta_user = g.user 
        course = current_app.course_service.create_course(data, ta_user)
        return jsonify({
            "message": "과목이 성공적으로 생성되었습니다.",
            "course": {"id": course.id, "course_code": course.course_code}
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses POST] Error: {e}")
        return jsonify({"error": "과목 생성 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>', methods=['PUT'])
@ta_required()
def update_course(course_id):
    """ 10. 과목 정보 수정 API """
    # (TODO: 이 TA가 해당 과목 조교인지 확인하는 로직 추가 필요)
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        course = current_app.course_service.update_course(course_id, data)
        return jsonify({
            "message": "과목 정보가 수정되었습니다.",
            "course": {"id": course.id, "course_name": course.course_name}
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404 # 404 (Not Found) or 400 (Bad Request)
    except Exception as e:
        print(f"[TA API /courses/{course_id} PUT] Error: {e}")
        return jsonify({"error": "과목 수정 중 서버 오류 발생"}), 500

# --- 2. 과제 (Assignment) 관리 ---

@ta_bp.route('/courses/<int:course_id>/assignments', methods=['POST'])
@ta_required()
def create_assignment(course_id):
    """ 2. 과제 생성 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        assignment = current_app.course_service.create_assignment(course_id, data)
        return jsonify({
            "message": "과제가 성공적으로 생성되었습니다.",
            "assignment_id": assignment.id
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id}/assignments POST] Error: {e}")
        return jsonify({"error": "과제 생성 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@ta_required()
def delete_assignment(assignment_id):
    """ 3. 과제 삭제 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        current_app.course_service.delete_assignment(assignment_id)
        return jsonify({"message": "과제가 삭제되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id} DELETE] Error: {e}")
        return jsonify({"error": "과제 삭제 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>', methods=['GET'])
@ta_required()
def get_assignment_details(assignment_id):
    """ 9. 과제 상세 정보 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        details = current_app.course_service.get_assignment_details(assignment_id)
        return jsonify(details), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id} GET] Error: {e}")
        return jsonify({"error": "과제 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/criteria', methods=['PUT'])
@ta_required()
def update_assignment_criteria(assignment_id):
    """ 4. 과제 평가 기준 설정 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    criteria_data = request.json
    try:
        current_app.course_service.update_assignment_criteria(assignment_id, criteria_data)
        return jsonify({"message": "평가 기준이 업데이트되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400 # 404(Not Found) or 400(Bad Data)
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/criteria PUT] Error: {e}")
        return jsonify({"error": "기준 설정 중 서버 오류 발생"}), 500

# --- 3. 학생 및 제출물 관리 ---

@ta_bp.route('/courses/<int:course_id>/students', methods=['GET'])
@ta_required()
def get_students(course_id):
    """ 5. 특정 과목 수강생 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        students = current_app.course_service.get_students_in_course(course_id)
        return jsonify({"students": students}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students GET] Error: {e}")
        return jsonify({"error": "학생 목록 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>/students', methods=['POST'])
@ta_required()
def add_student(course_id):
    """ 7. 학생 등록 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    student_email = data.get('email')
    if not student_email:
        return jsonify({"error": "학생 이메일이 필요합니다."}), 400
        
    try:
        student = current_app.course_service.add_student_to_course(course_id, student_email)
        return jsonify({
            "message": "학생이 과목에 등록되었습니다.",
            "student_id": student.id
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400 # 404(Not Found) or 400(Bad Request)
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students POST] Error: {e}")
        return jsonify({"error": "학생 등록 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>/students/<int:student_id>', methods=['DELETE'])
@ta_required()
def remove_student(course_id, student_id):
    """ 7. 학생 삭제 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        current_app.course_service.remove_student_from_course(course_id, student_id)
        return jsonify({"message": "학생이 과목에서 제외되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400 # 404(Not Found) or 400(Bad Request)
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students/{student_id} DELETE] Error: {e}")
        return jsonify({"error": "학생 삭제 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/submissions', methods=['GET'])
@ta_required()
def get_submissions(assignment_id):
    """ 6. 특정 과제 제출물 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        submissions = current_app.course_service.get_submissions_for_assignment(assignment_id)
        return jsonify({"submissions": submissions}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/submissions GET] Error: {e}")
        return jsonify({"error": "제출물 조회 중 서버 오류 발생"}), 500

# --- 4. 채점 및 통계 API ---

@ta_bp.route('/reports/<string:report_id>/grade', methods=['POST'])
@ta_required()
def grade_submission(report_id):
    """ 8. 채점 및 피드백 입력 API """
    # (주의: report_id는 UUID(string)이므로 <string:report_id> 사용)
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    grade_data = request.json # {"feedback": "...", "score_details": {...}}
    if not grade_data:
        return jsonify({"error": "채점 데이터가 필요합니다."}), 400
        
    try:
        current_app.course_service.grade_submission(report_id, grade_data)
        return jsonify({"message": "채점 및 피드백이 저장되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /reports/{report_id}/grade POST] Error: {e}")
        return jsonify({"error": "채점 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/stats', methods=['GET'])
@ta_required()
def get_assignment_stats(assignment_id):
    """ 11. 과제별 통계 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        stats = current_app.course_service.get_assignment_stats(assignment_id)
        return jsonify(stats), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/stats GET] Error: {e}")
        return jsonify({"error": "통계 조회 중 서버 오류 발생"}), 500


@ta_bp.route('/reports/<string:report_id>/auto-grade', methods=['POST'])
@ta_required()
def trigger_auto_grading(report_id):
    """
    POST /api/ta/reports/<report_id>/auto-grade
    TA가 특정 리포트에 대해 'AI 자동 채점'을 실행하도록 요청합니다.
    (수정: app.py의 중앙 서비스 로더를 사용하도록 변경)
    """
    
    # 1. app.py에서 초기화된 grading_service를 가져옵니다.
    grading_service = current_app.grading_service
    
    if not grading_service:
        return jsonify({"error": "자동 채점 서비스가 초기화되지 않았습니다."}), 503

    # 2. 백그라운드 스레드에 넘겨줄 app 컨텍스트를 가져옵니다.
    app = current_app._get_current_object()

    def background_grading_task(app_context, report_id_to_grade):
        """백그라운드 스레드에서 자동 채점 실행"""
        # 3. 스레드 내부에서 app_context를 사용하여 다시 service를 로드해야 합니다.
        with app_context.app_context():
            try:
                print(f"[AutoGrade Task] Report {report_id_to_grade} 자동 채점 시작...")
                
                # 스레드 내에서 current_app 프록시를 통해 서비스에 접근
                service = current_app.grading_service 
                if not service:
                    print(f"[AutoGrade Task] FAILED: 스레드 내에서 서비스를 찾을 수 없습니다.")
                    return

                service.run_auto_grading(report_id_to_grade)
                print(f"[AutoGrade Task] Report {report_id_to_grade} 자동 채점 완료.")
            
            except Exception as e:
                print(f"[AutoGrade Task] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc() # 터미널에 상세 오류 출력

    # 4. 스레드 생성 및 시작
    thread = threading.Thread(
        target=background_grading_task,
        args=(app, report_id)
    )
    thread.daemon = True
    thread.start()

    # 5. [수정] API는 즉시 202 응답을 반환합니다. (이것이 누락되었음)
    return jsonify({
        "message": f"Report {report_id}에 대한 자동 채점 작업을 백그라운드에서 시작했습니다."
    }), 202



@ta_bp.route('/my-courses', methods=['GET'])
@ta_required()
def get_my_courses():
    """
    [신규] 내가(TA가) 속한 과목 목록 조회 API
    """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # @ta_required 데코레이터가 g.user에 TA 객체를 로드했다고 가정
        ta_user = g.user
        
        # 서비스 레이어 호출
        courses_list = current_app.course_service.get_courses_for_ta(ta_user.id)
        
        return jsonify({"courses": courses_list}), 200
        
    except ValueError as e:
        # 서비스에서 TA를 못찾는 등
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /my-courses GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과목 목록 조회 중 서버 오류 발생"}), 500