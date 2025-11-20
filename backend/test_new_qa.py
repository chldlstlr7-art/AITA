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
        "Claim": "AI의 창작물에도 저작권을 부여해야 한다.",
        "Reasoning": "AI도 인간처럼 학습 과정을 거치며, 독창적인 결과물을 만들어내기 때문에 그 노력을 인정해야 산업이 발전한다.",
        "Flow_Pattern": "주장 -> 근거 -> 반론 재반박 -> 결론",
        "Conclusion_Framing": "미래 지향적 제언"
    }
    
    test_snippet = "현재 법률은 '인간의 사상과 감정'만을 저작물로 인정하고 있다. 하지만 딥러닝 알고리즘의 복잡성은 이미 인간의 창작 프로세스와 유사한 수준에 도달했다..."
    
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
        {"question": "AI에게 저작권을 주면, 원작자(학습 데이터 제공자)의 권리는 어떻게 되나요?", "answer": "원작자에게는 별도의 로열티를 지급하는 시스템을 구축하면 해결될 문제입니다."}
    ]

    # [Test 2] 심화 질문 생성 (Text)
    print("\n--- Test 2: Deep Dive Question (Text) ---")
    deep_dive_q = generate_deep_dive_question(test_history, test_summary)
    
    if deep_dive_q:
        print(f"\n[Result] Generated Question:\n{deep_dive_q}")
    else:
        print("\n[Result] Failed to generate deep dive question.")
        
    print("\n=== [QA Module Test End] ===")