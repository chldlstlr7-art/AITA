import re

import re # (app.py 상단)

def _parse_similarity_level(report_text):
    """
    LLM이 생성한 비교 보고서 텍스트에서 'Similarity Level'을 파싱합니다.
    (Key는 영어, Value는 한국어/영어 모두 처리)
    """
    try:
        # 1. (최종 수정) Key는 'Similarity Level'로 고정, **(별표)는 옵션
        #    re.search(r"Similarity Level:.*?\s*(.+)", ...)
        #    - 'Similarity Level:' : 'Similarity Level:' 글자를 찾음
        #    - '.*?' : ':' 뒤에 ** 같은 문자가 있든 없든 모두 통과 (Non-Greedy)
        #    - '\s*' : 공백이 있든 없든 통과
        #    - '(.+)' : 공백 뒤의 '값' (예: '낮음')을 캡처 (그룹 1)
        match = re.search(r"Similarity Level:.*?\s*(.+)", report_text, re.IGNORECASE)
        
        if match:
            level = match.group(1).strip().lower() # 캡처된 값 (예: '낮음')
            
            # 2. 한국어/영어 값 매핑
            if "very high" in level or "매우 높음" in level:
                return "Very High"
            if "high" in level or "높음" in level:
                return "High"
            if "moderate" in level or "보통" in level:
                return "Moderate"
            if "low" in level or "낮음" in level:
                return "Low"
            
    except Exception as e:
        print(f"[_parse_similarity_level] 파싱 중 에러 발생: {e}")
        pass
    
    return "Unknown" # 파싱 실패

# --- 여기가 실제 테스트가 실행되는 부분입니다 ---
if __name__ == "__main__":
    
    # ⬇️⬇️⬇️ 3단계: 여기에 실제 데이터를 붙여넣으세요 ⬇️⬇️⬇️
    TEST_STRING = """
         },
                {
                    "file": "더미6.txt",
                    "llm_comparison_report": "- **Similarity Level:** 낮음\n- **Detailed Evaluation:**\n  1. **핵심 주장 유사성(Core Thesis Similarity):** '제출본'은 정보 과잉 시대의 '비판적 사고'를 주제로 삼아, 이를 정보의 진위를 가리는 '인지적 면역 체계'로 정의합니다. 반면, '후보'는 '역사 교육'을 주제로 하여, 이를 과거의 비극을 막기 위한 '기억의 윤리' 계승으로 규정합니다. 두 보고서의 핵심 주제와 주장이 완전히 상이하여 개념적 연관성이 전혀 없습니다.\n  2. **핵심 논거 유사성(Argument Similarity):** '제출본'은 비판적 사고의 역할을 '개인적 차원'(주체적 의사결정)과 '사회적 차원'(공론장 해독)으로 나누어 분석합니다. '후보'는 역사 망각의 폐해를 '비판적 판단력 상실'과 '공동체 정체성 약화'라는 두 가지 측면에서 설명합니다. 두 보고서의 논거는 각기 다른 핵심 주장을 뒷받침하기 위해 설계되었으며, 내용과 접근 방식에서 공통점을 찾을 수 없습니다.\n  3. **핵심 개념 유사성(Key Concepts Similarity):** '제출본'의 핵심 개념('인지적 면역 체계', '확증 편향', '정보 리터러시' 등)은 정보학, 미디어학, 인지심리학 분야에 집중되어 있습니다. '후보'의 핵심 개념('기억의 윤리', '공동체의 정체성', '홀로코스트 교육' 등)은 역사학, 사회학, 윤리학 분야에 속합니다. 사용된 개념어 목록에 겹치는 부분이 전혀 없으며, 서로 다른 학문적 배경을 가집니다.\n  4. **논리 구조 유사성(Logical Flow Similarity):** 두 보고서 모두 '문제 제기(서론) → 논거 제시(본론) → 대안 제언 → 결론'이라는 논설문의 전형적인 구조를 따릅니다. 그러나 이는 형식적인 유사성에 불과합니다. '제출본'은 '개인-사회'라는 분석 틀을 사용하는 반면, '후보'는 '원인-결과' 방식의 논리 구조를 통해 주장을 전개합니다. 다루는 문제, 분석의 틀, 제안하는 해결책이 모두 다르므로, 내용적, 개념적 논리의 흐름은 완전히 이질적입니다.",
                    "sbert_similarity": 0.4782290041093883
"""
    # ⬆️⬆️⬆️ 3단계: 여기에 실제 데이터를 붙여넣으세요 ⬆️⬆️⬆️

    print("--- 테스트 시작 ---")
    print(f"입력 문자열 (일부): {TEST_STRING[:80]}...")
    
    parsed_level = _parse_similarity_level(TEST_STRING)
    
    print("\n--- 테스트 결과 ---")
    print(f"파싱된 레벨: {parsed_level}")

    if parsed_level in ["High", "Very High", "Moderate", "Low"]:
        print("✅ 검증 성공: 유효한 레벨을 파싱했습니다.")
    else:
        print("❌ 검증 실패: 'Unknown'이 반환되었습니다. 정규표현식을 점검하세요.")
