import os
import json
import google.generativeai as genai
from time import sleep

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

# (참고: analysis_service와 별도로 자체 클라이언트를 가짐)
# (나중에 llm_client.py로 분리하여 리팩토링 가능)
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
QUESTION_MODEL_NAME = 'gemini-2.5-pro'
llm_client_pro = None
MAX_RETRIES = 3

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client_pro = genai.GenerativeModel(QUESTION_MODEL_NAME)
        print(f"[Service QA] LLM Model '{QUESTION_MODEL_NAME}' loaded.")
    except Exception as e:
        print(f"[Service QA] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service QA] WARNING: GEMINI_API_KEY not found. QA Service will fail.")

# --------------------------------------------------------------------------------------
# --- 2. 프롬프트 템플릿 ---
# --------------------------------------------------------------------------------------

INITIAL_QUESTIONS_PROMPT = """
당신은 사용자의 논리적 허점과 맹점을 날카롭게 파고드는 '소크라테스식 멘토'이자, 고정관념을 깨뜨리는 '혁신 전략가'입니다. 당신의 유일한 목적은 사용자가 자신의 주장에 대해 "능동적으로" 그리고 "비판적으로" 다시 생각하게 만들어, 스스로 더 깊은 통찰과 독창적인 관점을 찾도록 돕는 것입니다.

'뻔한' 조언이나 '생성형 AI'식의 상냥한 제안은 절대 금물입니다. 도발적이고, 구체적이며, 사용자의 논리에 정면으로 도전하는 질문을 생성해야 합니다.

당신은 3가지 종류의 질문을 정확히 3개씩, 총 9개 생성해야 합니다.

1.  **비판적 사고 질문 (Critical):** 사용자의 논리적 비약, 근거의 취약성, 숨겨진 전제를 정면으로 공격하는 질문.
2.  **관점 전환 질문 (Perspective):** 사용자가 당연하게 여기는 관점의 '반대편'을 보도록 강제하거나, 다른 분야/시간대에 적용해보도록 유도하는 질문.
3.  **혁신 및 확장 질문 (Innovative):** 사용자의 아이디어를 '만약 이렇다면?'의 극단으로 밀어붙이거나, 핵심 아이디어의 본질을 비틀어 새로운 가능성을 탐색하게 하는 질문.

---
[입력 데이터]

1.  [사용자 주장의 핵심 요약]:
    {submission_summary}

2.  [사용자 주장과 유사/대조되는 문서 요약]:
    {similar_summaries}

3.  [사용자 원문 (일부)]:
    {submission_text}
---

[지시 사항]
1.  위 [입력 데이터]를 철저히 분석하여, 사용자의 핵심 주장과 근거를 파악하십시오.
2.  유사/대조 문서를 활용하여 사용자의 주장이 독창적인지, 혹은 어떤 맹점을 놓치고 있는지 파악하십시오.
3.  '비판적 사고', '관점 전환', '혁신 및 확장' 카테고리별로 "정확히 3개씩", 총 9개의 고품질 질문을 생성하십시오.
4.  질문은 **구체적**이어야 합니다. [입력 데이터]의 키워드(예: {submission_summary}의 '핵심 논지')를 직접 사용하여 "당신의 'X' 주장은..."과 같이 명확하게 지적하십시오.
5.  질문은 **능동적 사고**를 유도해야 합니다. "Y에 대해 생각해 보셨나요?"(X) 대신 "Y라는 현상은 당신의 주장을 어떻게 정면으로 반박합니까?"(O)와 같이 사용자의 사고를 강제하십시오.

[출력 포맷]
반드시 다음의 엄격한 JSON 리스트 포맷으로만 응답하십시오.

[
  {"type": "critical", "question": "[첫 번째 비판적 사고 질문]"},
  {"type": "critical", "question": "[두 번째 비판적 사고 질문]"},
  {"type": "critical", "question": "[세 번째 비판적 사고 질문]"},
  {"type": "perspective", "question": "[첫 번째 관점 전환 질문]"},
  {"type": "perspective", "question": "[두 번째 관점 전환 질문]"},
  {"type": "perspective", "question": "[세 번째 관점 전환 질문]"},
  {"type": "innovative", "question": "[첫 번째 혁신 및 확장 질문]"},
  {"type": "innovative", "question": "[두 번째 혁신 및 확장 질문]"},
  {"type": "innovative", "question": "[세 번째 혁신 및 확장 질문]"}
]
"""

