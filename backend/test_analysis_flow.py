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
생성형 AI의 발전은 기존 저작권 법 체계에 심각한 도전을 제기하고 있다. 
현행법은 인간의 사상과 감정을 표현한 것만을 저작물로 인정하기 때문에, 
AI가 생성한 결과물은 저작권 보호의 사각지대에 놓여 있다. 
본 보고서는 AI 창작물의 법적 지위를 '업무상 저작물'의 개념을 차용하여 
해결할 것을 제안한다. 즉, AI를 도구로 사용한 사용자의 기여도를 인정하여 
제한적인 저작권을 부여해야 산업 발전을 저해하지 않으면서 창작자의 권리를 보호할 수 있다.
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