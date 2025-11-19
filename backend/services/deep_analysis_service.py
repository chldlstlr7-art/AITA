import os
import json
import re
import numpy as np
import google.generativeai as genai
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import sleep
from tenacity import retry, stop_after_attempt, wait_exponential

# 프롬프트 설정 로드
from config import INTEGRITY_SCANNER_PROMPT, BRIDGE_CONCEPT_PROMPT, LOGIC_FLOW_CHECK_PROMPT

# --------------------------------------------------------------------------------------
# --- 1. 설정 및 모델 로드 ---
# --------------------------------------------------------------------------------------

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
DEEP_ANALYSIS_MODEL = 'gemini-2.5-flash' # 빠르고 효율적인 모델 사용

llm_client = None
embedding_model = None

if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        llm_client = genai.GenerativeModel(DEEP_ANALYSIS_MODEL)
        print(f"[Service Deep Analysis] LLM '{DEEP_ANALYSIS_MODEL}' loaded.")
    except Exception as e:
        print(f"[Service Deep Analysis] CRITICAL: LLM Load Failed: {e}")

try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service Deep Analysis] Embedding Model loaded.")
except Exception as e:
    print(f"[Service Deep Analysis] CRITICAL: Embedding Model Failed: {e}")

# --------------------------------------------------------------------------------------
# --- 2. 헬퍼 함수 (LLM & Vector) ---
# --------------------------------------------------------------------------------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def _call_llm_json(prompt_text):
    """LLM 호출 후 JSON 파싱"""
    if not llm_client: return None
    try:
        config = genai.GenerationConfig(response_mime_type="application/json")
        response = llm_client.generate_content(contents=[prompt_text], generation_config=config)
        return json.loads(response.text)
    except Exception as e:
        print(f"[Deep Analysis] LLM Error: {e}")
        return None

def _get_embedding(text):
    if not embedding_model: return None
    return embedding_model.encode(text)

def _calculate_similarity(text_a, text_b):
    """두 텍스트 간의 코사인 유사도 계산"""
    vec_a = _get_embedding(text_a)
    vec_b = _get_embedding(text_b)
    if vec_a is None or vec_b is None: return 0.0
    return float(cosine_similarity([vec_a], [vec_b])[0][0])

# --------------------------------------------------------------------------------------
# --- 3. 핵심 기능 구현 ---
# --------------------------------------------------------------------------------------

from concurrent.futures import ThreadPoolExecutor, as_completed

