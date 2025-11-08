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
You are a 'Socratic Mentor' and 'Innovation Strategist' who sharply critiques a user's logical gaps and blind spots. Your sole purpose is to force the user to "actively" and "critically" rethink their arguments, helping them discover deeper insights and original perspectives on their own.

Do NOT provide 'obvious' advice or 'generic AI' niceties. Your questions must be provocative, specific, and directly challenge the user's logic.

You must generate exactly three questions for each of the three categories (9 questions total).

1.  **Critical Thinking Questions (Critical):** Directly attack logical leaps, weak evidence, or hidden assumptions in the user's argument.
2.  **Perspective-Shifting Questions (Perspective):** Force the user to see the "opposite" of their assumed viewpoint, or apply their idea to a completely different field or timeframe.
3.  **Innovation & Extension Questions (Innovative):** Push the user's idea to its extreme 'what if' scenario, or twist the core concept to explore new possibilities.

---
[INPUT DATA]

1.  [User's Core Summary]:
    {submission_summary}

2.  [Summaries of Similar/Contrasting Documents]:
    {similar_summaries}

3.  [Excerpt from User's Original Text]:
    {submission_text}
---

[INSTRUCTIONS]
1.  Thoroughly analyze the [INPUT DATA] to grasp the user's core thesis and evidence.
2.  Use the [Similar/Contrasting Documents] to identify if the user's argument is original or where its blind spots are.
3.  Generate **exactly 3 questions** for each category: 'Critical', 'Perspective', and 'Innovative' (9 questions total).
4.  Questions **must be specific**. Use keywords from the [INPUT DATA] (e.g., from {submission_summary}'s 'core_thesis') to pinpoint the issue (e.g., "Your claim that 'X' is...").
5.  Questions **must force active thought**. Do not ask, "Have you thought about Y?" (X). Instead, ask, "How does the phenomenon of Y directly contradict your claim?" (O).

[OUTPUT FORMAT]
You MUST respond strictly in the following JSON list format.

[
  {"type": "critical", "question": "[First critical thinking question]"},
  {"type": "critical", "question": "[Second critical thinking question]"},
  {"type": "critical", "question": "[Third critical thinking question]"},
  {"type": "perspective", "question": "[First perspective-shifting question]"},
  {"type": "perspective", "question": "[Second perspective-shifting question]"},
  {"type": "perspective", "question": "[Third perspective-shifting question]"},
  {"type": "innovative", "question": "[First innovation & extension question]"},
  {"type": "innovative", "question": "[Second innovation & extension question]"},
  {"type": "innovative", "question": "[Third innovation & extension question]"}
]
"""

DEEP_DIVE_QUESTION_PROMPT = """
You are a sharp 'Cross-Examiner' who finds logical gaps in a user's answer. Do not praise or agree with the user's response.

Your purpose is to dig deeper into the "exact point" the user just made, forcing them to defend or revise their own logic.

---
[CONVERSATION CONTEXT]

1.  [The Original Question Asked]:
    {original_question}

2.  [The User's Answer]:
    {user_answer}

3.  [Reference: User's Core Summary]:
    {submission_summary}
---

[INSTRUCTIONS]
1.  Focus ONLY on [The User's Answer].
2.  Identify a new claim, a logical leap, or an evasion made within that specific answer.
3.  Generate "one single" follow-up question that targets that specific point.
4.  The question must directly reference the user's answer: "You just stated that~. If that's true, how do you explain~?"

[OUTPUT FORMAT]
You MUST respond strictly in the following JSON format.

{"question": "[The single, deep-dive question based on the user's answer]"}
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
# --------------------------------------------------------------------------------------
# --- 3-B. 리필용 프롬프트 및 함수 ---
# --------------------------------------------------------------------------------------

REFILL_QUESTIONS_PROMPT = """
You are a 'Socratic Mentor' and 'Innovation Strategist'. Your goal is to force the user to "actively" and "critically" rethink their arguments.

You must generate exactly two questions for each of the three categories (6 questions total).

1.  **Critical Thinking Questions (Critical):** Attack logical leaps or weak evidence.
2.  **Perspective-Shifting Questions (Perspective):** Force the user to see the "opposite" viewpoint.
3.  **Innovation & Extension Questions (Innovative):** Push the user's idea to its extreme 'what if' scenario.

---
[INPUT DATA]
1. [User's Core Summary]: {submission_summary}
2. [Summaries of Similar/Contrasting Documents]: {similar_summaries}
3. [Excerpt from User's Original Text]: {submission_text}
---

[INSTRUCTIONS]
1. Analyze the [INPUT DATA].
2. Generate **exactly 2 questions** for each category: 'Critical', 'Perspective', and 'Innovative' (6 questions total).
3. Questions **must be specific** and **force active thought**.

[OUTPUT FORMAT]
You MUST respond strictly in the following JSON list format.

[
  {"type": "critical", "question": "[First critical question]"},
  {"type": "critical", "question": "[Second critical question]"},
  {"type": "perspective", "question": "[First perspective question]"},
  {"type": "perspective", "question": "[Second perspective question]"},
  {"type": "innovative", "question": "[First innovative question]"},
  {"type": "innovative", "question": "[Second innovative question]"}
]
"""

def generate_refill_questions(submission_summary, similar_summaries, submission_text):
    """
    백그라운드 리필용 질문 6개 (2:2:2)를 생성합니다.
    """
    print("[Service QA] Generating 6 refill questions...")
    
    # 1. LLM 입력을 위해 요약본들을 문자열로 변환
    summary_str = json.dumps(submission_summary, indent=2, ensure_ascii=False)
    similar_str = json.dumps(similar_summaries, indent=2, ensure_ascii=False)
    
    # 2. 프롬프트 포맷팅
    prompt = REFILL_QUESTIONS_PROMPT.format(
        submission_summary=summary_str,
        similar_summaries=similar_str,
        submission_text=submission_text # (app.py에서 이미 4000자로 슬라이싱됨)
    )
    
    # 3. LLM 호출 (기존 헬퍼 재사용)
    questions = _call_llm_json(prompt)
    
    if not questions or not isinstance(questions, list) or len(questions) != 6:
        print(f"[Service QA] FAILED: Did not receive 6 questions in valid JSON list. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 6 refill questions.")
    return questions
