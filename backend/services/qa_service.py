import os
import json
import google.generativeai as genai
from time import sleep
import random # (Mock 데이터용 - 실제로는 LLM이 반환)

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 및 모델 로드 (Flask 앱 시작 시 1회 실행) ---
# --------------------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
# (참고: QA는 고품질 응답이 필요하므로 Pro 모델 권장)
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
# --- 2. 프롬프트 템플릿 (삭제) ---
# (프롬프트는 이제 각 함수 내에서 동적으로 생성됩니다)
# --------------------------------------------------------------------------------------

# --------------------------------------------------------------------------------------
# --- 3. 헬퍼 함수 (LLM 호출) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text):
    """LLM을 호출하고 JSON 응답을 파싱하는 내부 함수"""
    if not llm_client_pro:
        print("[Service QA] CRITICAL: LLM Client not initialized.")
        return None

    # [수정] QA 프롬프트는 JSON 응답을 요구하므로 mime_type 지정
    config = genai.GenerationConfig(response_mime_type="application/json")
    
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(
                contents=[prompt_text],
                generation_config=config
            )
            if not response.text:
                raise Exception("Empty response from LLM (QA)")
            
            # (디버깅용) Mock 데이터 반환 (실제 운영 시 이 블록 삭제)
            # if "9개의 '열린 질문'" in prompt_text:
            #     print("[Service QA] MOCK: Returning 9 initial questions.")
            #     mock_q = [{"type": "critical", "question": "Mock: 핵심 주장의 근거가 충분한가요?"}, {"type": "critical", "question": "Mock: ..."}, {"type": "critical", "question": "Mock: ..."}, {"type": "perspective", "question": "Mock: 반대 입장은?"}, {"type": "perspective", "question": "Mock: ..."}, {"type": "perspective", "question": "Mock: ..."}, {"type": "innovative", "question": "Mock: 다른 해결책은?"}, {"type": "innovative", "question": "Mock: ..."}, {"type": "innovative", "question": "Mock: ..."}]
            #     random.shuffle(mock_q)
            #     return mock_q
            # if "3개의 추가 질문" in prompt_text:
            #     print("[Service QA] MOCK: Returning 3 refill questions.")
            #     return [{"type": "critical", "question": "Mock Refill: ..."}, {"type": "perspective", "question": "Mock Refill: ..."}, {"type": "innovative", "question": "Mock Refill: ..."}]
            
            return json.loads(response.text)
        
        except Exception as e:
            print(f"[Service QA] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt) # Exponential backoff
            else:
                return None # 모든 재시도 실패

def _call_llm_text(prompt_text):
    """LLM을 호출하고 텍스트 응답을 반환하는 내부 함수 (Deep-dive용)"""
    if not llm_client_pro:
        print("[Service QA] CRITICAL: LLM Client not initialized.")
        return None
        
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(contents=[prompt_text])
            if not response.text:
                raise Exception("Empty response from LLM (QA Text)")
            return response.text.strip()
        
        except Exception as e:
            print(f"[Service QA] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt)
            else:
                return None

# --------------------------------------------------------------------------------------
# --- 4. 메인 서비스 함수 (app.py에서 호출) ---
# --------------------------------------------------------------------------------------

def generate_initial_questions(summary_dict, high_similarity_reports_list, snippet):
    """
    [수정] 초기 질문 9개 (3:3:3)를 생성합니다.
    (20점 총점제 및 새 프롬프트 로직 반영)
    """
    print("[Service QA] Generating 9 initial questions...")
    
    # 1. 표절 점수가 높은 리포트 요약 (텍스트)
    plagiarism_info = ""
    if high_similarity_reports_list:
        plagiarism_info += f"참고: {len(high_similarity_reports_list)}개의 문서와 총점 20점 이상의 높은 구조적 유사성(표절 의심)이 발견되었습니다.\n"
        for i, report in enumerate(high_similarity_reports_list[:2]): # 최대 2개만 예시
            score = report.get('plagiarism_score', 'N/A')
            plagiarism_info += f" - 후보 {i+1} (점수: {score}점): 이 문서는 특히 주장과 결론 도출 방식에서 유사성이 높았습니다.\n"
    else:
        plagiarism_info = "참고: 총점 20점 이상의 구조적 유사성을 보이는 문서는 발견되지 않았습니다."

    # 2. 제출된 리포트 요약 (텍스트)
    summary_text = f"""
    - 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
    - 사용된 근거(Reasoning): {summary_dict.get('Reasoning', 'N/A')}
    - 논리 흐름(Flow Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
    - 결론 방식(Conclusion Framing): {summary_dict.get('Conclusion_Framing', 'N/A')}
    """

    # 3. LLM 프롬프트 (동적 생성)
    prompt = f"""
    You are a 'Socratic Mentor' helping a student analyze their essay.
    학생이 제출한 리포트의 구조적 요약본과 표절 분석 결과가 아래에 제공됩니다.
    학생의 창의적 사고를 유도하고, 표절이 의심되는 경우(plagiarism_info) 이를 스스로 인지하고 수정할 수 있도록 돕는 9개의 '열린 질문'을 생성해주세요.
    
    질문은 다음 3가지 유형을 반드시 3개씩, 총 9개를 생성해야 합니다:
    1. 'critical' (주장, 근거, 논리의 타당성이나 약점을 파고드는 비판적 사고 질문)
    2. 'perspective' (주제에 대한 다른 관점, 반론, 또는 독자의 수용성을 고려하는 질문)
    3. 'innovative' (요약된 내용을 바탕으로 새로운 아이디어, 해결책, 또는 대안을 탐색하는 창의적 사고 질문)

    [표절 분석 결과]
    {plagiarism_info}

    [제출 리포트 요약]
    {summary_text}

    [제출 리포트 원본 일부]
    {snippet}

    출력은 반드시 [{"question": "질문 내용...", "type": "critical"}, ...] 형식의 JSON 리스트여야 합니다.
    """
    
    # 4. LLM 호출
    questions = _call_llm_json(prompt)
    
    if not questions or not isinstance(questions, list) or len(questions) != 9:
        print(f"[Service QA] FAILED: Did not receive 9 questions in valid JSON list. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 9 initial questions.")
    return questions


def generate_deep_dive_question(conversation_history_list, summary_dict):
    """
    [수정] 심화 질문 1개를 생성합니다. (summary_dict 입력)
    (텍스트 응답을 반환하도록 _call_llm_text 사용)
    """
    print(f"[Service QA] Generating deep-dive question (History length: {len(conversation_history_list)})...")

    # 1. 대화 기록
    history_text = ""
    for qa in conversation_history_list:
        history_text += f"Q: {qa.get('question', 'N/A')}\nA: {qa.get('answer', 'N/A')}\n"
        
    # 2. 리포트 요약 (대화의 맥락으로 사용)
    summary_text = f"이 대화는 학생의 리포트(핵심 주장: {summary_dict.get('Claim', 'N/A')})에 기반하고 있습니다."

    # 3. LLM 프롬프트
    prompt = f"""
    학생과 튜터(AI) 간의 대화 기록이 주어집니다.
    학생의 마지막 답변을 바탕으로, 학생의 생각을 더 깊게 탐색할 수 있는 한 개의 '심화 질문'을 생성해주세요.
    이 질문은 학생이 자신의 논리를 더 정교하게 만들거나 새로운 관점을 고려하도록 유도해야 합니다.
    
    [대화의 주제]
    {summary_text}

    [지금까지의 대화 기록]
    {history_text}
    
    [심화 질문] (한 문장으로 생성, 텍스트만 응답):
    """
    
    # 4. LLM 호출 (JSON이 아닌 Text 응답)
    question_text = _call_llm_text(prompt)
    
    if not question_text:
        print(f"[Service QA] FAILED: Did not receive valid text response for deep-dive.")
        return None
        
    print("[Service QA] Successfully generated deep-dive question.")
    return question_text


def generate_refill_questions(summary_dict, similar_reports_list, text_snippet):
    """
    [신규/수정] 백그라운드 리필용 질문 6개 (2:2:2)를 생성합니다.
    (기존 6개 로직 대체)
    """
    print("[Service QA] Generating 6 refill questions...")
    
    plagiarism_info = "" # 리필 시에는 표절 정보는 생략 (선택적)
    if similar_reports_list:
         plagiarism_info = f"{len(similar_reports_list)}개의 문서와 높은 유사성이 발견된 바 있습니다."

    summary_text = f"""
    - 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
    - 서론 방식(Problem Framing): {summary_dict.get('Problem_Framing', 'N/A')}
    - 논리 흐름(Flow Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
    """

    prompt = f"""
    학생이 제출한 리포트의 요약본입니다.
    학생의 사고를 확장할 수 있는 6개의 추가 질문(유형: critical, perspective, innovative 각 2개씩)을 생성해주세요.
    이미 초기 질문이 제공되었으므로, 다른 각도에서 접근하는 질문이어야 합니다.

    [분석 요약]
    {summary_text}
    (유사성 정보: {plagiarism_info})
    
    출력은 반드시 [{"question": "질문 내용...", "type": "critical"}, {"question": "...", "type": "critical"}, {"question": "...", "type": "perspective"}, {"question": "...", "type": "perspective"}, {"question": "...", "type": "innovative"}, {"question": "...", "type": "innovative"}] 형식의 JSON 리스트여야 합니다.
    """
    
    # 3. LLM 호출 (기존 헬퍼 재사용)
    questions = _call_llm_json(prompt)
    
    if not questions or not isinstance(questions, list) or len(questions) != 6:
        print(f"[Service QA] FAILED: Did not receive 6 questions in valid JSON list. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 6 refill questions.")
    return questions
