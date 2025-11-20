import os
import json
import threading
import time
from flask import Flask
from unittest.mock import MagicMock

# [중요] 실제 서비스 로직 임포트
# (services 폴더가 있고 그 안에 deep_analysis_service.py가 있어야 함)
try:
    from services.deep_analysis_service import perform_deep_analysis_async
except ImportError:
    print("❌ 'services.deep_analysis_service'를 찾을 수 없습니다.")
    print("   이전 답변의 코드를 'services/deep_analysis_service.py'로 저장해주세요.")
    exit(1)

# ======================================================================================
# 1. [Mock Setup] Flask, DB, Model 가상화
#    (실제 DB 없이 로직 흐름을 검증하기 위함)
# ======================================================================================

# 가짜 Flask 앱
app = Flask(__name__)

# 가짜 DB 세션 및 모델
class MockDB:
    session = MagicMock()
    
    def commit(self):
        # 실제 commit은 안 하지만, 호출되었다는 로그는 남김
        # print("   💾 [MockDB] commit() called.")
        pass

db = MockDB()

# 가짜 리포트 모델 (SQLAlchemy Model 흉내)
class MockAnalysisReport:
    def __init__(self, report_id, summary, text_snippet):
        self.id = report_id
        self.summary = summary
        self.text_snippet = text_snippet # 또는 content
        self.deep_analysis_data = None   # JSON 문자열이 저장될 곳

    # 쿼리 메서드 흉내
    @classmethod
    def query_get(cls, report_id):
        # 테스트용 전역 저장소에서 가져옴
        return MOCK_DB_STORAGE.get(report_id)

# 테스트용 인메모리 DB 저장소
MOCK_DB_STORAGE = {}

# AnalysisReport 클래스에 query 속성 주입
AnalysisReport = MagicMock()
AnalysisReport.query.get = MockAnalysisReport.query_get


# ======================================================================================
# 2. [Target Logic] student_api.py의 핵심 함수 가져오기
#    (사용자가 제공한 코드를 그대로 사용하되, import만 위에서 정의한 Mock으로 연결)
# ======================================================================================

def _background_deep_analysis(app, report_id):
    """
    [Test Target] student_api.py에 있는 함수 로직 그대로.
    단, perform_deep_analysis_async는 '실제 모듈'을 사용함.
    """
    # DB 동시 쓰기 방지를 위한 Lock
    db_lock = threading.Lock()

    with app.app_context():
        try:
            print(f"🔄 [Background] Report #{report_id} 스레드 시작.")

            # 1. 초기 상태 설정
            report = AnalysisReport.query.get(report_id)
            if not report: 
                print("❌ 리포트 없음")
                return

            initial_data = {
                "status": "processing",
                "neuron_map": None,
                "integrity_issues": None,
                "flow_disconnects": None
            }
            report.deep_analysis_data = json.dumps(initial_data)
            db.session.commit() # Mock DB commit

            # 2. 데이터 준비
            try:
                summary_json = json.loads(report.summary) if isinstance(report.summary, str) else report.summary
            except:
                summary_json = report.summary
            
            raw_text = report.text_snippet

            # ---------------------------------------------------------
            # [콜백 함수] 부분 업데이트 로직
            # ---------------------------------------------------------
            def save_partial_result(key, data):
                with db_lock:
                    with app.app_context():
                        # 최신 데이터 다시 조회
                        repo = AnalysisReport.query.get(report_id)
                        if not repo: return
                        
                        # [검증 포인트] 여기서 실제로 데이터가 업데이트되는지 확인
                        current_json = json.loads(repo.deep_analysis_data) if repo.deep_analysis_data else {}
                        current_json[key] = data
                        repo.deep_analysis_data = json.dumps(current_json, ensure_ascii=False)
                        
                        db.session.commit()
                        
                        # 시각적 확인을 위한 출력
                        preview = str(data)[:] + "..." if len(str(data)) > 30 else str(data)
                        print(f"   💾 [DB Update Callback] Key='{key}' | Data={preview}")

            # 3. [핵심] 실제 서비스 모듈 호출 (Mock 아님!)
            print("   🚀 [Service] perform_deep_analysis_async 호출 (실제 API 연동)")
            perform_deep_analysis_async(summary_json, raw_text, on_task_complete=save_partial_result)

            # 4. 최종 상태 완료 처리
            with db_lock:
                repo = AnalysisReport.query.get(report_id)
                current_json = json.loads(repo.deep_analysis_data)
                current_json["status"] = "completed"
                repo.deep_analysis_data = json.dumps(current_json, ensure_ascii=False)
                db.session.commit()
                print(f"✅ [Background] Report #{report_id} 모든 작업 완료 (Status: completed).")

        except Exception as e:
            print(f"❌ [Background Error] {e}")
            import traceback
            traceback.print_exc()


