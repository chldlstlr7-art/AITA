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
    
    def __init__(self, model_name='gemini-2.5-flash'): # [예시] 모델명은 최신 버전을 권장합니다.
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
            -   `feedback`은 해당 항목에 대한 구체적인 세 줄 피드백입니다.
        2.  `total` (Number):
            -   모든 `score`의 총합입니다.
        3.  `overall_feedback` (String):
            -   리포트 전체에 대한 2-3문장 이내의 종합 피드백입니다.
        
        [지시]
        - 다른 말은 절대 덧붙이지 말고, 오직 위에서 설명한 구조의 JSON 객체만 생성하세요.
        - 모든 점수는 [평가 기준]에 명시된 만점을 초과할 수 없습니다.
        - [리포트 본문]이 기준에 미달하면 0점을 부여할 수 있습니다.
        """

    def _validate_and_parse_llm_output(self, json_string, criteria_dict):
        """
        LLM 출력 JSON을 robust하게 파싱 및 검증합니다.
        필수 필드, 타입, 점수 범위, 피드백 등 체크.
        """
        try:
            result = json.loads(json_string)
        except Exception as e:
            raise ValueError(f"LLM 출력이 JSON 형식이 아닙니다: {e}")

        # 필수 필드 체크
        if not isinstance(result, dict):
            raise ValueError("LLM 출력이 dict가 아닙니다.")
        if "scores" not in result or "total" not in result or "overall_feedback" not in result:
            raise ValueError("LLM 출력에 필수 필드가 누락되었습니다.")
        if not isinstance(result["scores"], list):
            raise ValueError("scores 필드는 리스트여야 합니다.")
        if not isinstance(result["total"], (int, float)):
            raise ValueError("total 필드는 숫자여야 합니다.")
        if not isinstance(result["overall_feedback"], str):
            raise ValueError("overall_feedback 필드는 문자열이어야 합니다.")

        # 각 score 항목 검증
        for item in result["scores"]:
            if not isinstance(item, dict):
                raise ValueError("scores 리스트의 각 항목은 dict여야 합니다.")
            if "criteria_id" not in item or "score" not in item or "feedback" not in item:
                raise ValueError("scores 항목에 필수 필드가 누락되었습니다.")
            cid = item["criteria_id"]
            score = item["score"]
            feedback = item["feedback"]
            if cid not in criteria_dict:
                raise ValueError(f"criteria_id '{cid}'가 평가 기준에 없습니다.")
            max_score = criteria_dict[cid].get("max_score", None)
            if max_score is not None and score > max_score:
                raise ValueError(f"criteria_id '{cid}'의 score가 max_score({max_score})를 초과합니다.")
            if not isinstance(feedback, str):
                raise ValueError("feedback은 문자열이어야 합니다.")
        return result

    def run_auto_grading(self, report_id, ta_user_id=None):
        """
        특정 리포트에 대해 자동 채점을 실행하고 결과를 DB에 저장합니다.
        ta_user_id가 주어지면 권한 체크도 수행합니다.
        """
        if not self.model:
            print(f"[GradingService] ERROR: 모델이 초기화되지 않아 Report {report_id} 채점을 건너뜁니다.")
            return None
        report = None
        try:
            # 1. 데이터 로드
            report, assignment, doc_text, criteria_dict = self._get_report_and_criteria(report_id)
            # 1-1. TA 권한 체크 (옵션)
            if ta_user_id:
                course = assignment.course
                if not any(a.id == ta_user_id for a in course.assistants):
                    raise ValueError("해당 리포트에 대한 채점 권한이 없습니다.")
            # 2. 프롬프트 생성
            criteria_str = self._format_criteria_for_prompt(criteria_dict)
            prompt = self._build_prompt(
                course_name=assignment.course.course_name,
                assignment_name=assignment.assignment_name,
                criteria_str=criteria_str,
                document_text=doc_text
            )
            # 3. Gemini API 호출
            print(f"[GradingService] Report {report_id} 자동 채점 시작...")
            response = self.model.generate_content(prompt)
            json_string = response.text
            # 4. robust 파싱 및 검증
            result_json = self._validate_and_parse_llm_output(json_string, criteria_dict)
            # 5. DB 저장
            report.auto_score_details = json.dumps(result_json, ensure_ascii=False)
            db.session.commit()
            print(f"[GradingService] Report {report_id} 자동 채점 완료 및 저장 성공.")
            return result_json
        except Exception as e:
            db.session.rollback()
            print(f"[GradingService] CRITICAL: Report {report_id} 채점 중 오류 발생: {e}")
            try:
                if report is None:
                    report = AnalysisReport.query.get(report_id)
                if report:
                    report.auto_score_details = json.dumps({"error": str(e)}, ensure_ascii=False)
                    db.session.commit()
            except Exception as db_e:
                print(f"[GradingService] 에러 메시지 저장 실패: {db_e}")
                db.session.rollback()
            return None

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
