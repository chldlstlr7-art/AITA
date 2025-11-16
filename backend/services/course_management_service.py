# services/course_management_service.py (신규 생성)
from datetime import datetime, timezone
import json
from extensions import db
from models import User, Course, Assignment, AnalysisReport, course_enrollment, course_assistant
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import joinedload
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

    def update_course(self, course_id, data):
        """ 10. 과목 정보 수정 """
        course = self._get_course(course_id)
        
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

    def create_assignment(self, course_id, data):
        """ 2. 과목에 속하는 과제 생성 """
        course = self._get_course(course_id)
        
        assignment_name = data.get('assignment_name')
        if not assignment_name:
            raise ValueError("과제 이름이 필요합니다.")
            
        assignment = Assignment(
            course_id=course.id,
            assignment_name=assignment_name,
            description=data.get('description'),
            due_date=data.get('due_date') # TODO: 날짜 형식 파싱 필요
        )
        db.session.add(assignment)
        db.session.commit()
        return assignment

    def delete_assignment(self, assignment_id):
        """ 3. 과제 삭제 """
        assignment = self._get_assignment(assignment_id)
        db.session.delete(assignment)
        db.session.commit()

    def update_assignment_criteria(self, assignment_id, criteria_data):
        """ 4. 과제별 평가 기준 설정 """
        assignment = self._get_assignment(assignment_id)
        
        # criteria_data가 유효한 JSON 형식인지, 혹은 딕셔너리인지 확인
        # 예: {"A": {"name": "논리성", "max_score": 30}, "B": ...}
        if not isinstance(criteria_data, dict):
             raise ValueError("평가 기준은 유효한 JSON(object) 형식이어야 합니다.")
             
        assignment.grading_criteria = json.dumps(criteria_data)
        db.session.commit()
        return assignment

    def get_students_in_course(self, course_id):
        """ 5. 특정 과목 수강 학생 ID 목록 얻기 """
        course = self._get_course(course_id)
        # lazy='dynamic'이므로 .all() 또는 반복문 필요
        students = course.students.all() 
        return [{"id": s.id, "email": s.email, "username": s.username} for s in students]

    def get_submissions_for_assignment(self, assignment_id):
        """ 6. 특정 과제에 제출된 리포트 ID 및 학생 ID 얻기 """
        assignment = self._get_assignment(assignment_id)
        # 'reports' relationship 사용
        submissions = db.session.query(
            AnalysisReport.id, 
            AnalysisReport.user_id, 
            User.email,
            AnalysisReport.status,
            AnalysisReport.created_at
        ).join(User, AnalysisReport.user_id == User.id)\
         .filter(AnalysisReport.assignment_id == assignment_id)\
         .order_by(AnalysisReport.created_at.desc())\
         .all()
         
        return [
            {
                "report_id": r.id, 
                "student_id": r.user_id, 
                "student_email": r.email,
                "status": r.status,
                "submitted_at": r.created_at.isoformat()
            } 
            for r in submissions
        ]

    def add_student_to_course(self, course_id, student_email):
        """ 7. 특정 과목에 학생 등록 """
        course = self._get_course(course_id)
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

    def remove_student_from_course(self, course_id, student_id):
        """ 7. 특정 과목에서 학생 삭제 """
        course = self._get_course(course_id)
        student = User.query.filter_by(id=student_id, role='student').first()

        if not student:
            raise ValueError("학생을 찾을 수 없습니다.")
            
        try:
            course.students.remove(student)
            db.session.commit()
        except ValueError:
            # 이미 관계가 없는 경우
            raise ValueError("학생이 이 과목에 등록되어 있지 않습니다.")

    def grade_submission(self, report_id, grade_data):
        """ 8. 채점 및 피드백 남기기 (모델 수정 필요) """
        report = self._get_report(report_id)
        
        feedback = grade_data.get('feedback')
        score_details = grade_data.get('score_details') # 예: {"A": 10, "B": 8, "total": 18}

        # (위 1번에서 제안한) 신규 컬럼에 저장
        report.ta_feedback = feedback
        report.ta_score_details = json.dumps(score_details) if score_details else None
        
        db.session.commit()
        return report

    def get_assignment_details(self, assignment_id):
        """ 9. 과제 상세 정보 조회 """
        assignment = self._get_assignment(assignment_id)
        return {
            "id": assignment.id,
            "course_id": assignment.course_id,
            "assignment_name": assignment.assignment_name,
            "description": assignment.description,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "grading_criteria": assignment.get_criteria_dict() # JSON -> dict
        }

    def get_assignment_stats(self, assignment_id):
        """ 11. 과제별 통계 조회 """
        assignment = self._get_assignment(assignment_id)
        course = assignment.course
        
        total_students = course.students.count()
        submissions = AnalysisReport.query.filter_by(assignment_id=assignment_id).all()
        submission_count = len(submissions)
        
        # 채점이 완료된 리포트에서 점수 집계 (ta_score_details 기반)
        graded_scores = []
        for report in submissions:
            if report.ta_score_details:
                try:
                    score_data = json.loads(report.ta_score_details)
                    # 'total' 키가 있다고 가정
                    if 'total' in score_data and isinstance(score_data['total'], (int, float)):
                        graded_scores.append(score_data['total'])
                except (json.JSONDecodeError, TypeError):
                    continue # 점수 데이터가 잘못된 경우 무시

        average_score = sum(graded_scores) / len(graded_scores) if graded_scores else 0
        
        return {
            "assignment_id": assignment_id,
            "assignment_name": assignment.assignment_name,
            "total_students": total_students,
            "submission_count": submission_count,
            "submission_rate": (submission_count / total_students) * 100 if total_students > 0 else 0,
            "graded_count": len(graded_scores),
            "average_score": average_score
        }

    def get_student_dashboard_details(self, student_id):
        """
        특정 학생의 상세 정보(수강 과목, 제출 리포트)를 조회합니다.
        """
        # 1. 학생 정보 조회
        student = User.query.get(student_id)
        
        if not student:
            raise ValueError("학생을 찾을 수 없습니다.")
        if student.role != 'student':
            raise ValueError("해당 사용자는 학생이 아닙니다.")
            
        student_info = {
            "id": student.id,
            "email": student.email,
            "username": student.username
        }

        # 2. 수강 과목 목록 조회
        # (User.courses_enrolled 관계 사용)
        enrolled_courses = student.courses_enrolled.order_by(Course.course_name).all()
        courses_list = [
            {
                "id": course.id,
                "course_name": course.course_name,
                "course_code": course.course_code
            } for course in enrolled_courses
        ]

        # 3. 제출 리포트 목록 조회
        # (N+1 쿼리 방지를 위해 assignment 정보 'joinedload' 사용)
        student_reports = AnalysisReport.query.filter_by(user_id=student_id)\
            .options(joinedload(AnalysisReport.assignment))\
            .order_by(AnalysisReport.created_at.desc())\
            .all()
            
        reports_list = []
        for report in student_reports:
            assignment_name = "N/A"
            if report.assignment:
                assignment_name = report.assignment.assignment_name
                
            reports_list.append({
                "id": report.id,
                "report_title": report.report_title,
                "status": report.status,
                "created_at": report.created_at.isoformat() if report.created_at else None,
                "assignment_id": report.assignment_id,
                "assignment_name": assignment_name
            })

        # 4. 최종 데이터 조합
        return {
            "student": student_info,
            "enrolled_courses": courses_list,
            "submitted_reports": reports_list
        }

    def get_courses_for_ta(self, ta_id):
        """
        [신규] 특정 TA ID에 연결된 모든 과목 목록을 반환합니다.
        (models.py의 N:M 관계 backref 'courses_assisted' 기반으로 작성됨)
        """
        
        # 1. TA 사용자 객체를 찾습니다.
        ta = db.session.get(User, ta_id)
        
        # 2. TA 또는 Admin인지 확인합니다.
        if not ta:
            raise ValueError("TA 사용자를 찾을 수 없습니다.")
        if ta.role != 'ta' and not ta.is_admin:
            raise ValueError("조회 권한이 없습니다. (TA 또는 Admin이 아님)")

        # 3. [수정] 'courses_assisted' backref 대신 수동 조인 쿼리를 사용합니다.
        # 이 방식은 DB에서 직접 정렬(order_by)을 수행할 수 있어 더 효율적입니다.
        # ta.courses_assisted는 Python 리스트이므로 .order_by()를 사용할 수 없습니다.
        try:
            courses = db.session.query(Course).join(
                course_assistant, (course_assistant.c.course_id == Course.id)
            ).filter(course_assistant.c.user_id == ta_id).order_by(Course.course_code).all()
        except Exception as e:
            # (디버깅) 쿼리 자체에서 에러가 날 경우를 대비
            print(f"[Service Error] 'get_courses_for_ta' 쿼리 실행 중 오류: {e}")
            raise e # 오류를 상위로 다시 전달


        # 4. 프론트엔드에 전달할 형태로 데이터를 직렬화(serialize)합니다.
        courses_list = []
        for course in courses:
            # Course.assignments는 lazy=True (기본값)이므로 len() 사용
            assignment_count = len(course.assignments)
            
            # Course.students는 lazy='dynamic'이므로 .count() 사용
            student_count = course.students.count()

            courses_list.append({
                "id": course.id,
                "course_name": course.course_name,
                "course_code": course.course_code,
                "assignment_count": assignment_count,
                "student_count": student_count
            })
            
        return courses_list

    def get_assignments_for_course(self, course_id):
        """
        [신규] 특정 과목(course_id)에 속한 모든 과제 목록을 반환합니다.
        """
        # 1. 과목(Course) 객체를 찾습니다.
        course = db.session.get(Course, course_id)
        if not course:
            raise ValueError("과목을 찾을 수 없습니다.")

        # 2. 과목에 연결된 과제들을 조회합니다.
        #    (최신 과제가 위로 오도록 정렬. due_date가 없는 경우(nullslast)를 고려)
        assignments = db.session.query(Assignment).filter_by(course_id=course_id).order_by(
            db.func.coalesce(Assignment.due_date, datetime(1900, 1, 1)).desc(), 
            Assignment.id.desc()
        ).all()

        # 3. 프론트엔드에 전달할 형태로 데이터를 직렬화(serialize)합니다.
        assignments_list = []
        for assign in assignments:
            assignments_list.append({
                "id": assign.id,
                "assignment_name": assign.assignment_name,
                "description": assign.description,
                "due_date": assign.due_date.isoformat() if assign.due_date else None,
                "report_count": len(assign.reports) # (models.py: lazy=True)
            })
            
        return assignments_list

    def get_assignments_for_student(self, course_id, student_id):
        """
        [신규] 학생이 특정 과목의 과제 목록을 조회합니다.
        (학생이 해당 과목을 수강 중인지 확인)
        """
        # 1. 과목 존재 여부 확인
        course = self._get_course(course_id) # (내부 헬퍼 사용)
        
        # 2. 학생 수강 여부 확인
        is_enrolled = db.session.query(course_enrollment).filter_by(
            user_id=student_id,
            course_id=course_id
        ).first()
        
        if not is_enrolled:
            raise ValueError("Student is not enrolled in this course.")
            
        # 3. 수강 중인 경우, TA가 사용하는 과제 목록 조회 함수 재사용
        return self.get_assignments_for_course(course_id)

    # --- [신규] 학생 리포트 제출 메서드 (student_api.py에서 사용) ---
    def submit_report_to_assignment(self, report_id, assignment_id, student_id):
        """
        [신규] 학생이 분석 완료된 리포트를 과제에 제출합니다.
        """
        # 1. 리포트 및 과제 객체 조회
        report = self._get_report(report_id)
        assignment = self._get_assignment(assignment_id)
        
        # 2. [검증 1] 리포트 소유권 확인
        if report.user_id != student_id:
            raise ValueError("Access denied. You are not the owner of this report.")
            
        # 3. [검증 2] 리포트 분석 완료 상태 확인 (요청 사항)
        if report.status != 'completed':
            raise ValueError("Report analysis is not yet complete.")
            
        # 4. [검증 3] 이미 제출되었는지 확인
        if report.assignment_id is not None:
            raise ValueError("This report has already been submitted.")
            
        # 5. [검증 4] 해당 과제의 과목에 수강 중인지 확인
        is_enrolled = db.session.query(course_enrollment).filter_by(
            user_id=student_id,
            course_id=assignment.course_id
        ).first()
        
        if not is_enrolled:
            raise ValueError("You are not enrolled in the course for this assignment.")
            
        # 6. 모든 검증 통과: 리포트에 과제 ID 연결
        report.assignment_id = assignment_id
        db.session.commit()
        
        return report
    # --- Helper Functions (오류 처리용) ---
    
    def _get_course(self, course_id):
        course = Course.query.get(course_id)
        if not course:
            raise ValueError(f"Course ID {course_id}를 찾을 수 없습니다.")
        return course

    def _get_assignment(self, assignment_id):
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment ID {assignment_id}를 찾을 수 없습니다.")
        return assignment

    def _get_report(self, report_id):
        report = AnalysisReport.query.get(report_id)
        if not report:
            raise ValueError(f"Report ID {report_id}를 찾을 수 없습니다.")
        return report