# ======================================================================================
# 3. [Main] 통합 테스트 실행기
# ======================================================================================

if __name__ == "__main__":
    # API 키 확인 (실제 호출용)
    if not os.environ.get('NAVER_CLOVA_URL') or not os.environ.get('NAVER_API_KEY'):
        print("\n⚠️  [경고] 네이버 API 환경변수가 없습니다. Mock 응답으로 동작할 수 있습니다.")
        print("    export NAVER_CLOVA_URL='...'")
        print("    export NAVER_API_KEY='...'\n")

    print("==========================================================")
    print("🧪 Integration Test: Student API Worker + Real Service")
    print("==========================================================")

    # 1. 테스트 데이터 생성 (DB에 리포트가 있다고 가정)
    test_report_id = 101
    
    test_summary = {
    "Claim": "조기 전공 확정 시스템으로 인한 청년 세대의 진로 불안을 해소하기 위해서는 무전공 입학 및 전공 자유 이수제 도입과 의무적 진로 지도 강화를 통해 유연하고 지속적인 진로 탐색의 장을 마련하는 근본적인 시스템 변화가 필수적입니다.",
    "Conclusion_Framing": "결론은 청년 세대의 진로 불안을 해소하기 위한 유일한 방법으로 '근본적인 시스템 변화'의 필요성을 강조하며, 이러한 변화만이 긍정적인 미래를 가져올 수 있다는 정책 제언적이자 미래 지향적인 어조로 마무리됩니다.",
    "Core_Thesis": "한국 대학의 조기 전공 확정 시스템은 청년 세대의 진로 불안을 심화시키고 진로 탐색을 왜곡하므로, 전공 선택 유연화 방안(무전공 입학, 전공 자유 이수제) 도입 및 의무적 진로 지도 강화를 통해 근본적인 시스템 변화를 이루어야 한다.",
    "Flow_Pattern": {
      "edges": [
        [
          "P1",
          "T1"
        ],
        [
          "T1",
          "R1"
        ],
        [
          "R1",
          "E1"
        ],
        [
          "T1",
          "R2"
        ],
        [
          "T1",
          "C1"
        ],
        [
          "R1",
          "C1"
        ],
        [
          "R2",
          "C1"
        ]
      ],
      "nodes": {
        "C1": "[결론]\n 근본적인 시스템의 변화만이 전공 선택이 청년들의 진로 불안을 가중시키는 굴레에서 벗어나도록 만들 수 있다.",
        "E1": "[세부 예시]\n '다시 대학에 간다면 전공을 바꾸고 싶다'는 대규모 설문조사 결과.",
        "P1": "[문제 제기]\n 한국 대학의 조기 전공 확정 시스템이 진로 탐색 방해 및 진로 불안 심화의 근본 원인이다.",
        "R1": "[근거]\n 불완전한 정보로 인한 조기 전공 확정은 '선택 후회'를 유발한다.",
        "R2": "[근거]\n 경직된 시스템은 학생들의 '자기 효능감' 발달 및 능동적 진로 인식을 저해하고 미래에 대한 통제력 상실을 야기한다.",
        "T1": "[핵심 주장]\n 조기 전공 확정 시스템으로 인한 청년 세대의 진로 불안을 해소하기 위해 전공 선택 유연화(무전공 입학, 전공 자유 이수제) 및 의무적 진로 지도를 통한 근본적인 시스템 변화가 필요하다."
      }
    },
    "Problem_Framing": "서론에서 현재 조기 전공 확정 시스템이 학생들의 건전한 진로 탐색을 방해하고 장기적인 진로 불안을 심화시키는 구조적 모순을 내포하고 있음을 지적하며 문제를 제기합니다. 전공이 곧 개인의 미래를 상징하는 강력한 표식이 되어 극심한 압박감을 유발하며, 이러한 '조기 확정' 방식이 본질적인 진로 탐색을 왜곡한다는 필자의 주장을 직접적으로 제시하는 방식으로 전개됩니다.",
    "Reasoning_Logic": "글은 현재 조기 전공 확정 시스템의 구조적 문제점을 제시하며 시작합니다. 첫 번째 근거로 정보 비대칭성으로 인한 '선택 후회' 발생을 주장하며, 이를 '다시 대학에 간다면 전공을 바꾸고 싶다'는 대규모 설문조사 결과라는 경험적 증거로 뒷받침합니다. 두 번째 근거로는 경직된 시스템이 '자기 효능감' 발달과 능동적 진로 인식을 저해하고 미래에 대한 통제력 상실을 야기한다는 논리를 펼칩니다. 이러한 문제점들을 바탕으로 마지막 단락에서 '유연하고 지속적인 진로 탐색의 장'을 위한 구체적인 혁신 방향(무전공 입학, 전공 자유 이수제, 의무적 진로 지도)을 제시하며 시스템 변화의 필요성을 강조하는 전형적인 문제-원인-해결책 구조의 설득적 논리 전개를 보입니다.",
    "Specific_Evidence": "본문에는 '선택 후회(Post-choice Regret)'라는 특정 개념, '다시 대학에 간다면 전공을 바꾸고 싶다'는 대규모 설문조사 결과(구체적인 출처는 제시되지 않음), '자기 효능감'이라는 심리학적 개념, 그리고 해결책으로 '무전공 입학 및 전공 자유 이수제', '전공 선택 유연화 방안'과 같은 구체적인 정책/제도 명칭이 언급됩니다.",
    "assignment_type": "논설문",
    "key_concepts": "조기 전공 확정 시스템, 진로 불안, 선택 후회, 정보 비대칭성, 자기 효능감, 전공 선택 유연화, 의무적 진로 지도"
  }
    
    test_text = """
   조기 전공 확정 시스템, 청년 세대의 진로 불안을 키우는 근본 원인\r\n현재 한국 대학의 조기 전공 확정 
   시스템은 학생들의 건전한 진로 탐색을 방해하고, 장기적인 진로 불안을 심화시키는 구조적 모순을 내포하고 있습니다.
    전공이 곧 개인의 사회적 지위와 미래를 상징하는 강력한 표식이 되면서, 학생들은 초기 선택의 실패가 곧 인생의 실패로 이어질 것이라는 
    극심한 압박감 속에 놓이게 됩니다. 저는 이러한 '조기 확정' 방식이 본질적인 진로 탐색을 왜곡한다고 주장합니다.\r\n1. :돋보기: 정보 비대칭성이
     낳는 '선택 후회(Post-choice Regret)'\r\n고등학교 졸업 직후 또는 대학 신입생이 불완전한 정보만으로 4년 후의 산업 동향과 
     자신의 적성을 정확히 예측하여 최적의 전공을 선택하는 것은 현실적으로 불가능합니다. 학생들은 주로 취업률 통계나 파편적인 경험담에 
     의존하며, 이러한 제한된 정보에 기반한 결정은 필연적으로 대학 재학 중 **'선택 후회'**를 유발합니다.\r\n경험적 증거: \"다시 대학에 간다면
      전공을 바꾸고 싶다\"는 대규모 설문조사 결과는 현행 조기 확정 시스템의 실패를 명확하게 보여주는 지표입니다.\r\n2. :방패: 경직된 시스템이 
      저해하는 '자기 효능감'과 능동적 진로 인식\r\n대학의 폐쇄적인 전공 변경 및 융합 교육 환경은 학생들의 자기 효능감 발달을 저해하고 진로를 
      수동적으로 인식하게 만듭니다.\r\n역량의 한계 설정: 학생들은 자신이 선택한 전공을 자신의 잠재적 역량의 한계로 간주하며, 전공 외 분야 탐색이나
       새로운 기술 습득의 기회를 스스로 차단하게 됩니다.\r\n미래에 대한 통제력 상실: 급변하는 노동 시장에서 능동적으로 대처하기보다는 시스템이 
       정해준 길에 의존하려는 경향은 미래에 대한 심각한 통제력 상실과 불안감을 유발하는 치명적인 약점으로 작용합니다.\r\n:전구: 혁신 방향: 
       유연하고 지속적인 진로 탐색의 장으로\r\n따라서 대학은 전공을 단순히 지식 습득의 수단이 아닌, 지속적인 자기 탐색의 장으로 인식하도록 
       시스템을 혁신해야 합니다.\r\n무전공 입학 및 전공 자유 이수제: 학생들이 2~3학년에 이르러 최종 전공을 확정하도록 하는 **'전공 선택 유
       연화 방안'**을 적극적으로 도입해야 합니다.\r\n의무적 진로 지도: 학부 전반에 걸친 광범위한 진로 지도를 의무화하여, 학생들이 충분한 정
       보를 바탕으로 주도적인 선택을 할 수 있도록 지원해야 합니다.\r\n이러한 근본적인 시스템의 변화만이 전공 선택이 청년들의 진로 불안을 가
       중시키는 굴레에서 벗어나도록 만들 수 있습니다.
    """

    # Mock DB에 데이터 삽입
    mock_report = MockAnalysisReport(test_report_id, test_summary, test_text)
    MOCK_DB_STORAGE[test_report_id] = mock_report

    print(f"[Init] Mock DB에 Report #{test_report_id} 생성 완료.")

    # 2. 백그라운드 작업 함수 직접 실행 (스레드 없이 동기적으로 호출하여 로그 확인)
    #    실제 코드에서는 스레드로 돌지만, 테스트에서는 에러를 바로 잡기 위해 직접 호출합니다.
    #    _get_current_object() 대신 테스트용 app 전달
    
    start_time = time.time()
    
    _background_deep_analysis(app, test_report_id)
    
    end_time = time.time()

    # 3. 최종 검증
    print("\n==========================================================")
    print("📊 [Final Verification] DB 데이터 검증")
    print("==========================================================")
    
    final_data_str = mock_report.deep_analysis_data
    final_data = json.loads(final_data_str)
    
    # (1) 상태 확인
    status = final_data.get("status")
    print(f"1. Status: {status} ", end="")
    if status == "completed": print("✅ PASS")
    else: print("❌ FAIL")

    # (2) 데이터 존재 확인
    print(f"2. Neuron Map: {'✅ 있음' if final_data.get('neuron_map') else '❌ 없음'}")
    print(f"3. Integrity:  {'✅ 있음' if final_data.get('integrity_issues') is not None else '❌ 없음'}")
    print(f"4. Disconnect: {'✅ 있음' if final_data.get('flow_disconnects') is not None else '❌ 없음'}")
    
    print(f"\n⏱️ 총 소요 시간: {end_time - start_time:.2f}초")