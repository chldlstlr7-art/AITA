import os
import json
import requests
import re
import ast
from time import sleep
from config import question_making_prompt, deep_dive_prompt
# --------------------------------------------------------------------------------------
# [설정] 테스트를 위한 API 키 및 URL 입력 (환경변수가 없으면 문자열을 직접 넣으세요)
# --------------------------------------------------------------------------------------
NAVER_CLOVA_URL = os.environ.get('NAVER_CLOVA_URL2', "https://clovastudio.stream.ntruss.com/v3/chat-completions/HCX-007") 
NAVER_API_KEY = os.environ.get('NAVER_API_KEY', "YOUR_ACTUAL_API_KEY_HERE")


# --------------------------------------------------------------------------------------
# --- 2. 헬퍼 함수 (작성해주신 코드 + re/ast import 포함) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text):
    """ [최신] Naver HyperCLOVA X API 호출 (Bearer Token 방식) """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY or "YOUR_" in NAVER_API_KEY:
        print("⚠️ [Error] Naver API 키 또는 URL이 설정되지 않았습니다.")
        return None

    headers = {
        'Authorization': f'Bearer {NAVER_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json'
    }

    data = {
        "messages": [
            {
                "role": "system",
                "content": "너는 논리적인 학술 멘토야."
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": 4096,
        "temperature": 0.5,
        "repeatPenalty": 5.0,
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }
    
    try:
        print(f"   >> [Naver API] Sending Request (JSON)...")
        response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
        response.raise_for_status()
        
        res_json = response.json()
        content_text = res_json.get('result', {}).get('message', {}).get('content', '')
        
        if not content_text:
            print(f"[Naver] Empty content received.")
            return None

        # --- [JSON 추출 및 파싱 로직] ---
        json_str = ""
        match = re.search(r"```json\s*([\s\S]+?)\s*```", content_text)
        if match:
            json_str = match.group(1)
        else:
            json_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content_text.strip())
            json_str = json_match.group(1) if json_match else content_text.strip()

        try:
            return json.loads(json_str, strict=False)
        except json.JSONDecodeError:
            pass

        try:
            return ast.literal_eval(json_str)
        except:
            pass

        try:
            json_str_clean = json_str.replace('\n', '\\n').replace('\r', '')
            return json.loads(json_str_clean, strict=False)
        except:
            pass
            
        print(f"[JSON Parsing Failed] Raw Content: {content_text[:200]}...")
        return None

    except Exception as e:
        print(f"[Naver API Error] {e}")
        return None


def _call_llm_text(prompt_text):
    """ [수정] Naver HyperCLOVA X API 호출 (Text 반환용 - Deep dive) """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY or "YOUR_" in NAVER_API_KEY:
        return None

    headers = {
        'Authorization': f'Bearer {NAVER_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json' 
    }

    data = {
        "messages": [
            {
                "role": "system",
                "content": "너는 통찰력 있는 멘토야. 분석 내용이나 부가 설명은 일절 생략하고, 학생에게 던질 '질문 문장 하나'만 출력해."
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": 1000, 
        "temperature": 0.5,
        "repeatPenalty": 5.0,
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }

    try:
        print(f"   >> [Naver API] Sending Request (Text)...")
        response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
        response.raise_for_status()
        
        res_json = response.json()
        content_text = res_json.get('result', {}).get('message', {}).get('content', '')
        
        return content_text.strip()

    except Exception as e:
        print(f"[Naver API Text Error] {e}")
        return None

# --------------------------------------------------------------------------------------
# --- 3. 메인 함수 (Test Target) ---
# --------------------------------------------------------------------------------------

def generate_initial_questions(summary_dict, high_similarity_reports_list, snippet):
    print("[Service QA] Generating 9 initial questions...")
    
    plagiarism_info = ""
    if high_similarity_reports_list:
        plagiarism_info += f"참고: {len(high_similarity_reports_list)}개의 문서와 총점 30점 이상의 높은 구조적 유사성(표절 의심)이 발견되었습니다.\n"
    else:
        plagiarism_info = "참고: 총점 50점 이상의 구조적 유사성을 보이는 문서는 발견되지 않았습니다."

    summary_text = f"""
    - 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
    - 사용된 근거(Reasoning): {summary_dict.get('Reasoning', 'N/A')}
    """

    prompt = question_making_prompt.format(
        plagiarism_data=plagiarism_info,
        summary_data=summary_text,
        snippet_data=snippet
    )
    
    questions = _call_llm_json(prompt)
    
    if not questions:
        print(f"[Service QA] FAILED: JSON parsing failed or API error.")
        return None
        
    print("[Service QA] Successfully generated initial questions.")
    return questions


def generate_deep_dive_question(conversation_history_list, summary_dict):
    """
    [수정] 심화 질문 1개를 생성합니다. (JSON 방식 적용)
    """
    print(f"[Service QA] Generating deep-dive question (JSON method)...")

    # 1. 대화 기록
    history_text = ""
    for qa in conversation_history_list:
        history_text += f"Q: {qa.get('question', 'N/A')}\nA: {qa.get('answer', 'N/A')}\n"
        
    # 2. 요약 정보
    summary_text = f"핵심 주장: {summary_dict.get('Claim', 'N/A')}"

    # 3. 프롬프트 포맷팅
    prompt = deep_dive_prompt.format(
        summary_data=summary_text,
        history_data=history_text
    )
    
    # 4. LLM 호출 (기존의 강력한 JSON 파서 재사용)
    # _call_llm_json은 이미 {role: system, content: "JSON만 줘..."} 설정이 되어 있어 안전함
    result_json = _call_llm_json(prompt)
    
    # 5. 결과 추출
    if not result_json or not isinstance(result_json, dict):
        print(f"[Service QA] FAILED: Deep-dive response is not a valid dict. Got: {result_json}")
        return None

    question_text = result_json.get("question")

    if not question_text:
        print("[Service QA] FAILED: 'question' key not found in JSON.")
        return None
        
    print("[Service QA] Successfully generated deep-dive question.")
    return question_text

# --------------------------------------------------------------------------------------
# --- 4. 테스트 실행 블록 ---
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== [QA Module Test Start] ===")

    # [Test Data 1] 더미 리포트 데이터
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
    
    test_snippet = "조기 전공 확정 시스템, 청년 세대의 진로 불안을 키우는 근본 원인\r\n현재 한국 대학의 조기 전공 확정 시스템은 학생들의 건전한 진로 탐색을 방해하고, 장기적인 진로 불안을 심화시키는 구조적 모순을 내포하고 있습니다. 전공이 곧 개인의 사회적 지위와 미래를 상징하는 강력한 표식이 되면서, 학생들은 초기 선택의 실패가 곧 인생의 실패로 이어질 것이라는 극심한 압박감 속에 놓이게 됩니다. 저는 이러한 '조기 확정' 방식이 본질적인 진로 탐색을 왜곡한다고 주장합니다.\r\n1. :돋보기: 정보 비대칭성이 낳는 '선택 후회(Post-choice Regret)'\r\n고등학교 졸업 직후 또는 대학 신입생이 불완전한 정보만으로 4년 후의 산업 동향과 자신의 적성을 정확히 예측하여 최적의 전공을 선택하는 것은 현실적으로 불가능합니다. 학생들은 주로 취업률 통계나 파편적인 경험담에 의존하며, 이러한 제한된 정보에 기반한 결정은 필연적으로 대학 재학 중 **'선택 후회'**를 유발합니다.\r\n경험적 증거: \"다시 대학에 간다면 전공을 바꾸고 싶다\"는 대규모 설문조사 결과는 현행 조기 확정 시스템의 실패를 명확하게 보여주는 지표입니다.\r\n2. :방패: 경직된 시스템이 저해하는 '자기 효능감'과 능동적 진로 인식\r\n대학의 폐쇄적인 전공 변경 및 융합 교육 환경은 학생들의 자기 효능감 발달을 저해하고 진로를 수동적으로 인식하게 만듭니다.\r\n역량의 한계 설정: 학생들은 자신이 선택한 전공을 자신의 잠재적 역량의 한계로 간주하며, 전공 외 분야 탐색이나 새로운 기술 습득의 기회를 스스로 차단하게 됩니다.\r\n미래에 대한 통제력 상실: 급변하는 노동 시장에서 능동적으로 대처하기보다는 시스템이 정해준 길에 의존하려는 경향은 미래에 대한 심각한 통제력 상실과 불안감을 유발하는 치명적인 약점으로 작용합니다.\r\n:전구: 혁신 방향: 유연하고 지속적인 진로 탐색의 장으로\r\n따라서 대학은 전공을 단순히 지식 습득의 수단이 아닌, 지속적인 자기 탐색의 장으로 인식하도록 시스템을 혁신해야 합니다.\r\n무전공 입학 및 전공 자유 이수제: 학생들이 2~3학년에 이르러 최종 전공을 확정하도록 하는 **'전공 선택 유연화 방안'**을 적극적으로 도입해야 합니다.\r\n의무적 진로 지도: 학부 전반에 걸친 광범위한 진로 지도를 의무화하여, 학생들이 충분한 정보를 바탕으로 주도적인 선택을 할 수 있도록 지원해야 합니다.\r\n이러한 근본적인 시스템의 변화만이 전공 선택이 청년들의 진로 불안을 가중시키는 굴레에서 벗어나도록 만들 수 있습니다"
    
    # [Test 1] 초기 질문 생성 (JSON)
    print("\n--- Test 1: Initial Questions (JSON) ---")
    initial_qs = generate_initial_questions(test_summary, [], test_snippet)
    
    if initial_qs:
        print(f"\n[Result] Type: {type(initial_qs)}")
        print(json.dumps(initial_qs, indent=2, ensure_ascii=False))
    else:
        print("\n[Result] Failed to generate initial questions.")

    # [Test Data 2] 더미 대화 기록 (심화 질문용)
    test_history = [
        {"question": "보고서에서는 '조기 전공 확정 시스템'이 진로 불안의 주요 원인이라고 전제했습니다(인용). 그러나 경제적 여건이나 부모의 기대 등 외부 요인이 진로 선택에 미치는 영향은 배제되었는데, 이런 복합적 요소를 고려하지 않은 단순화는 문제의 본질을 흐리지 않을까요?(반박)? 이에 대한 보완적 접근법은 없을까요?", "answer": "전공 조기 확정에 진로 불안에 크게 기여하고 있습니다."}
    ]

    # [Test 2] 심화 질문 생성 (Text)
    print("\n--- Test 2: Deep Dive Question (Text) ---")
    deep_dive_q = generate_deep_dive_question(test_history, test_summary)
    
    if deep_dive_q:
        print(f"\n[Result] Generated Question:\n{deep_dive_q}")
    else:
        print("\n[Result] Failed to generate deep dive question.")
        
    print("\n=== [QA Module Test End] ===")