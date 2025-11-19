import json
from datetime import datetime, timezone, timedelta
from extensions import db
from models import User, Course, Assignment, AnalysisReport, course_enrollment, course_assistant
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import joinedload
import traceback

class CourseManagementService:

    def create_course(self, data, assistant_user):
        """ 1. 과목 생성 (생성한 TA를 조교로 자동 등록) """
        course_code = data.get('course_code')
        course_name = data.get('course_name')
        
        if not course_code or not course_name:
            raise ValueError("과목 코드와 이름이 필요합니다.")
        
        existing = Course.query.filter_by(course_code=course_code).first()
        if existing:
            raise ValueError(f"과목 코드 '{course_code}'가 이미 존재합니다.")
            
        course = Course(course_code=course_code, course_name=course_name)
        
        # 과목을 생성한 TA를 조교(assistants)로 자동 추가
        course.assistants.append(assistant_user)
        
        db.session.add(course)
        db.session.commit()
        return course

    def update_course(self, course_id, data, ta_user_id):
        """ [수정] 10. 과목 정보 수정 (TA 권한 확인 추가) """
        course = self._get_course(course_id)
        
        # 1. TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        if 'course_name' in data:
            course.course_name = data['course_name']
        if 'course_code' in data:
            # 중복 체크
            existing = Course.query.filter(
                Course.course_code == data['course_code'],
                Course.id != course_id
            ).first()
            if existing:
                raise ValueError("다른 과목에서 이미 사용 중인 과목 코드입니다.")
            course.course_code = data['course_code']
            
        db.session.commit()
        return course

    def delete_course(self, course_id, ta_user_id):
        """ [신규] 과목 삭제 (TA 권한, 과제 존재 여부 확인) """
        course = self._get_course(course_id)
        
        # 1. TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        # 2. 안전 장치: 과목에 속한 과제가 있는지 확인
        assignment_count = db.session.query(Assignment.id).filter_by(course_id=course_id).count()
        if assignment_count > 0:
            raise ValueError(f"과목에 {assignment_count}개의 과제가 존재하여 삭제할 수 없습니다. 과제를 먼저 삭제해야 합니다.")
            
        # 3. M:N 관계 연결 해제
        course.students = []
        course.assistants = []
        
        db.session.delete(course)
        db.session.commit()

    def create_assignment(self, course_id, data, ta_user_id):
        """ [수정] 2. 과제 생성 (TA 권한 확인, 날짜 파싱) """
        course = self._get_course(course_id)
        
        # TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        assignment_name = data.get('assignment_name')
        if not assignment_name:
            raise ValueError("과제 이름이 필요합니다.")
            
        assignment = Assignment(
            course_id=course.id,
            assignment_name=assignment_name,
            description=data.get('description'),
            due_date=self._parse_iso_due_date(data.get('due_date')) # 날짜 파싱 적용
        )
        db.session.add(assignment)
        db.session.commit()
        return assignment

    def update_assignment(self, assignment_id, data, ta_user_id):
        """ [신규] 과제 정보 수정 (TA 권한 확인) """
        assignment = self._get_assignment(assignment_id)
        
        # TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        # 필드 업데이트
        if 'assignment_name' in data:
            assignment.assignment_name = data['assignment_name']
        if 'description' in data:
            assignment.description = data['description']
        if 'due_date' in data: # 'due_date': null 로 보내도 처리 가능
            assignment.due_date = self._parse_iso_due_date(data.get('due_date'))
            
        db.session.commit()
        return assignment

    def delete_assignment(self, assignment_id, ta_user_id):
        """ [수정] 3. 과제 삭제 (TA 권한, 제출물 존재 여부 확인) """
        assignment = self._get_assignment(assignment_id)
        
        # 1. TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        # 2. 안전 장치: 과제에 속한 제출물(리포트)이 있는지 확인
        submission_count = db.session.query(AnalysisReport.id).filter_by(assignment_id=assignment_id).count()
        if submission_count > 0:
            raise ValueError(f"과제에 {submission_count}개의 제출물이 존재하여 삭제할 수 없습니다.")
            
        db.session.delete(assignment)
        db.session.commit()

    def get_assignment_criteria(self, assignment_id, ta_user_id):
        """ [신규] 과제 평가 기준 조회 (TA 권한 확인) """
        assignment = self._get_assignment(assignment_id)
        
        # TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        # 'models.py'에 정의된 Assignment.get_criteria_dict() 헬퍼 사용
        return assignment.get_criteria_dict()

    def update_assignment_criteria(self, assignment_id, criteria_data, ta_user_id):
        """ [수정] 4. 과제 평가 기준 설정 (TA 권한 확인) """
        assignment = self._get_assignment(assignment_id)
        
        # TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        if not isinstance(criteria_data, dict):
                 raise ValueError("평가 기준은 유효한 JSON(object) 형식이어야 합니다.")
                 
        assignment.grading_criteria = json.dumps(criteria_data)
        db.session.commit()
        return assignment

    def get_students_in_course(self, course_id, ta_user_id):
        """ [수정] 5. 특정 과목 수강 학생 ID 목록 얻기 (TA 권한 확인 추가) """
        course = self._get_course(course_id)
        
        # [수정] TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        # lazy='dynamic'이므로 .all() 또는 반복문 필요
        students = course.students.all() 
        return [{"id": s.id, "email": s.email, "username": s.username} for s in students]

    def get_submissions_for_assignment(self, assignment_id, ta_user_id):
        """ [수정] 6. 특정 과제에 제출된 리포트 ID 및 학생 ID 얻기 (TA 권한 확인 추가) """
        assignment = self._get_assignment(assignment_id)
        
        # [수정] TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        # 'reports' relationship 사용
        submissions = db.session.query(
            AnalysisReport.id, 
            AnalysisReport.user_id, 
            User.email,
            User.username,
            AnalysisReport.status,
            AnalysisReport.created_at,
            AnalysisReport.report_title
        ).join(User, AnalysisReport.user_id == User.id)\
         .filter(AnalysisReport.assignment_id == assignment_id)\
         .order_by(AnalysisReport.created_at.desc())\
         .all()
         
        return [
            {
                "report_id": r.id, 
                "student_id": r.user_id, 
                "student_email": r.email,
                "student_username": r.username,
                "report_title": r.report_title,
                "status": r.status,
                "submitted_at": r.created_at.isoformat()
            } 
            for r in submissions
        ]

    def add_student_to_course(self, course_id, student_email, ta_user_id):
        """ [수정] 7. 특정 과목에 학생 등록 (TA 권한 확인 추가) """
        course = self._get_course(course_id)
        
        # [수정] TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        student = User.query.filter(
            func.lower(User.email) == func.lower(student_email),
            User.role == 'student'
        ).first()

        if not student:
            raise ValueError(f"'{student_email}' 학생을 찾을 수 없습니다.")
        
        if student in course.students.all():
            raise ValueError("학생이 이미 과목에 등록되어 있습니다.")
            
        course.students.append(student)
        db.session.commit()
        return student

    def remove_student_from_course(self, course_id, student_id, ta_user_id):
        """ [수정] 7. 특정 과목에서 학생 삭제 (TA 권한 확인 추가) """
        course = self._get_course(course_id)
        
        # [수정] TA 권한 확인
        self._check_ta_permission(ta_user_id, course_id)
        
        student = User.query.filter_by(id=student_id, role='student').first()

        if not student:
            raise ValueError("학생을 찾을 수 없습니다.")
            
        try:
            course.students.remove(student)
            db.session.commit()
        except ValueError:
            # 이미 관계가 없는 경우
            raise ValueError("학생이 이 과목에 등록되어 있지 않습니다.")

    def grade_submission(self, report_id, grade_data, ta_user_id):
        """ [수정] 8. 채점 및 피드백 (TA 권한 확인) """
        report = self._get_report(report_id)
        if not report.assignment_id:
            raise ValueError("과제에 정식으로 제출된 리포트가 아닙니다.")

        # TA 권한 확인 (리포트가 속한 과제의)
        assignment = self._get_assignment(report.assignment_id)
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        feedback = grade_data.get('feedback')
        score_details = grade_data.get('score_details') # 예: {"A": 10, "B": 8, "total": 18}

        report.ta_feedback = feedback
        report.ta_score_details = json.dumps(score_details) if score_details else None
        
        db.session.commit()
        return report

    def get_assignment_details(self, assignment_id, ta_user_id):
        """ [수정] 9. 과제 상세 정보 조회 (TA 권한 확인 추가) """
        assignment = self._get_assignment(assignment_id)
        
        # [수정] TA 권한 확인
        self._check_ta_permission(ta_user_id, assignment.course_id)
        
        return {
            "id": assignment.id,
            "course_id": assignment.course_id,
            "assignment_name": assignment.assignment_name,
            "description": assignment.description,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "grading_criteria": assignment.get_criteria_dict() # JSON -> dict
        }

    def get_assignment_stats(self, assignment_id, ta_user_id):
        """ [수정] 11. 과제별 통계 조회 (TA 권한 확인 추가, 다양한 통계 제공) """
        import numpy as np
        assignment = self._get_assignment(assignment_id)
        self._check_ta_permission(ta_user_id, assignment.course_id)
        course = assignment.course
        total_students = course.students.count()
        submissions = AnalysisReport.query.filter_by(assignment_id=assignment_id).all()
        submission_count = len(submissions)
        graded_scores = []
        for report in submissions:
            if report.ta_score_details:
                try:
                    score_data = json.loads(report.ta_score_details)
                    if 'total' in score_data and isinstance(score_data['total'], (int, float)):
                        graded_scores.append(score_data['total'])
                except (json.JSONDecodeError, TypeError):
                    continue
        average_score = sum(graded_scores) / len(graded_scores) if graded_scores else 0
        max_score = max(graded_scores) if graded_scores else None
        min_score = min(graded_scores) if graded_scores else None
        stddev_score = float(np.std(graded_scores)) if graded_scores else None
        q1 = float(np.percentile(graded_scores, 25)) if graded_scores else None
        q2 = float(np.percentile(graded_scores, 50)) if graded_scores else None
        q3 = float(np.percentile(graded_scores, 75)) if graded_scores else None
        return {
            "assignment_id": assignment_id,
            "assignment_name": assignment.assignment_name,
            "total_students": total_students,
            "submission_count": submission_count,
            "submission_rate": (submission_count / total_students) * 100 if total_students > 0 else 0,
            "graded_count": len(graded_scores),
            "average_score": average_score,
            "max_score": max_score,
            "min_score": min_score,
            "stddev_score": stddev_score,
            "q1": q1,
            "q2": q2,
            "q3": q3
        }

    # 🔥 [핵심 수정] 학생 대시보드 상세 조회 로직
    def get_student_dashboard_details(self, student_id):
        """ 특정 학생의 상세 정보(수강 과목, 제출 리포트)를 조회합니다. """
        try:
            from models import User, Course, AnalysisReport, Assignment
            from sqlalchemy.orm import joinedload
            
            # 1. 학생 객체 확인
            student = db.session.get(User, student_id)
            
            if not student:
                raise ValueError("학생을 찾을 수 없습니다.")
            
            # (개발자 테스트 편의를 위해 role check는 잠시 생략 가능, 필요시 주석 해제)
            # if student.role != 'student':
            #     raise ValueError("해당 사용자는 학생이 아닙니다.")
                
            student_info = {
                "id": student.id,
                "email": student.email,
                "username": student.username or student.email.split('@')[0]
            }

            # 2. 수강 과목 조회
            enrolled_courses = db.session.query(Course).join(
                course_enrollment, (course_enrollment.c.course_id == Course.id)
            ).filter(
                course_enrollment.c.user_id == student_id
            ).order_by(Course.course_name).all()
            
            courses_list = [
                {
                    "course_id": course.id,
                    "course_name": course.course_name,
                    "course_code": course.course_code
                } for course in enrolled_courses
            ]

            # 3. [수정됨] 해당 학생(student_id)의 모든 리포트 조회
            # 주의: filter_by(user_id=student_id)가 필수입니다.
            student_reports = AnalysisReport.query.filter_by(user_id=student_id)\
                .options(joinedload(AnalysisReport.assignment))\
                .order_by(AnalysisReport.created_at.desc())\
                .all()
                
            reports_list = []
            for report in student_reports:
                try:
                    assignment_name = "과제 미제출"
                    assignment_id = None
                    
                    if report.assignment:
                        assignment_name = report.assignment.assignment_name
                        assignment_id = report.assignment.id
                    
                    reports_list.append({
                        "report_id": report.id,
                        "report_title": report.report_title or "제목 없음",
                        "status": report.status,
                        "created_at": report.created_at.isoformat() if report.created_at else None,
                        "assignment_id": assignment_id,
                        "assignment_name": assignment_name
                    })
                except Exception as e:
                    print(f"[CourseService] 리포트 {report.id} 처리 중 오류: {e}")
                    continue

            result = {
                "student": student_info,
                "courses": courses_list,
                "submitted_reports": reports_list
            }
            
            print(f"[CourseService] ✅ 학생({student_id}) 대시보드 조회 성공: 리포트 {len(reports_list)}개 반환")
            return result
            
        except ValueError as e:
            raise
        except Exception as e:
            print(f"[CourseService] get_student_dashboard_details 실패: {e}")
            traceback.print_exc()
            raise Exception("대시보드 조회 중 서버 오류가 발생했습니다.")

    def get_courses_for_ta(self, ta_id):
        """ [수정] 특정 TA ID에 연결된 모든 과목 목록을 반환합니다. (성능 최적화) """
        ta = db.session.get(User, ta_id)
        
        if not ta:
            raise ValueError("TA 사용자를 찾을 수 없습니다.")
        if ta.role != 'ta' and not ta.is_admin:
            raise ValueError("조회 권한이 없습니다. (TA 또는 Admin이 아님)")

        courses_query = db.session.query(Course).order_by(Course.course_code)
        
        # Admin이 아닌 TA는 M:N 테이블을 조인하여 본인 과목만 조회
        if not ta.is_admin:
            courses_query = courses_query.join(
                course_assistant, (course_assistant.c.course_id == Course.id)
            ).filter(course_assistant.c.user_id == ta_id)
            
        courses = courses_query.all()

        courses_list = []
        for course in courses:
            # [최적화] len(relationship) 대신 count() 쿼리 사용
            assignment_count = db.session.query(Assignment.id).filter_by(course_id=course.id).count()
            
            # 'students'는 lazy='dynamic'이므로 .count()가 정석
            student_count = course.students.count()

            courses_list.append({
                "id": course.id,
                "course_name": course.course_name,
                "course_code": course.course_code,
                "assignment_count": assignment_count,
                "student_count": student_count
            })
            
        return courses_list

    def get_assignments_for_course(self, course_id, ta_user_id):
        """
        [수정] 특정 과목(course_id)에 속한 모든 과제 목록을 반환합니다.
        (TA 권한 확인 추가)
        """
        # 1. 과목(Course) 객체를 찾고, TA 권한을 확인합니다.
        course = self._get_course(course_id)
        self._check_ta_permission(ta_user_id, course_id)

        # 2. 과목에 연결된 과제들을 조회합니다.
        assignments = db.session.query(Assignment).filter_by(course_id=course_id).order_by(
            db.func.coalesce(Assignment.due_date, datetime(1900, 1, 1)).desc(), 
            Assignment.id.desc()
        ).all()

        # 3. 프론트엔드에 전달할 형태로 데이터를 직렬화(serialize)합니다.
        assignments_list = []
        for assign in assignments:
            # [최적화] len(relationship) 대신 count() 쿼리 사용
            report_count = db.session.query(AnalysisReport.id).filter_by(assignment_id=assign.id).count()
            
            assignments_list.append({
                "id": assign.id,
                "assignment_name": assign.assignment_name,
                "description": assign.description,
                "due_date": assign.due_date.isoformat() if assign.due_date else None,
                "report_count": report_count
            })
            
        return assignments_list

    def get_assignments_for_student(self, course_id, student_id):
        """ [신규] 학생이 특정 과목의 과제 목록을 조회합니다. """
        course = self._get_course(course_id) # (내부 헬퍼 사용)
        
        is_enrolled = db.session.query(course_enrollment).filter_by(
            user_id=student_id,
            course_id=course_id
        ).first()
        
        if not is_enrolled:
            raise ValueError("Student is not enrolled in this course.")
            
        # [수정] 학생용 API는 TA 권한이 필요 없으므로 ta_user_id 없이 호출
        assignments = db.session.query(Assignment).filter_by(course_id=course_id).order_by(
            db.func.coalesce(Assignment.due_date, datetime(1900, 1, 1)).desc(), 
            Assignment.id.desc()
        ).all()

        assignments_list = []
        for assign in assignments:
            report_count = db.session.query(AnalysisReport.id).filter_by(assignment_id=assign.id).count()
            
            assignments_list.append({
                "id": assign.id,
                "assignment_name": assign.assignment_name,
                "description": assign.description,
                "due_date": assign.due_date.isoformat() if assign.due_date else None,
                "report_count": report_count
            })
        return assignments_list


    def submit_report_to_assignment(self, report_id, assignment_id, requestor_id):
        """ [수정] 학생이 분석 완료된 리포트를 과제에 제출합니다. (Admin/TA/Dev 예외 처리 추가) """
        report = self._get_report(report_id)
        assignment = self._get_assignment(assignment_id)
        
        # 1. 요청자(requestor) 확인
        requestor = db.session.get(User, requestor_id)
        if not requestor:
             raise ValueError("Requestor user not found.")

        # 개발자 이메일 목록
        DEV_EMAILS = ["dabok2@snu.ac.kr", "dev2@snu.ac.kr", "dev3@snu.ac.kr", "dev@snu.ac.kr"]

        # 2. 요청 권한 확인: 리포트 소유자 본인이거나, Admin/TA/Dev여야 함
        is_owner = (report.user_id == requestor_id)
        is_privileged_requestor = (requestor.is_admin or requestor.role == 'ta' or requestor.email in DEV_EMAILS)

        if not is_owner and not is_privileged_requestor:
             raise ValueError("Access denied. You are not the owner of this report.")
            
        # 3. 리포트 상태 확인
        if report.status != 'completed':
            # (테스트 편의를 위해, processing 상태라도 강제 제출이 필요하면 이 부분을 주석 처리하세요)
            # 지금은 정석대로 유지합니다.
            raise ValueError("Report analysis is not yet complete.")
            
        if report.assignment_id is not None:
            raise ValueError("This report has already been submitted.")
            
        # 4. 수강 여부 확인 (핵심 수정)
        # 리포트의 실제 주인(report.user_id)을 기준으로 확인합니다.
        report_owner = db.session.get(User, report.user_id)
        
        # 🔥 [수정] 리포트 주인이 관리자급(Admin/TA/Dev)이면 수강 여부 체크를 건너뜁니다.
        is_owner_privileged = (report_owner.is_admin or report_owner.role == 'ta' or report_owner.email in DEV_EMAILS)
        
        if not is_owner_privileged:
            # 일반 학생인 경우에만 수강 여부를 엄격하게 체크합니다.
            is_enrolled = db.session.query(course_enrollment).filter_by(
                user_id=report.user_id,
                course_id=assignment.course_id
            ).first()
            
            if not is_enrolled:
                raise ValueError(f"Report owner ({report_owner.username}) is not enrolled in the course.")
            
        # 5. 제출 처리
        report.assignment_id = assignment_id
        db.session.commit()
        
        return report

    def get_auto_grading_result(self, report_id, ta_user_id):
        """ AI 자동 채점 결과 robust 조회 """
        report = self._get_report(report_id)
        if not report.assignment_id:
            raise ValueError("과제에 정식으로 제출된 리포트가 아닙니다.")
        assignment = self._get_assignment(report.assignment_id)
        self._check_ta_permission(ta_user_id, assignment.course_id)
        if not report.auto_score_details:
            return None
        try:
            result = json.loads(report.auto_score_details)
            if isinstance(result, dict) and "error" in result:
                return {"error": result["error"]}
            return result
        except Exception as e:
            return {"error": f"자동 채점 결과 파싱 오류: {e}"}

    def get_ta_grading_result(self, report_id, ta_user_id):
        """ TA 채점 및 피드백 조회 """
        report = self._get_report(report_id)
        if not report.assignment_id:
            raise ValueError("과제에 정식으로 제출된 리포트가 아닙니다.")

        # TA 권한 확인
        assignment = self._get_assignment(report.assignment_id)
        self._check_ta_permission(ta_user_id, assignment.course_id)

        return {
            "feedback": report.ta_feedback,
            "score_details": json.loads(report.ta_score_details) if report.ta_score_details else None
        }

    # --- Helper Functions (오류 처리용) ---
    
    def _get_course(self, course_id):
        # [수정] get()은 integer/uuid에만 사용. id가 아닐 수 있으니 get() 사용
        course = db.session.get(Course, course_id)
        if not course:
            raise ValueError(f"Course ID {course_id}를 찾을 수 없습니다.")
        return course

    def _get_assignment(self, assignment_id):
        assignment = db.session.get(Assignment, assignment_id)
        if not assignment:
            raise ValueError(f"Assignment ID {assignment_id}를 찾을 수 없습니다.")
        return assignment

    def _get_report(self, report_id):
        # UUID는 get()으로 찾는 것이 좋습니다.
        report = db.session.get(AnalysisReport, report_id)
        if not report:
            raise ValueError(f"Report ID {report_id}를 찾을 수 없습니다.")
        return report

    def _check_ta_permission(self, ta_user_id, course_id):
        """
        [신규 Helper] TA가 과목에 대한 권한이 있는지 확인합니다.
        (Admin은 항상 통과)
        """
        ta = db.session.get(User, ta_user_id)
        if not ta:
            raise ValueError("TA 사용자를 찾을 수 없습니다.")
        
        if ta.is_admin:
            return True # Admin은 모든 과목에 대한 권한을 가짐

        is_assistant = db.session.query(course_assistant).filter_by(
            user_id=ta_user_id,
            course_id=course_id
        ).first()
        
        if not is_assistant:
            raise ValueError("해당 과목에 대한 조교 권한이 없습니다.")
            
        return True

    def _parse_iso_due_date(self, date_str):
        """
        [신규 Helper] ISO 8601 형식의 날짜 문자열(UTC 'Z' 포함)을
        Python datetime 객체로 변환합니다.
        """
        if date_str is None:
            return None
        try:
            # 'Z' (UTC)를 'datetime.fromisoformat'이 인식하는 +00:00으로 변경
            if date_str.endswith('Z'):
                date_str = date_str[:-1] + '+00:00'
            
            parsed_date = datetime.fromisoformat(date_str)
            
            # Naive datetime으로 DB에 저장 (UTC 기준)
            if parsed_date.tzinfo:
                 return parsed_date.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                 # 표준 시간대 정보가 없는 경우, 그대로 사용 (서버 시간대 가정)
                 return parsed_date
            
        except (ValueError, TypeError):
            raise ValueError(f"날짜 형식이 올바르지 않습니다. '{date_str}' (ISO format-YYYY-MM-DDTHH:MM:SSZ- 필요)")