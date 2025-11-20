import os
import json
import requests
import re
import ast
from time import sleep

# config.py에서 프롬프트 템플릿 로드 (반드시 JSON 포맷을 요구하는 최신 프롬프트여야 함)
from config import question_making_prompt, deep_dive_prompt

# --------------------------------------------------------------------------------------
# --- 1. 전역 설정 (Naver HyperCLOVA X) ---
# --------------------------------------------------------------------------------------

# 환경 변수 로드
NAVER_CLOVA_URL = os.environ.get('NAVER_CLOVA_URL2') # 예: "https://clovastudio.stream..."
NAVER_API_KEY = os.environ.get('NAVER_API_KEY')     # 예: "nv-..." (Bearer Token)

MAX_RETRIES = 3

# API 키 확인
if not (NAVER_CLOVA_URL and NAVER_API_KEY):
    print("[Service QA] WARNING: NAVER API Keys or URL not found. QA Service will fail.")
else:
    print("[Service QA] Naver HyperCLOVA X (Bearer Mode) Configured.")


# --------------------------------------------------------------------------------------
# --- 2. 헬퍼 함수 (통합 LLM 호출 - JSON 전용) ---
# --------------------------------------------------------------------------------------

def _call_llm_json(prompt_text, temperature=0.5):
    """
    Naver HyperCLOVA X API를 호출하고 결과를 JSON으로 파싱하여 반환합니다.
    
    Args:
        prompt_text (str): 사용자 입력 프롬프트
        temperature (float): 창의성 조절 (0.1 ~ 0.8). 기본값 0.5
        
    Returns:
        dict or list: 파싱된 JSON 객체 (실패 시 None)
    """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY:
        print("[Service QA] Error: Missing API configuration.")
        return None

    # [헤더 설정] Bearer Token 방식
    headers = {
        'Authorization': f'Bearer {NAVER_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json' 
    }

    # [요청 바디]
    data = {
        "messages": [
            {
                "role": "system",
                "content": "너는 논리적인 학술 멘토야. 결과는 반드시 유효한 JSON 포맷으로만 출력해. 마크다운이나 부가 설명 없이 순수 JSON 데이터만 반환해."
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": 4096, # TPM 고려하여 안전하게 설정
        "temperature": temperature,  # 함수 인자로 제어 (창의성 vs 정확성)
        "repeatPenalty": 5.0,        # 반복 방지 강화
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
            response.raise_for_status() # 4xx, 5xx 에러 시 예외 발생
            
            res_json = response.json()
            content_text = res_json.get('result', {}).get('message', {}).get('content', '')
            
            if not content_text:
                raise Exception("Empty content received from Naver API")

            # --- [JSON 파싱 로직 강화] ---
            
            # 1. Markdown 코드블록 제거 (```json ... ```)
            json_str = ""
            match = re.search(r"```json\s*([\s\S]+?)\s*```", content_text)
            if match:
                json_str = match.group(1)
            else:
                # 2. 가장 바깥쪽 괄호({}, []) 추출
                json_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content_text.strip())
                json_str = json_match.group(1) if json_match else content_text.strip()

            # 3. 파싱 시도 (3단계 방어)
            try:
                return json.loads(json_str, strict=False)
            except json.JSONDecodeError:
                pass

            try:
                return ast.literal_eval(json_str)
            except:
                pass

            try:
                # 단순 줄바꿈 문제 등 정제 후 재시도
                json_str_clean = json_str.replace('\n', '\\n').replace('\r', '')
                return json.loads(json_str_clean, strict=False)
            except:
                pass
            
            print(f"[Service QA] JSON Parsing Failed (Attempt {attempt+1}). Raw: {content_text[:100]}...")
            # 파싱 실패 시 재시도 로직으로 넘어감
            raise ValueError("JSON parsing failed")

        except Exception as e:
            print(f"[Service QA] LLM Call Error (Attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                sleep(2 ** attempt) # Exponential backoff
            else:
                return None # 모든 재시도 실패


# --------------------------------------------------------------------------------------
# --- 3. 메인 서비스 함수 ---
# --------------------------------------------------------------------------------------

def generate_initial_questions(summary_dict, high_similarity_reports_list, snippet):
    """
    초기 질문 9개 (3:3:3)를 생성합니다.
    """
    print("[Service QA] Generating 9 initial questions...")
    
    # 1. 표절 점수 정보 포맷팅
    plagiarism_info = ""
    if high_similarity_reports_list:
        plagiarism_info += f"참고: {len(high_similarity_reports_list)}개의 문서와 높은 구조적 유사성(표절 의심)이 발견되었습니다.\n"
        for i, report in enumerate(high_similarity_reports_list[:2]):
            comment = report.get('llm_comparison_report', " ")
            plagiarism_info += f" - 문서 {i+1}: {comment}\n"
    else:
        plagiarism_info = "참고: 높은 구조적 유사성을 보이는 문서는 발견되지 않았습니다."

    # 2. 요약 정보 포맷팅
    summary_text = f"""
    - 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
    - 사용된 근거(Reasoning): {summary_dict.get('Reasoning', 'N/A')}
    - 논리 흐름(Flow Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
    - 결론 방식(Conclusion Framing): {summary_dict.get('Conclusion_Framing', 'N/A')}
    """

    # 3. 프롬프트 생성 (config.py의 템플릿 사용)
    prompt = question_making_prompt.format(
        plagiarism_data=plagiarism_info,
        summary_data=summary_text,
        snippet_data=snippet
    )
    
    # 4. LLM 호출 (표준 온도 0.5)
    questions = _call_llm_json(prompt, temperature=0.5)
    
    # 5. 결과 검증
    if not questions or not isinstance(questions, list) or len(questions) != 9:
        print(f"[Service QA] FAILED: Invalid question list format. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 9 initial questions.")
    return questions


def generate_deep_dive_question(conversation_history_list, summary_dict):
    """
    심화 질문 1개를 생성합니다. (JSON으로 받아서 텍스트 추출)
    """
    print(f"[Service QA] Generating deep-dive question (History: {len(conversation_history_list)})...")

    # 1. 대화 기록 포맷팅
    history_text = ""
    for qa in conversation_history_list:
        history_text += f"Q: {qa.get('question', 'N/A')}\nA: {qa.get('answer', 'N/A')}\n"
        
    # 2. 요약 정보
    summary_text = f"핵심 주장: {summary_dict.get('Claim', 'N/A')}"

    # 3. 프롬프트 생성 (config.py의 템플릿 사용)
    prompt = deep_dive_prompt.format(
        summary_data=summary_text,
        history_data=history_text
    )
    
    # 4. LLM 호출 (창의성을 위해 temperature=0.8 적용)
    result_json = _call_llm_json(prompt, temperature=0.8)
    
    # 5. 결과 추출 (JSON -> 'question' 키값)
    if not result_json or not isinstance(result_json, dict):
        print(f"[Service QA] FAILED: Deep-dive response is not a valid dict.")
        return None
        
    question_text = result_json.get('question')
    
    if not question_text:
        print("[Service QA] FAILED: 'question' key missing in Deep-dive response.")
        return None

    print("[Service QA] Successfully generated deep-dive question.")
    return question_text


def generate_refill_questions(summary_dict, similar_reports_list, text_snippet):

    """
    리필용 질문 6개 (2:2:2)를 생성합니다.
    """
    print("[Service QA] Generating 6 refill questions...")
    
    # 1. 정보 포맷팅
    plagiarism_info = ""
    if similar_reports_list:
          plagiarism_info = f"{len(similar_reports_list)}개의 문서와 높은 유사성이 발견된 바 있습니다."

    summary_text = f"""
    - 핵심 주장(Claim): {summary_dict.get('Claim', 'N/A')}
    - 서론 방식(Problem Framing): {summary_dict.get('Problem_Framing', 'N/A')}
    - 논리 흐름(Flow Pattern): {summary_dict.get('Flow_Pattern', 'N/A')}
    """

    # 2. 프롬프트 생성 (리필용은 여기서 직접 정의 - JSON 강제)
    prompt = f"""
    학생 리포트 요약을 바탕으로 사고를 확장할 수 있는 추가 질문 6개(유형: critical, perspective, innovative 각 2개씩)를 생성하세요.
    기존 질문들과 겹치지 않게 다른 각도에서 접근해야 합니다.

    [분석 요약]
    {summary_text}
    (참고: {plagiarism_info})
    
    **[출력 포맷]**
    반드시 아래 포맷의 JSON 리스트로만 출력하십시오. (설명 금지)
    [
      {{"question": "질문 내용...", "type": "critical"}},
      {{"question": "...", "type": "critical"}},
      {{"question": "...", "type": "perspective"}},
      {{"question": "...", "type": "perspective"}},
      {{"question": "...", "type": "innovative"}},
      {{"question": "...", "type": "innovative"}}
    ]
    """
    
    # 3. LLM 호출 (약간의 변화를 위해 temperature=0.6)
    questions = _call_llm_json(prompt, temperature=0.6)
    
    # 4. 결과 검증
    if not questions or not isinstance(questions, list) or len(questions) != 6:
        print(f"[Service QA] FAILED: Did not receive 6 questions. Got: {questions}")
        return None
        
    print("[Service QA] Successfully generated 6 refill questions.")
    return questions

def _distribute_questions(questions_pool, count=3):
    """
    생성된 질문 풀(9개 등)에서 유형별(critical, perspective, innovative)로 
    하나씩 골고루 뽑아 초기 질문 세트(3개)를 구성하는 헬퍼 함수입니다.
    """
    if not questions_pool: return []
    
    # 유형별로 분류
    critical_q = [q for q in questions_pool if q.get('type') == 'critical']
    perspective_q = [q for q in questions_pool if q.get('type') == 'perspective']
    innovative_q = [q for q in questions_pool if q.get('type') == 'innovative']
    
    initial_set = []
    
    # 각 유형에서 하나씩 추출 (총 3개 목표)
    if critical_q: initial_set.append(critical_q.pop(0))
    if perspective_q: initial_set.append(perspective_q.pop(0))
    if innovative_q: initial_set.append(innovative_q.pop(0))
    
    # 원본 pool에서 추출된 질문 제거 (중복 방지)
    for q in initial_set:
        if q in questions_pool:
            questions_pool.remove(q)
            
    return initial_set