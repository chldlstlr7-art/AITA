import os
import json
import google.generativeai as genai
from extensions import db
from models import AnalysisReport, Assignment

# 1. Gemini API 키 설정
try:
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
    
    genai.configure(api_key=GEMINI_API_KEY)
    
except Exception as e:
    print(f"[GradingService] CRITICAL: Gemini API 키 설정 실패: {e}")
    # 실제 운영 환경에서는 앱 실행을 중단시키는 것이 좋을 수 있습니다.


class GradingService:
    
    def __init__(self, model_name='gemini-1.5-pro'): # [예시] 모델명은 최신 버전을 권장합니다.
        """
        Gemini 모델을 초기화합니다.
        JSON 출력을 위해 'response_mime_type'을 설정합니다.
        """
        try:
            self.model = genai.GenerativeModel(
                model_name,
                # JSON 모드 활성화: 프롬프트 지침에 따라 JSON만 생성하도록 강제
                generation_config={"response_mime_type": "application/json"}
            )
            print(f"[GradingService] {model_name} 모델이 초기화되었습니다 (JSON 모드).")
        except Exception as e:
            print(f"[GradingService] CRITICAL: 모델 초기화 실패. API 키 또는 모델 이름을 확인하세요: {e}")
            self.model = None # 모델 초기화 실패 시 self.model을 None으로 설정

    def _get_report_and_criteria(self, report_id):
        """ 헬퍼: 리포트 ID로 리포트 본문과 평가 기준을 가져옵니다. """
        report = AnalysisReport.query.get(report_id)
        if not report:
            raise ValueError(f"Report ID {report_id}를 찾을 수 없습니다.")
        
        assignment = report.assignment # models.py의 relationship을 통해 접근
        if not assignment:
            raise ValueError(f"Report {report_id}에 연결된 과제(Assignment)가 없습니다.")
            
        criteria_dict = assignment.get_criteria_dict()
        if not criteria_dict:
            raise ValueError(f"Assignment {assignment.id}에 평가 기준(grading_criteria)이 설정되지 않았습니다.")

        # [가정] report.text_snippet에 채점할 리포트의 *전체 텍스트*가 저장되어 있다고 가정합니다.
        # 만약 S3 등 다른 곳에 있다면, 여기서 해당 텍스트를 불러와야 합니다.
        document_text = report.text_snippet 
        if not document_text:
            raise ValueError(f"Report {report_id}에 채점할 본문(text_snippet)이 없습니다.")

        return report, assignment, document_text, criteria_dict

    def _format_criteria_for_prompt(self, criteria_dict):
        """ 프롬프트에 평가 기준을 더 명확하게 전달하기 위해 포맷팅합니다. """
        formatted = []
        for key, value in criteria_dict.items():
            name = value.get('name', 'N/A')
            score = value.get('max_score', 'N/A')
            formatted.append(f"- ID \"{key}\": {name} (만점: {score}점)")
        return "\n".join(formatted)

    def _build_prompt(self, course_name, assignment_name, criteria_str, document_text):
        """ Gemini에게 전달할 프롬프트를 생성합니다. (JSON 모드 최적화) """
        
        # [중요] JSON 모드에서는 프롬프트에 JSON 예시를 넣는 것보다,
        #        생성해야 할 JSON의 *구조*를 텍스트로 명확하게 설명하는 것이 더 효과적입니다.
        
        return f"""
        당신은 [{course_name}] 과목의 공정하고 엄격한 조교(TA)입니다.
        
        [과제명]
        {assignment_name}

        [평가 기준]
        {criteria_str}

        [리포트 본문]
        {document_text}

        [임무]
        위 [평가 기준]에 따라 [리포트 본문]을 채점하고,
        다음과 같은 JSON 객체를 생성해주세요.
        
        1.  `scores` (List):
            -   [평가 기준]의 각 항목(예: "A", "B")을 `criteria_id`로 합니다.
            -   `score`는 `max_score`를 넘지 않는 정수여야 합니다.
            -   `feedback`은 해당 항목에 대한 구체적인 한 줄 피드백입니다.
        2.  `total` (Number):
            -   모든 `score`의 총합입니다.
        3.  `overall_feedback` (String):
            -   리포트 전체에 대한 2-3문장 이내의 종합 피드백입니다.
        
        [지시]
        - 다른 말은 절대 덧붙이지 말고, 오직 위에서 설명한 구조의 JSON 객체만 생성하세요.
        - 모든 점수는 [평가 기준]에 명시된 만점을 초과할 수 없습니다.
        - [리포트 본문]이 기준에 미달하면 0점을 부여할 수 있습니다.
        """

    def run_auto_grading(self, report_id):
        """
        특정 리포트에 대해 자동 채점을 실행하고 결과를 DB에 저장합니다.
        """
        if not self.model:
            print(f"[GradingService] ERROR: 모델이 초기화되지 않아 Report {report_id} 채점을 건너뜁니다.")
            return None
            
        report = None # finally에서 사용하기 위해 try 밖에 선언
        try:
            # 1. 데이터 로드
            report, assignment, doc_text, criteria_dict = self._get_report_and_criteria(report_id)
            
            # 2. 프롬프트 생성
            criteria_str = self._format_criteria_for_prompt(criteria_dict)
            prompt = self._build_prompt(
                course_name=assignment.course.course_name, # 관계(relationship)로 접근
                assignment_name=assignment.assignment_name,
                criteria_str=criteria_str,
                document_text=doc_text
            )
            
            # 3. Gemini API 호출
            print(f"[GradingService] Report {report_id} 자동 채점 시작...")
            response = self.model.generate_content(prompt)
            
            # 4. 결과 파싱 및 저장
            # JSON 모드를 사용했으므로, response.text는 순수한 JSON 문자열이어야 함
            json_string = response.text
            
            # (선택적) 파싱 검증
            try:
                result_json = json.loads(json_string)
                # TODO: result_json의 형식이 우리가 원하는 'scores', 'total' 등을
                #       포함하는지 스키마 검증을 추가하면 더 좋습니다.
            except json.JSONDecodeError:
                print(f"[GradingService] ERROR: Gemini가 유효한 JSON을 반환하지 않았습니다. \nRaw: {json_string}")
                raise ValueError("AI 모델이 유효한 JSON을 생성하지 못했습니다.")

            # 5. DB 저장 (auto_score_details에 저장)
            report.auto_score_details = json_string
            db.session.commit()
            
            print(f"[GradingService] Report {report_id} 자동 채점 완료 및 저장 성공.")
            return result_json

        except Exception as e:
            db.session.rollback()
            print(f"[GradingService] CRITICAL: Report {report_id} 채점 중 오류 발생: {e}")
            # 오류 발생 시 auto_score_details에 에러 메시지 저장 (선택적)
            try:
                # report 변수가 위 try 블록에서 할당되었는지 확인
                if report is None:
                    report = AnalysisReport.query.get(report_id)
                
                if report:
                    report.auto_score_details = json.dumps({"error": str(e)})
                    db.session.commit()
            except Exception as db_e:
                print(f"[GradingService] 에러 메시지 저장 실패: {db_e}")
                db.session.rollback() # 에러 저장 실패 시 롤백
            
            return None # 실패 시 None 반환

    # --- [신규] 일괄 자동 채점 메서드 ---
    
    def run_bulk_auto_grading(self, assignment_id):
        """
        [신규] 특정 과제에 속한, 아직 자동 채점이 안 된 모든 리포트를 찾아
        순차적으로 자동 채점을 실행합니다.
        (백그라운드 스레드에서 호출됨)
        """
        if not self.model:
            print("[BulkAutoGrade] FAILED: 모델이 초기화되지 않아 일괄 채점 작업을 시작할 수 없습니다.")
            return
            
        print(f"[BulkAutoGrade] Task started for Assignment {assignment_id}.")

        # 1. 자동 채점이 필요한 리포트 목록 조회
        # (제출되었고, auto_score_details가 비어있는 리포트)
        try:
            target_reports = AnalysisReport.query.filter(
                AnalysisReport.assignment_id == assignment_id,
                AnalysisReport.auto_score_details == None
            ).all()
        except Exception as e:
            print(f"[BulkAutoGrade] FAILED: DB에서 리포트 목록 조회 중 오류: {e}")
            return

        if not target_reports:
            print(f"[BulkAutoGrade] No reports found needing auto-grading for Assignment {assignment_id}.")
            return

        print(f"[BulkAutoGrade] Found {len(target_reports)} reports to grade for Assignment {assignment_id}.")

        success_count = 0
        fail_count = 0

        # 2. 각 리포트에 대해 run_auto_grading() 개별 호출
        for report in target_reports:
            try:
                print(f"[BulkAutoGrade] Processing Report {report.id}...")
                
                # 기존의 단일 채점 함수를 재사용합니다.
                # 이 함수는 API 호출, JSON 파싱, DB 저장을 모두 처리하며,
                # 자체 예외 처리가 있어, 실패 시 '{"error":...}'를 DB에 저장합니다.
                result_json = self.run_auto_grading(report.id)

                if result_json is None:
                    # run_auto_grading이 None을 반환한 경우 (예외 발생)
                    fail_count += 1
                    print(f"[BulkAutoGrade] Report {report.id} failed (see service log for critical error).")
                elif result_json.get("error"):
                    # run_auto_grading이 오류 JSON을 반환한 경우 (거의 없음, 보통 None 반환)
                    fail_count += 1
                    print(f"[BulkAutoGrade] Report {report.id} failed (error saved to report).")
                else:
                    success_count += 1
                    print(f"[BulkAutoGrade] Report {report.id} graded successfully.")
            
            except Exception as e:
                # run_auto_grading에서 잡히지 않은 최상위 예외 (드문 경우)
                fail_count += 1
                print(f"[BulkAutoGrade] CRITICAL: Unhandled exception for Report {report.id}: {e}")
                # 이 경우 DB에 에러가 저장되지 않았을 수 있으므로 수동으로 저장 시도
                try:
                    db.session.rollback() # 이전 세션 정리
                    error_report = AnalysisReport.query.get(report.id)
                    if error_report:
                        error_report.auto_score_details = json.dumps({"error": f"Critical bulk grading error: {str(e)}"})
                        db.session.commit()
                except Exception as db_e:
                    print(f"[BulkAutoGrade] CRITICAL: Failed to save unhandled exception to DB: {db_e}")
                    db.session.rollback()

        print(f"[BulkAutoGrade] Task finished for Assignment {assignment_id}. Total: {len(target_reports)}, Success: {success_count}, Failed: {fail_count}.")