def analyze_logic_neuron_map(text, key_concepts_str, core_thesis):
    """
    [최적화됨] 논리 뉴런 맵 생성
    - 최적화 1: S-BERT Batch Encoding (반복 인코딩 제거)
    - 최적화 2: LLM 호출 병렬 처리 (순차 대기 제거)
    """
    print("[Deep Analysis] Generating Logic Neuron Map (Optimized)...")
    
    if not key_concepts_str: return {"nodes": [], "edges": [], "suggestions": []}
    
    # 1. 키워드 전처리
    concepts = [c.strip() for c in key_concepts_str.split(',') if c.strip()]
    if not concepts: return {"nodes": [], "edges": [], "suggestions": []}

    nodes = [{"id": c, "label": c} for c in concepts]
    edges = []
    isolated_candidates = set(concepts)
    
    # 2. 텍스트 문단 분리 (한 번만 수행)
    paragraphs = [p for p in text.split('\n') if len(p) > 20]

    # --- [최적화 1] Batch Encoding ---
    # 루프 안에서 encode 하지 않고, 한 번에 모든 키워드 벡터를 생성
    if embedding_model:
        # concepts 리스트 전체를 한 번에 인코딩 (속도 매우 빠름)
        concept_vectors = embedding_model.encode(concepts) 
    else:
        concept_vectors = [None] * len(concepts) # 모델 없으면 예외 처리

    # 3. N x N 유사도 계산 (행렬 연산)
    for i in range(len(concepts)):
        for j in range(i + 1, len(concepts)):
            c1 = concepts[i]
            c2 = concepts[j]
            
            # (A) 물리적 거리 (Co-occurrence)
            physical_score = 0.0
            for p in paragraphs:
                if c1 in p and c2 in p:
                    physical_score += 1.0
            physical_score = min(physical_score / 3.0, 1.0)

            # (B) 의미적 거리 (Pre-calculated Vectors 사용)
            if concept_vectors[i] is not None:
                # 코사인 유사도 계산 (벡터 연산)
                semantic_score = float(cosine_similarity([concept_vectors[i]], [concept_vectors[j]])[0][0])
            else:
                semantic_score = 0.0
            
            # (C) 가중치 합산
            total_weight = (physical_score * 0.4) + (semantic_score * 0.6)
            
            if total_weight > 0.35:
                edges.append({
                    "source": c1,
                    "target": c2,
                    "weight": round(total_weight, 2)
                })
                if c1 in isolated_candidates: isolated_candidates.remove(c1)
                if c2 in isolated_candidates: isolated_candidates.remove(c2)

    # 4. 고립된 노드에 대한 Bridge 추천 (병렬 처리 준비)
    suggestions = []
    bridge_tasks = []

    # 4-1. Task 수집
    for iso_node in isolated_candidates:
        # 해당 노드의 인덱스 찾기
        try:
            iso_idx = concepts.index(iso_node)
        except ValueError: continue

        best_partner = None
        best_sim = -1.0
        
        # 가장 의미적으로 가까운 파트너 찾기 (벡터 활용)
        for k, other in enumerate(concepts):
            if iso_node == other: continue
            
            # 미리 계산된 벡터 사용
            sim = float(cosine_similarity([concept_vectors[iso_idx]], [concept_vectors[k]])[0][0])
            
            if sim > best_sim:
                best_sim = sim
                best_partner = other
        
        if best_partner:
            # LLM 호출을 바로 하지 않고 Task 리스트에 저장
            prompt = BRIDGE_CONCEPT_PROMPT.format(
                concept_a=iso_node, 
                concept_b=best_partner, 
                core_thesis=core_thesis
            )
            bridge_tasks.append({
                "iso_node": iso_node,
                "partner": best_partner,
                "prompt": prompt
            })

    # --- [최적화 2] LLM 병렬 호출 ---
    # ThreadPool을 사용하여 여러 Bridge 제안을 동시에 요청
    if bridge_tasks:
        with ThreadPoolExecutor(max_workers=3) as executor:
            # {Future객체: Task정보} 딕셔너리 생성
            future_to_task = {
                executor.submit(_call_llm_json, task['prompt']): task 
                for task in bridge_tasks
            }
            
            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    result = future.result()
                    if result:
                        suggestions.append({
                            "target_node": task['iso_node'],
                            "partner_node": task['partner'],
                            "suggestion": result
                        })
                except Exception as e:
                    print(f"[Deep Analysis] Bridge LLM Failed for {task['iso_node']}: {e}")

    return {
        "nodes": nodes,
        "edges": edges,
        "suggestions": suggestions
    }

def scan_logical_integrity(text):
    """
    [기능 3] 논리 정합성 스캐너
    - LLM을 사용하여 모호함, 모순, 검증 불가 주장 탐지
    """
    print("[Deep Analysis] Scanning Logical Integrity...")
    
    prompt = INTEGRITY_SCANNER_PROMPT.format(text=text[:5000]) # 텍스트 길이 제한
    issues = _call_llm_json(prompt)
    
    if not issues:
        return []
        
    return issues

