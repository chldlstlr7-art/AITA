import threading
import traceback # 백그라운드 작업 에러 로깅용
from flask import Blueprint, request, jsonify, current_app, g
from .auth_api import ta_required

# (모델 import는 app.py에서 서비스를 주입하므로 여기서는 제거해도 되나,
#  g.user의 타입을 명확히 하기 위해 남겨둘 수 있습니다.)
from models import AnalysisReport, Course, Assignment, User 
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
    """ 3.1. TA 대시보드 (전체 리포트 개요) """
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    try:
        # [수정] TA 권한 필터링을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        overviews = current_app.analysis_ta_service.get_all_report_overviews(ta_user_id)
        return jsonify({"reports": overviews}), 200
    except Exception as e:
        print(f"[TA API /reports] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "리포트 목록 조회 중 서버 오류가 발생했습니다."}), 500

@ta_bp.route('/report/<report_id>', methods=['GET'])
@ta_required()
def get_detailed_report(report_id):
    """ 3.2. TA 리포트 상세 조회 """
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        report_details = current_app.analysis_ta_service.get_detailed_report_analysis(report_id, ta_user_id)
        if not report_details:
            return jsonify({"error": "리포트를 찾을 수 없거나 조회 권한이 없습니다."}), 404
        return jsonify(report_details), 200
    except Exception as e:
        print(f"[TA API /report/{report_id}] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "리포트 상세 조회 중 서버 오류가 발생했습니다."}), 500


@ta_bp.route('/analyze-batch', methods=['POST'])
@ta_required()
def trigger_batch_analysis():
    """ 3.3. 리포트 일괄 분석 (TA용) """
    if not current_app.analysis_ta_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
    data = request.json
    report_ids = data.get('report_ids')
    if not report_ids or not isinstance(report_ids, list):
        return jsonify({"error": "'report_ids' (list)가 필요합니다."}), 400
    
    app = current_app._get_current_object()
    ta_user_id = g.user.id # [수정] 권한 확인용 ID

    def background_batch_task(app_context, ids_to_process, ta_id):
        with app_context.app_context():
            try:
                print(f"[TA Batch] 백그라운드 분석 시작 (TA: {ta_id}, 총 {len(ids_to_process)}개)...")
                service = current_app.analysis_ta_service
                if not service:
                    print(f"[TA Batch] FAILED: 스레드 내에서 서비스를 찾을 수 없습니다.")
                    return
                
                # [수정] 서비스가 TA ID를 받아 권한 확인 후 실행
                service.run_batch_analysis_for_ta(ids_to_process, ta_id)
                print(f"[TA Batch] 백그라운드 분석 완료.")
            except Exception as e:
                print(f"[TA Batch] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc()

    thread = threading.Thread(
        target=background_batch_task,
        args=(app, report_ids, ta_user_id) # [수정] ta_user_id 전달
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
@ta_required()
def create_course():
    """ 3.4. 과목 생성 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        ta_user = g.user 
        course = current_app.course_service.create_course(data, ta_user)
        return jsonify({
            "message": "과목이 성공적으로 생성되었습니다.",
            "course": {"id": course.id, "course_code": course.course_code, "course_name": course.course_name}
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses POST] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과목 생성 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>', methods=['PUT'])
@ta_required()
def update_course(course_id):
    """ 3.5. 과목 정보 수정 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        course = current_app.course_service.update_course(course_id, data, ta_user_id)
        return jsonify({
            "message": "과목 정보가 수정되었습니다.",
            "course": {"id": course.id, "course_name": course.course_name, "course_code": course.course_code}
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id} PUT] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과목 수정 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>', methods=['DELETE'])
@ta_required()
def delete_course(course_id):
    """ [신규] 과목 삭제 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        ta_user_id = g.user.id
        current_app.course_service.delete_course(course_id, ta_user_id)
        return jsonify({"message": f"과목(ID: {course_id})이(가) 삭제되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id} DELETE] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과목 삭제 중 서버 오류 발생"}), 500

@ta_bp.route('/my-courses', methods=['GET'])
@ta_required()
def get_my_courses():
    """ 3.6. TA 본인 과목 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        ta_user_id = g.user.id
        courses_list = current_app.course_service.get_courses_for_ta(ta_user_id)
        return jsonify({"courses": courses_list}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /my-courses GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과목 목록 조회 중 서버 오류 발생"}), 500

# --- 2. 과제 (Assignment) 관리 ---

@ta_bp.route('/courses/<int:course_id>/assignments', methods=['POST'])
@ta_required()
def create_assignment(course_id):
    """ 3.7. 과제 생성 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        assignment = current_app.course_service.create_assignment(course_id, data, ta_user_id)
        return jsonify({
            "message": "과제가 성공적으로 생성되었습니다.",
            "assignment_id": assignment.id
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id}/assignments POST] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 생성 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>/assignments', methods=['GET'])
@ta_required()
def get_assignments_for_course(course_id):
    """ 3.8. [신규] 특정 과목의 모든 과제 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        assignments_list = current_app.course_service.get_assignments_for_course(course_id, ta_user_id)
        return jsonify({"assignments": assignments_list}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /courses/{course_id}/assignments GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 목록 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@ta_required()
def delete_assignment(assignment_id):
    """ 3.9. 과제 삭제 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        current_app.course_service.delete_assignment(assignment_id, ta_user_id)
        return jsonify({"message": "과제가 삭제되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id} DELETE] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 삭제 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>', methods=['GET'])
@ta_required()
def get_assignment_details(assignment_id):
    """ 3.10. 과제 상세 정보 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        details = current_app.course_service.get_assignment_details(assignment_id, ta_user_id)
        return jsonify(details), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id} GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>', methods=['PUT'])
@ta_required()
def update_assignment(assignment_id):
    """ [신규] 과제 정보 수정 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    if not data:
        return jsonify({"error": "수정할 데이터가 필요합니다."}), 400
        
    try:
        ta_user_id = g.user.id
        assignment = current_app.course_service.update_assignment(assignment_id, data, ta_user_id)
        
        return jsonify({
            "message": "과제 정보가 수정되었습니다.",
            "assignment": {
                "id": assignment.id, 
                "assignment_name": assignment.assignment_name,
                "description": assignment.description,
                "due_date": assignment.due_date.isoformat() if assignment.due_date else None
            }
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id} PUT] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "과제 정보 수정 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/criteria', methods=['GET'])
@ta_required()
def get_assignment_criteria(assignment_id):
    """ [신규] 과제 평가 기준 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        ta_user_id = g.user.id
        criteria = current_app.course_service.get_assignment_criteria(assignment_id, ta_user_id)
        return jsonify(criteria), 200 
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/criteria GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "평가 기준 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/criteria', methods=['PUT'])
@ta_required()
def update_assignment_criteria(assignment_id):
    """ 3.11. 과제 평가 기준 설정 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    criteria_data = request.json
    if not criteria_data:
         return jsonify({"error": "기준 데이터가 필요합니다."}), 400

    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        current_app.course_service.update_assignment_criteria(assignment_id, criteria_data, ta_user_id)
        return jsonify({"message": "평가 기준이 업데이트되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/criteria PUT] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "기준 설정 중 서버 오류 발생"}), 500

# --- 3. 학생 및 제출물 관리 ---

@ta_bp.route('/courses/<int:course_id>/students', methods=['GET'])
@ta_required()
def get_students(course_id):
    """ 3.12. 특정 과목 수강생 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        students = current_app.course_service.get_students_in_course(course_id, ta_user_id)
        return jsonify({"students": students}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "학생 목록 조회 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>/students', methods=['POST'])
@ta_required()
def add_student(course_id):
    """ 3.13. 학생 등록 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    data = request.json
    student_email = data.get('email')
    if not student_email:
        return jsonify({"error": "학생 이메일이 필요합니다."}), 400
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        student = current_app.course_service.add_student_to_course(course_id, student_email, ta_user_id)
        return jsonify({
            "message": "학생이 과목에 등록되었습니다.",
            "student_id": student.id
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students POST] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "학생 등록 중 서버 오류 발생"}), 500

@ta_bp.route('/courses/<int:course_id>/students/<int:student_id>', methods=['DELETE'])
@ta_required()
def remove_student(course_id, student_id):
    """ 3.14. 학생 삭제 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        current_app.course_service.remove_student_from_course(course_id, student_id, ta_user_id)
        return jsonify({"message": "학생이 과목에서 제외되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /courses/{course_id}/students/{student_id} DELETE] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "학생 삭제 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/submissions', methods=['GET'])
@ta_required()
def get_submissions(assignment_id):
    """ 3.15. 특정 과제 제출물 목록 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        submissions = current_app.course_service.get_submissions_for_assignment(assignment_id, ta_user_id)
        return jsonify({"submissions": submissions}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/submissions GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "제출물 조회 중 서버 오류 발생"}), 500

# --- 4. 채점 및 통계 API ---

@ta_bp.route('/reports/<string:report_id>/grade', methods=['POST'])
@ta_required()
def grade_submission(report_id):
    """ 3.16. 채점 및 피드백 입력 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    grade_data = request.json 
    if not grade_data:
        return jsonify({"error": "채점 데이터가 필요합니다."}), 400
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        current_app.course_service.grade_submission(report_id, grade_data, ta_user_id)
        return jsonify({"message": "채점 및 피드백이 저장되었습니다."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /reports/{report_id}/grade POST] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "채점 중 서버 오류 발생"}), 500

@ta_bp.route('/assignments/<int:assignment_id>/stats', methods=['GET'])
@ta_required()
def get_assignment_stats(assignment_id):
    """ 3.17. 과제별 통계 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503
        
    try:
        # [수정] TA 권한 확인을 위해 ta_user_id 전달
        ta_user_id = g.user.id
        stats = current_app.course_service.get_assignment_stats(assignment_id, ta_user_id)
        return jsonify(stats), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        print(f"[TA API /assignments/{assignment_id}/stats GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "통계 조회 중 서버 오류 발생"}), 500


@ta_bp.route('/reports/<string:report_id>/auto-grade', methods=['POST'])
@ta_required()
def trigger_auto_grading(report_id):
    """ 3.18. 리포트 자동 채점 실행 """
    grading_service = current_app.grading_service
    if not grading_service:
        return jsonify({"error": "자동 채점 서비스가 초기화되지 않았습니다."}), 503

    app = current_app._get_current_object()
    ta_user_id = g.user.id # [수정] 권한 확인용

    def background_grading_task(app_context, report_id_to_grade, ta_id):
        with app_context.app_context():
            try:
                print(f"[AutoGrade Task] Report {report_id_to_grade} 자동 채점 시작 (요청: TA {ta_id})...")
                service = current_app.grading_service 
                if not service:
                    print(f"[AutoGrade Task] FAILED: 스레드 내에서 서비스를 찾을 수 없습니다.")
                    return

                # [수정] 서비스가 TA ID를 받아 리포트 조회 권한 확인 후 실행
                service.run_auto_grading(report_id_to_grade, ta_id)
                print(f"[AutoGrade Task] Report {report_id_to_grade} 자동 채점 완료.")
            except Exception as e:
                print(f"[AutoGrade Task] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc() 

    thread = threading.Thread(
        target=background_grading_task,
        args=(app, report_id, ta_user_id) # [수정] ta_user_id 전달
    )
    thread.daemon = True
    thread.start()

    return jsonify({
        "message": f"Report {report_id}에 대한 자동 채점 작업을 백그라운드에서 시작했습니다."
    }), 202


@ta_bp.route('/assignments/<int:assignment_id>/bulk-auto-grade', methods=['POST'])
@ta_required()
def trigger_bulk_auto_grading(assignment_id):
    """ 3.19. [신규] 과제 일괄 자동 채점 실행 """
    grading_service = current_app.grading_service
    if not grading_service:
        return jsonify({"error": "자동 채점 서비스가 초기화되지 않았습니다."}), 503

    app = current_app._get_current_object()
    ta_user_id = g.user.id # [수정] 권한 확인용

    def background_bulk_grading_task(app_context, assign_id, ta_id):
        with app_context.app_context():
            try:
                print(f"[BulkAutoGrade Task] Assignment {assign_id} 일괄 채점 시작 (요청: TA {ta_id})...")
                service = current_app.grading_service 
                if not service:
                    print(f"[BulkAutoGrade Task] FAILED: 스레드 내에서 서비스를 찾을 수 없습니다.")
                    return

                # [수정] 서비스가 TA ID를 받아 과제 권한 확인 후 실행
                service.run_bulk_auto_grading(assign_id, ta_id)
                
                print(f"[BulkAutoGrade Task] Assignment {assign_id} 일괄 채점 완료.")
            except Exception as e:
                print(f"[BulkAutoGrade Task] CRITICAL ERROR: 백그라운드 작업 실패: {e}")
                traceback.print_exc() 

    thread = threading.Thread(
        target=background_bulk_grading_task,
        args=(app, assignment_id, ta_user_id) # [수정] ta_user_id 전달
    )
    thread.daemon = True
    thread.start()

    return jsonify({
        "message": f"Assignment {assignment_id}에 대한 일괄 자동 채점 작업을 백그라운드에서 시작했습니다."
    }), 202

@ta_bp.route('/reports/<string:report_id>/auto-grade-result', methods=['GET'])
@ta_required()
def get_auto_grading_result(report_id):
    """ 3.20. AI 자동 채점 결과 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    try:
        ta_user_id = g.user.id
        result = current_app.course_service.get_auto_grading_result(report_id, ta_user_id)
        if not result:
            return jsonify({"error": "자동 채점 결과를 찾을 수 없거나 조회 권한이 없습니다."}), 404
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /reports/{report_id}/auto-grade-result GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "자동 채점 결과 조회 중 서버 오류 발생"}), 500


@ta_bp.route('/reports/<string:report_id>/ta-grade', methods=['GET'])
@ta_required()
def get_ta_grading_result(report_id):
    """ 3.21. TA 채점 및 피드백 조회 API """
    if not current_app.course_service:
        return jsonify({"error": "서비스가 초기화되지 않았습니다."}), 503

    try:
        ta_user_id = g.user.id
        result = current_app.course_service.get_ta_grading_result(report_id, ta_user_id)
        if not result:
            return jsonify({"error": "TA 채점 데이터를 찾을 수 없거나 조회 권한이 없습니다."}), 404
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[TA API /reports/{report_id}/ta-grade GET] Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "TA 채점 데이터 조회 중 서버 오류 발생"}), 500
