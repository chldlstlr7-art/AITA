import sys
import os
import json
from app import app  # app.py에서 Flask 설정(API Key, DB 설정 등)을 가져옴
from config import JSON_SYSTEM_PROMPT, COMPARISON_SYSTEM_PROMPT
from services.analysis_service import (
    perform_step1_analysis_and_embedding,
    perform_step2_comparison
)

# -------------------------------------------------------------------------
# [테스트용 더미 데이터]
# 학생이 제출했다고 가정하는 텍스트
# -------------------------------------------------------------------------
TEST_REPORT_ID = 777  # 로그용 가상 ID
TEST_TEXT = """
"조기 전공 확정 시스템, 청년 세대의 진로 불안을 키우는 근본 원인\r\n현재 한국 대학의 조기 전공 확정 시스템은 학생들의 건전한 진로 탐색을 방해하고, 장기적인 진로 불안을 심화시키는 구조적 모순을 내포하고 있습니다. 전공이 곧 개인의 사회적 지위와 미래를 상징하는 강력한 표식이 되면서, 학생들은 초기 선택의 실패가 곧 인생의 실패로 이어질 것이라는 극심한 압박감 속에 놓이게 됩니다. 저는 이러한 '조기 확정' 방식이 본질적인 진로 탐색을 왜곡한다고 주장합니다.\r\n1. :돋보기: 정보 비대칭성이 낳는 '선택 후회(Post-choice Regret)'\r\n고등학교 졸업 직후 또는 대학 신입생이 불완전한 정보만으로 4년 후의 산업 동향과 자신의 적성을 정확히 예측하여 최적의 전공을 선택하는 것은 현실적으로 불가능합니다. 학생들은 주로 취업률 통계나 파편적인 경험담에 의존하며, 이러한 제한된 정보에 기반한 결정은 필연적으로 대학 재학 중 **'선택 후회'**를 유발합니다.\r\n경험적 증거: \"다시 대학에 간다면 전공을 바꾸고 싶다\"는 대규모 설문조사 결과는 현행 조기 확정 시스템의 실패를 명확하게 보여주는 지표입니다.\r\n2. :방패: 경직된 시스템이 저해하는 '자기 효능감'과 능동적 진로 인식\r\n대학의 폐쇄적인 전공 변경 및 융합 교육 환경은 학생들의 자기 효능감 발달을 저해하고 진로를 수동적으로 인식하게 만듭니다.\r\n역량의 한계 설정: 학생들은 자신이 선택한 전공을 자신의 잠재적 역량의 한계로 간주하며, 전공 외 분야 탐색이나 새로운 기술 습득의 기회를 스스로 차단하게 됩니다.\r\n미래에 대한 통제력 상실: 급변하는 노동 시장에서 능동적으로 대처하기보다는 시스템이 정해준 길에 의존하려는 경향은 미래에 대한 심각한 통제력 상실과 불안감을 유발하는 치명적인 약점으로 작용합니다.\r\n:전구: 혁신 방향: 유연하고 지속적인 진로 탐색의 장으로\r\n따라서 대학은 전공을 단순히 지식 습득의 수단이 아닌, 지속적인 자기 탐색의 장으로 인식하도록 시스템을 혁신해야 합니다.\r\n무전공 입학 및 전공 자유 이수제: 학생들이 2~3학년에 이르러 최종 전공을 확정하도록 하는 **'전공 선택 유연화 방안'**을 적극적으로 도입해야 합니다.\r\n의무적 진로 지도: 학부 전반에 걸친 광범위한 진로 지도를 의무화하여, 학생들이 충분한 정보를 바탕으로 주도적인 선택을 할 수 있도록 지원해야 합니다.\r\n이러한 근본적인 시스템의 변화만이 전공 선택이 청년들의 진로 불안을 가중시키는 굴레에서 벗어나도록 만들 수 있습니다."
"""

def run_analysis_test():
    print("\n>>> [테스트 시작] Analysis Service (Naver HyperCLOVA X)\n")

    # Flask Context 안에서 실행해야 DB 및 Config 접근 가능
    with app.app_context():
        
        # ====================================================
        # [Step 1] 분석 및 임베딩 (perform_step1_analysis_and_embedding)
        # ====================================================
        print(f"--- [Step 1] 문서 구조 분석 및 임베딩 생성 ---")
        print(f"Target Text Length: {len(TEST_TEXT)} characters")
        
        step1_result = None
        try:
            # 1단계 함수 호출
            step1_result = perform_step1_analysis_and_embedding(
                report_id=TEST_REPORT_ID,
                text=TEST_TEXT,
                json_prompt_template=JSON_SYSTEM_PROMPT
            )
            
            if step1_result:
                print("✅ [Step 1] 성공!")
                summary = step1_result['summary_json']
                print(f"   ▶ 분석된 핵심 주장: {summary}...")
                print(f"   ▶ 생성된 임베딩(Thesis) 차원: {len(step1_result['embedding_thesis'])}")
            else:
                print("❌ [Step 1] 실패: 결과가 없습니다.")
                return # 1단계 실패시 중단

        except Exception as e:
            print(f"❌ [Step 1] 에러 발생: {e}")
            import traceback
            traceback.print_exc()
            return

        print("\n" + "="*50 + "\n")

        # ====================================================
        # [Step 2] 유사도 비교 (perform_step2_comparison)
        # ====================================================
        print(f"--- [Step 2] 유사 문서 검색 및 비교 ---")
        # 주의: 이 단계는 DB에 'is_test=False'인 다른 리포트들이 있어야 실제로 비교가 수행됩니다.
        # DB가 비어있다면 비교 대상이 없어 결과가 빈 리스트([])로 나올 것입니다.
        
        try:
            embedding_thesis = step1_result['embedding_thesis']
            embedding_claim = step1_result['embedding_claim']
            submission_json_str = json.dumps(step1_result['summary_json'])

            comparison_results = perform_step2_comparison(
                report_id=TEST_REPORT_ID,
                embedding_thesis=embedding_thesis,
                embedding_claim=embedding_claim,
                submission_json_str=submission_json_str,
                comparison_prompt_template=COMPARISON_SYSTEM_PROMPT
            )

            if isinstance(comparison_results, list):
                print(f"✅ [Step 2] 성공! (비교 수행된 문서 수: {len(comparison_results)})")
                
                if len(comparison_results) > 0:
                    first_match = comparison_results[0]
                    print(f"   ▶ 가장 유사한 문서 ID: {first_match['candidate_id']}")
                    print(f"   ▶ 가중 유사도 점수: {first_match['weighted_similarity']:.4f}")
                    print(f"   ▶ LLM 비교 리포트 일부:\n{first_match['llm_comparison_report'][:]}...")
                else:
                    print("   ℹ️ 비교 결과가 0개입니다. (DB에 비교할 다른 리포트가 없거나, 유사도가 낮음)")
                    print("   (정상 동작입니다. DB에 데이터가 쌓여야 작동합니다.)")
            else:
                print("❌ [Step 2] 실패: 결과 형식이 올바르지 않습니다.")

        except Exception as e:
            print(f"❌ [Step 2] 에러 발생: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_analysis_test()