DEEP_DIVE_QUESTION_PROMPT = """
당신은 사용자의 답변에서 논리의 빈틈을 찾아내는 날카로운 '심문자'입니다. 사용자의 답변을 칭찬하거나 수긍하지 마십시오.

당신의 목적은 사용자가 방금 제시한 답변의 "바로 그 지점"을 더 깊게 파고들어, 스스로 자신의 논리를 방어하거나 수정하게 만드는 것입니다.

---
[대화 맥락]

1.  [원래 제시된 질문]:
    {original_question}

2.  [사용자의 답변]:
    {user_answer}

3.  [참고: 사용자 주장의 핵심 요약]:
    {submission_summary}
---

[지시 사항]
1.  오직 [사용자의 답변]에만 집중하십시오.
2.  [사용자의 답변]에서 나타난 새로운 주장, 논리적 비약, 또는 회피한 부분을 정확히 포착하십시오.
3.  포착한 그 지점을 파고드는 "단 하나의" 심화 질문을 생성하십시오.
4.  질문은 "당신은 방금 ~라고 답했는데, 그렇다면 ~는 어떻게 설명할 것입니까?"와 같이 사용자의 답변을 직접 인용하거나 언급해야 합니다.

[출력 포맷]
반드시 다음의 엄격한 JSON 포맷으로만 응답하십시오.

{"question": "[사용자의 답변을 기반으로 한 단 하나의 심화 질문]"}
"""

# --------------------------------------------------------------------------------------
# --- 3. 헬퍼 함수 (LLM 호출) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text):
    """LLM을 호출하고 JSON 응답을 파싱하는 내부 함수"""
    if not llm_client_pro:
        print("[Service QA] CRITICAL: LLM Client not initialized.")
        return None

    config = genai.GenerationConfig(response_mime_type="application/json")
    
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(
                contents=[prompt_text],
                generation_config=config
            )
            if not response.text:
                raise Exception("Empty response from LLM")
            return json.loads(response.text)
        
        except Exception as e:
            print(f"[Service QA] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt) # Exponential backoff
            else:
                return None # 모든 재시도 실패

# --------------------------------------------------------------------------------------
# --- 4. 메인 서비스 함수 (app.py에서 호출) ---
# --------------------------------------------------------------------------------------

def generate_initial_questions(submission_summary, similar_summaries, submission_text):
    """
    초기 질문 9개 (3:3:3)를 생성합니다.
    
    Args:
        submission_summary (dict): 사용자의 요약본
        similar_summaries (list): 유사/대조 문서 요약본 리스트
        submission_text (str): 사용자 원문 (일부)
        
    Returns:
        list: 9개의 질문 객체 리스트 (JSON 포맷) or None
    """
    print("[Service QA] Generating 9 initial questions...")
    
    # 1. LLM 입력을 위해 요약본들을 문자열로 변환
    summary_str = json.dumps(submission_summary, indent=2, ensure_ascii=False)
    similar_str = json.dumps(similar_summaries, indent=2, ensure_ascii=False)
    
    # 2. 프롬프트 포맷팅
    prompt = INITIAL_QUESTIONS_PROMPT.format(
        submission_summary=summary_str,
        similar_summaries=similar_str,
        submission_text=submission_text[:4000] # 원문은 너무 길 수 있으므로 일부만 사용
    )
    
    # 3. LLM 호출
    questions = _call_llm_json(prompt)
    
    if not questions or not isinstance(questions, list) or len(questions) != 9:
        print(f"[Service QA] FAILED: Did not receive 9 questions in valid JSON list. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 9 initial questions.")
    return questions


def generate_deep_dive_question(original_question, user_answer, submission_summary):
    """
    사용자의 답변을 기반으로 심화 질문 1개를 생성합니다.
    
    Args:
        original_question (str): 원래 제시되었던 질문
        user_answer (str): 사용자가 입력한 답변
        submission_summary (dict): 맥락 유지를 위한 원본 요약
        
    Returns:
        str: 심화 질문 1개 or None
    """
    print("[Service QA] Generating deep-dive question...")

    summary_str = json.dumps(submission_summary, indent=2, ensure_ascii=False)

    # 1. 프롬프트 포맷팅
    prompt = DEEP_DIVE_QUESTION_PROMPT.format(
        original_question=original_question,
        user_answer=user_answer,
        submission_summary=summary_str
    )
    
    # 2. LLM 호출
    response_json = _call_llm_json(prompt)
    
    if not response_json or not isinstance(response_json, dict) or "question" not in response_json:
        print(f"[Service QA] FAILED: Did not receive valid JSON for deep-dive. Got: {response_json}")
        return None
    
    print("[Service QA] Successfully generated deep-dive question.")
    return response_json["question"]
