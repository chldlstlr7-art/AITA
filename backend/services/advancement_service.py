import os
import json
import requests
import re
import ast
from time import sleep
from config import IDEA_GENERATION_PROMPT

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 (Naver HyperCLOVA X) ---
# --------------------------------------------------------------------------------------

NAVER_CLOVA_URL = os.environ.get('NAVER_CLOVA_URL2') # 예: https://clovastudio.stream...
NAVER_API_KEY = os.environ.get('NAVER_API_KEY')     # 예: nv-... (Bearer Token)

MAX_RETRIES = 3

if NAVER_CLOVA_URL and NAVER_API_KEY:
    print("[Service ADV] Naver HyperCLOVA X (Bearer) Configured.")
else:
    print("[Service ADV] WARNING: NAVER API Keys not found. Advancement Service will fail.")


# --------------------------------------------------------------------------------------
# --- 2. 헬퍼 함수 (네이버 API 호출 및 JSON 파싱) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text):
    """
    [수정] Naver API를 호출하고 JSON 응답을 파싱하는 내부 함수
    """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY:
        print("[Service ADV] CRITICAL: API Keys missing.")
        return None

    headers = {
        'Authorization': f'Bearer {NAVER_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json'
    }

    # 발전 아이디어 생성은 창의성이 필요하므로 temperature를 약간 높게(0.5~0.6) 설정
    data = {
        "messages": [
            {
                "role": "system",
                "content": "너는 창의적인 사고 촉진자야. 결과는 반드시 유효한 JSON 리스트 포맷으로만 출력해. 마크다운이나 부가 설명 없이 순수 JSON 데이터만 반환해."
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": 4096,
        "temperature": 0.6, 
        "repeatPenalty": 5.0,
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
            response.raise_for_status()
            
            res_json = response.json()
            content_text = res_json.get('result', {}).get('message', {}).get('content', '')
            
            if not content_text:
                raise Exception("Empty response from Naver API")

            # --- [JSON 파싱 로직 (3단계 방어)] ---
            
            # 1. Markdown 코드블록 제거
            json_str = ""
            match = re.search(r"```json\s*([\s\S]+?)\s*```", content_text)
            if match:
                json_str = match.group(1)
            else:
                # 2. 가장 바깥쪽 대괄호([]) 추출 (리스트 형태가 예상되므로)
                json_match = re.search(r"(\[[\s\S]*\])", content_text.strip())
                json_str = json_match.group(1) if json_match else content_text.strip()

            # 3. 파싱 시도
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
            
            print(f"[Service ADV] JSON Parsing Failed (Attempt {attempt+1}). Raw: {content_text[:100]}...")
            raise ValueError("JSON parsing failed")

        except Exception as e:
            print(f"[Service ADV] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt)
            else:
                return None # 모든 재시도 실패


def _format_conversation_history(qa_history_list):
    """
    qa_history(JSON list)를 LLM이 읽기 쉬운 '대화 흐름' 텍스트로 변환합니다.
    (기존 로직 유지)
    """
    if not qa_history_list:
        return "[대화 기록 없음]"

    main_qas = []
    deep_dive_qas = {} 

    for item in qa_history_list:
        # 답변이 없는 항목 건너뛰기
        if item.get('answer') is None or not str(item.get('answer')).strip():
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
        main_qa_id = main_qa.get('question_id')
        
        formatted_text_parts.append(f"--- 대화 흐름 {flow_counter} ---")
        formatted_text_parts.append(f"Q: {main_qa.get('question', '')}")
        formatted_text_parts.append(f"A: {main_qa.get('answer', '')}")
        
        if main_qa_id in deep_dive_qas:
            for child_qa in deep_dive_qas[main_qa_id]:
                formatted_text_parts.append("") 
                formatted_text_parts.append(f"  └─ (심화 질문) Q: {child_qa.get('question', '')}")
                formatted_text_parts.append(f"  └─ (심화 답변) A: {child_qa.get('answer', '')}")
        
        formatted_text_parts.append("\n") 
        flow_counter += 1

    return "\n".join(formatted_text_parts)


# --------------------------------------------------------------------------------------
# --- 3. 메인 서비스 함수 (JSON 반환) ---
# --------------------------------------------------------------------------------------

def generate_advancement_ideas(summary_dict, snippet, qa_history_list):
    """
    [수정] 전체 대화 기록과 요약을 바탕으로 3가지 발전 아이디어를 생성합니다.
    (Python List/Dict 객체를 반환)
    """
    print("[Service ADV] Generating advancement ideas (JSON)...")

    # 1. 입력 데이터 포맷팅
    try:
        formatted_history = _format_conversation_history(qa_history_list)
        summary_text = f"""
- 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
- 사용된 근거(Reasoning_Logic): {summary_dict.get('Reasoning_Logic', 'N/A')}
- 논리 흐름(Flow_Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
"""
    except Exception as e:
        print(f"[Service ADV] FAILED: Error formatting input data: {e}")
        return None

    # 2. LLM 프롬프트 구성
    # IDEA_GENERATION_PROMPT는 config.py에 정의되어 있으며 JSON 포맷을 요구함
    final_prompt = f"""
{IDEA_GENERATION_PROMPT}

[제출 리포트 요약]
{summary_text}

[제출 리포트 원본 일부]
{snippet}

[정리된 대화 흐름]
{formatted_history}
"""
    
    # 3. LLM 호출 (네이버 API + JSON 파싱)
    ideas_json = _call_llm_json(final_prompt)
    
    if not ideas_json:
        print(f"[Service ADV] FAILED: Did not receive valid JSON response from LLM.")
        return None
        
    print("[Service ADV] Successfully generated advancement ideas (JSON).")
    return ideas_json