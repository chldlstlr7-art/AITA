# services/grading_service.py

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
    
    def __init__(self, model_name='gemini-2.5-pro'):
        """
        Gemini 모델을 초기화합니다.
        JSON 출력을 위해 'response_mime_type'을 설정합니다.
        """
        self.model = genai.GenerativeModel(
            model_name,
            # JSON 모드 활성화: 프롬프트 지침에 따라 JSON만 생성하도록 강제
            generation_config={"response_mime_type": "application/json"}
        )
        print(f"[GradingService] {model_name} 모델이 초기화되었습니다 (JSON 모드).")

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
                report = AnalysisReport.query.get(report_id)
                if report:
                    report.auto_score_details = json.dumps({"error": str(e)})
                    db.session.commit()
            except Exception as db_e:
                print(f"[GradingService] 에러 메시지 저장 실패: {db_e}")
            
            return None