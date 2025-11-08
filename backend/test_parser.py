import re

def _parse_similarity_level(report_text):
    """
    LLM이 생성한 비교 보고서 텍스트에서 'Similarity Level'을 파싱합니다.
    """
    # 텍스트에서 'Similarity Level:**' 뒤의 내용을 찾습니다.
    # (소문자 변환, 공백/줄바꿈 제거)
    try:
        match = re.search(r"Similarity Level:\s*(.+)", report_text, re.IGNORECASE)
        if match:
            level = match.group(1).strip().lower()
            if "very high" in level:
                return "Very High"
            if "high" in level:
                return "High"
            if "moderate" in level:
                return "Moderate"
            if "low" in level:
                return "Low"
    except Exception as e:
        print(f"파싱 중 에러 발생: {e}")
        pass
    return "Unknown" # 파싱 실패

# --- 여기가 실제 테스트가 실행되는 부분입니다 ---
if __name__ == "__main__":
    
    # ⬇️⬇️⬇️ 3단계: 여기에 실제 데이터를 붙여넣으세요 ⬇️⬇️⬇️
    TEST_STRING = """
- **Similarity Level:** Low
- **Detailed Evaluation:**
  1. **Core Thesis Similarity:** 두 보고서의 핵심 주장은 완전히 다릅니다. ...
  2. **Argument Similarity (primary_argument_1/2):** 논거의 내용과 구조 모두에서 ...
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