def extract_representative_sentences(text_sentences, query_summary, top_k=3):
    """
    [내부 함수] 요약문(Query)과 가장 유사한 본문 문장 Top-K 추출
    """
    if not text_sentences: return []
    
    # 본문 전체 문장 임베딩 (캐싱하여 성능 최적화 가능)
    # 여기서는 로직 설명을 위해 매번 수행하는 형태로 작성
    sentence_embeddings = embedding_model.encode(text_sentences)
    query_embedding = embedding_model.encode(query_summary)
    
    # 코사인 유사도 계산
    similarities = cosine_similarity([query_embedding], sentence_embeddings)[0]
    
    # 상위 K개 인덱스 추출
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    
    return [text_sentences[i] for i in top_indices]

def check_flow_disconnects_with_llm(flow_pattern_json, raw_text):
    """
    [기능 3 - 수정됨] LLM Judge를 이용한 논리 흐름 단절 감지
    S-BERT 대신 LLM이 직접 논리적 타당성을 평가함.
    """
    print("[Deep Analysis] Checking Flow Disconnects (LLM Judge)...")
    
    if not flow_pattern_json or 'nodes' not in flow_pattern_json or 'edges' not in flow_pattern_json:
        return []

    nodes = flow_pattern_json['nodes']
    edges = flow_pattern_json['edges']
    
    # 본문 문장 분리
    raw_sentences = [s.strip() for s in re.split(r'[.?!]\s+', raw_text) if len(s.strip()) > 10]
    
    # LLM에게 보낼 컨텍스트 구성
    edges_context = []
    snippets_context = {}
    
    # 모든 엣지와 관련 문장을 수집
    for idx, edge in enumerate(edges):
        parent_id, child_id = edge
        parent_summary = nodes.get(parent_id, "").split('\n')[-1].strip()
        child_summary = nodes.get(child_id, "").split('\n')[-1].strip()
        
        if not parent_summary or not child_summary: continue

        # 본문 매칭 (S-BERT 활용해 가장 유사한 문장 1개씩만 추출)
        p_rep = extract_representative_sentences(raw_sentences, parent_summary)
        c_rep = extract_representative_sentences(raw_sentences, child_summary)
        
        edge_key = f"{parent_id}->{child_id}"
        edges_context.append(edge_key)
        
        snippets_context[edge_key] = {
            "parent_summary": parent_summary,
            "child_summary": child_summary,
            "parent_snippet": p_rep,
            "child_snippet": c_rep
        }

    if not edges_context:
        return []

    # LLM 프롬프트 구성
    prompt_content = f"""
    {LOGIC_FLOW_CHECK_PROMPT}

    [Structure Edges to Review]
    {json.dumps(edges_context, ensure_ascii=False)}

    [Text Snippets Context]
    {json.dumps(snippets_context, ensure_ascii=False)}
    """

    # LLM 호출 (한 번에 모든 엣지 검사)
    weak_links_result = _call_llm_json(prompt_content)
    
    if not weak_links_result:
        return []
        
    return weak_links_result
# --------------------------------------------------------------------------------------
# --- 4. 메인 진입 함수 ---
# --------------------------------------------------------------------------------------

def perform_deep_analysis(summary_json, raw_text):
    """
    Analysis Service의 결과를 바탕으로 심층 분석 수행
    """
    results = {}
    
    # 1. 데이터 추출
    key_concepts = summary_json.get('key_concepts', '')
    core_thesis = summary_json.get('Core_Thesis', '')
    flow_pattern = summary_json.get('Flow_Pattern', {})

    # 2. 병렬 처리 대신 순차 처리 (각 단계가 가벼우므로 안정성 우선)
    # [A] 논리 뉴런 맵
    results['neuron_map'] = analyze_logic_neuron_map(raw_text, key_concepts, core_thesis)
    
    # [B] 논리 정합성 스캐너 (팩트/모호성)
    results['integrity_issues'] = scan_logical_integrity(raw_text)
    
    # [C] 흐름 단절 확인
    results['flow_disconnects'] = check_flow_disconnects_with_llm(flow_pattern,raw_text)
    
    print("[Deep Analysis] Completed.")
    return results