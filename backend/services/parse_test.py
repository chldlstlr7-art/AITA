import math

# --- 1. 초기 점수 설정 (여기를 수정하세요) ---
# 각 항목에 대해 10점 만점 등의 '원점수'를 입력합니다.
scores = {
    "Core Thesis": 9,
    "Claim": 9,
    "Reasoning": 9,
    "Flow Pattern": 9,
    "Problem Framing": 9,
    "Conclusion Framing": 9
}

# 계산된 점수를 저장할 딕셔너리 및 총합 변수 초기화
calculated_scores = {}
total_score = 0

print("--- 📝 원점수 ---")
for key, value in scores.items():
    print(f"**{key}**: {value}점")
print("-" * 20)

# --- 2. 점수 계산 로직 적용 ---

# Core Thesis: (점수 - 7이 양수면 1, 아니면 0) * 7 + (점수 - 7이 양수면 7 초과분) * 3
original_ct = scores["Core Thesis"]
calculated_ct = min(1, max(0, original_ct - 7))*7 + max(0, original_ct - 7)*3
calculated_scores["Core Thesis"] = calculated_ct

# Claim: (점수 - 7이 양수면 1, 아니면 0) * 7 + (점수 - 7이 양수면 7 초과분) * 3
original_claim = scores["Claim"]
calculated_claim = min(1, max(0, original_claim - 7))*7 + max(0, original_claim - 7)*3
calculated_scores["Claim"] = calculated_claim
 
# Reasoning: (점수 - 5, 음수면 0)의 1.5승 * 2 를 정수 처리
original_reasoning = scores["Reasoning"]
calculated_reasoning = int(math.pow(max(0, original_reasoning - 5), 1.5) * 2)
calculated_scores["Reasoning"] = calculated_reasoning

# Flow Pattern: (점수 - 5, 음수면 0)의 1.2승 * 3 을 정수 처리 
original_fp = scores["Flow Pattern"]
calculated_fp = int(math.pow(max(0, original_reasoning - 5), 1.2) * 3)
calculated_scores["Flow Pattern"] = calculated_fp

# Problem Framing: (Claim 점수 - 7이 양수면 1, 아니면 0) * 8 + (Claim 점수 - 8이 양수면 8 초과분) * 3
original_pf = scores["Problem Framing"]
calculated_pf = min(1, max(0, original_claim - 7))*8 + max(0, original_claim - 8)*3
calculated_scores["Problem Framing"] = calculated_pf

# Conclusion Framing: (점수 - 7, 음수면 0) * 4
original_cf = scores["Conclusion Framing"]
calculated_cf = max(0, original_cf - 7) * 4
calculated_scores["Conclusion Framing"] = calculated_cf

# --- 3. 총합 계산 및 결과 출력 ---

print("--- 📊 계산된 점수 ---")
for key, value in calculated_scores.items():
    # 총합에 각 항목의 계산된 점수를 더합니다.
    total_score += value
    print(f"**{key}**: {value}점")

print("-" * 20)
print(f"**🌟 최종 총합 점수**: {total_score}점")