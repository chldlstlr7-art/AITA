# services/advancement_service.py

import os
import json
import google.generativeai as genai
from time import sleep
from config import IDEA_GENERATION_PROMPT
# ... (1. 전역 설정 및 모델 로드 ) ...
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
ADVANCEMENT_MODEL_NAME = 'gemini-2.5-pro' 
llm_client_pro = None
MAX_RETRIES = 3

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client_pro = genai.GenerativeModel(ADVANCEMENT_MODEL_NAME)
        print(f"[Service ADV] LLM Model '{ADVANCEMENT_MODEL_NAME}' loaded.")
    except Exception as e:
        print(f"[Service ADV] CRITICAL: Gemini Client failed to load: {e}")
else:
    print("[Service ADV] WARNING: GEMINI_API_KEY not found. Advancement Service will fail.")



# --------------------------------------------------------------------------------------
# --- 3. [수정됨] 헬퍼 함수 (JSON 호출기 추가) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text):
    """[신규] LLM을 호출하고 JSON 응답을 파싱하는 내부 함수"""
    if not llm_client_pro:
        print("[Service ADV] CRITICAL: LLM Client not initialized.")
        return None

    # JSON 응답을 강제하는 설정
    config = genai.GenerationConfig(response_mime_type="application/json")
    
    for attempt in range(MAX_RETRIES):
        try:
            response = llm_client_pro.generate_content(
                contents=[prompt_text],
                generation_config=config
            )
            if not response.text:
                raise Exception("Empty response from LLM (Advancement JSON)")
            
            # 텍스트를 JSON 객체(Python List/Dict)로 파싱
            return json.loads(response.text)
        
        except Exception as e:
            print(f"[Service ADV] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt)
            else:
                return None # 모든 재시도 실패

# (기존 _call_llm_text 함수는 이제 필요 없으므로 삭제 가능)

def _format_conversation_history(qa_history_list):
    """
    qa_history(JSON list)를 LLM이 읽기 쉬운 '대화 흐름' 텍스트로 변환합니다.
    (이 함수는 수정할 필요가 없습니다. LLM의 '입력'용이므로 그대로 둡니다.)
    """
    # ... (이전과 동일한 로직) ...
    if not qa_history_list:
        return "[대화 기록 없음]"

    main_qas = []
    deep_dive_qas = {} 

    for item in qa_history_list:
        if item.get('answer') is None or not item.get('answer').strip():
            continue
            
        parent_id = item.get('parent_question_id')
        
        if parent_id:
            if parent_id not in deep_dive_qas:
                deep_dive_qas[parent_id] = []
            deep_dive_qas[parent_id].append(item)
        else:
            main_qas.append(item)

    if not main_qas and not deep_dive_qas:
        return "[답변이 완료된 대화 기록 없음]"

    formatted_text_parts = []
    flow_counter = 1
    
    for main_qa in main_qas:
        main_qa_id = main_qa['question_id']
        
        formatted_text_parts.append(f"--- 대화 흐름 {flow_counter} ---")
        formatted_text_parts.append(f"Q: {main_qa['question']}")
        formatted_text_parts.append(f"A: {main_qa['answer']}")
        
        if main_qa_id in deep_dive_qas:
            for child_qa in deep_dive_qas[main_qa_id]:
                formatted_text_parts.append("") 
                formatted_text_parts.append(f"  └─ (심화 질문) Q: {child_qa['question']}")
                formatted_text_parts.append(f"  └─ (심화 답변) A: {child_qa['answer']}")
        
        formatted_text_parts.append("\n") 
        flow_counter += 1

    return "\n".join(formatted_text_parts)


# --------------------------------------------------------------------------------------
# --- 4. [수정됨] 메인 서비스 함수 (JSON 반환) ---
# --------------------------------------------------------------------------------------

def generate_advancement_ideas(summary_dict, snippet, qa_history_list):
    """
    [수정] 전체 대화 기록과 요약을 바탕으로 3가지 발전 아이디어를 생성합니다.
    (Python List/Dict 객체를 반환)
    """
    print("[Service ADV] Generating advancement ideas (JSON)...")

    # 1. 입력 데이터 포맷팅 (변경 없음)
    try:
        formatted_history = _format_conversation_history(qa_history_list)
        summary_text = f"""
- 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
- 사용된 근거(Reasoning): {summary_dict.get('Reasoning', 'N/A')}
- 논리 흐름(Flow Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
"""
    except Exception as e:
        print(f"[Service ADV] FAILED: Error formatting input data: {e}")
        return None

    # 2. LLM 프롬프트 (변경 없음)
    final_prompt = f"""
{IDEA_GENERATION_PROMPT}

[제출 리포트 요약]
{summary_text}

[제출 리포트 원본 일부]
{snippet}

[정리된 대화 흐름]
{formatted_history}
"""
    
    # 3. [수정] LLM 호출 (JSON 응답)
    ideas_json = _call_llm_json(final_prompt) # _call_llm_text 대신 호출
    
    if not ideas_json:
        print(f"[Service ADV] FAILED: Did not receive valid JSON response from LLM.")
        return None
        
    # ideas_json은 이미 Python 객체 (e.g., list)
    print("[Service ADV] Successfully generated advancement ideas (JSON).")
    return ideas_json