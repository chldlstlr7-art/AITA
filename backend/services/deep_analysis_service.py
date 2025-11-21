import os
import json
import re
import requests # 📦 네이버 API 호출을 위해 추가
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from time import time, sleep
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
# 프롬프트 설정 로드
from config import INTEGRITY_SCANNER_PROMPT, BRIDGE_CONCEPT_BATCH_PROMPT, LOGIC_FLOW_CHECK_PROMPT, CREATIVE_CONNECTION_BATCH_PROMPT

# --------------------------------------------------------------------------------------
# --- 1. 설정 및 모델 로드 ---
# --------------------------------------------------------------------------------------

# [네이버 API 설정]
# [설정 변경]
# NAVER_GATEWAY_KEY는 이제 삭제하셔도 됩니다.
NAVER_CLOVA_URL = os.environ.get('NAVER_CLOVA_URL2') # "https://clovastudio.stream..."
NAVER_API_KEY = os.environ.get('NAVER_API_KEY')     # "nv-...." (새로 발급받은 키)

# S-BERT 설정 (유지)
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
embedding_model = None

try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    print(f"[Service Deep Analysis] Embedding Model loaded.")
except Exception as e:
    print(f"[Service Deep Analysis] CRITICAL: Embedding Model Failed: {e}")

# --------------------------------------------------------------------------------------
# --- 2. 헬퍼 함수 (Naver HyperCLOVA X 호출) ---
# --------------------------------------------------------------------------------------
def _call_llm_json(prompt_text):
    """
    [최신] Naver HyperCLOVA X API 호출 (Bearer Token 방식)
    """
    if not NAVER_CLOVA_URL or not NAVER_API_KEY:
        print("⚠️ Naver API 설정을 확인하세요.")
        return None

    # [핵심 변경] 헤더가 아주 심플해졌습니다.
    headers = {
    'Authorization': f'Bearer {NAVER_API_KEY}',
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json'   # <--- 수정! (완성된 JSON으로 달라는 뜻)
    }

    # HyperCLOVA X 요청 파라미터 (메시지 구조는 동일)
    data = {
        "messages": [
            {
                "role": "system",
                "content": "너는 논리적인 학술 멘토야. 결과는 반드시 유효한 JSON 포맷으로만 출력해. 마크다운 없이 순수 JSON만 줘."
            },
            {
                "role": "user",
                "content": prompt_text
            }
        ],
        "topP": 0.8,
        "topK": 0,
        "maxCompletionTokens": 2048,
        "temperature": 0.2,
        "repeatPenalty": 1.5,
        "stopBefore": [],
        "includeAiFilters": True,
        "seed": 0
    }

    
    try:
        response = requests.post(NAVER_CLOVA_URL, headers=headers, json=data, stream=False)
        response.raise_for_status()
        
        res_json = response.json()
        content_text = res_json.get('result', {}).get('message', {}).get('content', '')
        
        if not content_text:
            print(f"[Naver] Empty content received.")
            return None

        # --- [JSON 추출 및 파싱 로직 강화] ---
        
        # 1. Markdown 코드블록 제거
        json_str = ""
        match = re.search(r"```json\s*([\s\S]+?)\s*```", content_text)
        if match:
            json_str = match.group(1)
        else:
            # 중괄호/대괄호 추출 시도
            json_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content_text.strip())
            json_str = json_match.group(1) if json_match else content_text.strip()

        # 2. 파싱 시도 (3단계 방어 전략)
        
        # [1차 시도] 표준 json.loads (strict=False)
        try:
            return json.loads(json_str, strict=False)
        except json.JSONDecodeError:
            pass # 실패 시 2차 시도로 넘어감

        # [2차 시도] ast.literal_eval (Python 구조 파싱)
        # LLM이 가끔 JSON 대신 Python Dict 형태(True/False, 싱글쿼트 등)를 줄 때 유용함
        try:
            return ast.literal_eval(json_str)
        except:
            pass

        # [3차 시도] 흔한 오류(이스케이프 안 된 쌍따옴표) 수동 수정 후 재시도
        try:
            # "quote": "..." 패턴 안의 내용물은 건드리지 않고, 구조를 망가뜨리는 것만 수정하긴 어렵지만
            # 단순하게 줄바꿈 문제일 수도 있으므로 정리
            json_str_clean = json_str.replace('\n', '\\n').replace('\r', '')
            return json.loads(json_str_clean, strict=False)
        except:
            pass
            
        print(f"[JSON Parsing Failed] Content: {content_text[:200]}...")
        return None

    except Exception as e:
        print(f"[Naver API Error] {e}")
        return None

# --- (아래 S-BERT 관련 함수들은 기존과 동일하게 유지) ---

def _get_embedding(text):
    if not embedding_model: return None
    return embedding_model.encode(text)

def _calculate_similarity(text_a, text_b):
    vec_a = _get_embedding(text_a)
    vec_b = _get_embedding(text_b)
    if vec_a is None or vec_b is None: return 0.0
    return float(cosine_similarity([vec_a], [vec_b])[0][0])

def extract_representative_sentences(text_sentences, query_summary, top_k=1):
    if not text_sentences or not embedding_model: return ""
    sentence_embeddings = embedding_model.encode(text_sentences)
    query_embedding = embedding_model.encode(query_summary)
    similarities = cosine_similarity([query_embedding], sentence_embeddings)[0]
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    return text_sentences[top_indices[0]] if len(top_indices) > 0 else ""

# --------------------------------------------------------------------------------------
# --- 3. 핵심 기능 구현 (로직은 유지하되, 순차 처리는 API 제한에 따라 조정) ---
# --------------------------------------------------------------------------------------
def analyze_logic_neuron_map(text, key_concepts_str, core_thesis):
    """
    [Zone 기반 고도화] 논리 뉴런 맵 생성 (Full Batch Optimization)
    - LLM 호출을 단 2회(Zone C 1회 + Bridge 1회)로 최소화하여 속도 최적화
    """
    start_time = time()
    print("🚀 [Neuron Map] (Naver/Batch) 분석 시작.")
    
    # 0. 기본 데이터 검증
    if not key_concepts_str: 
        return {"nodes": [], "edges": [], "suggestions": [], "creative_feedbacks": []}
    
    concepts = [c.strip() for c in key_concepts_str.split(',') if c.strip()]
    if not concepts: 
        return {"nodes": [], "edges": [], "suggestions": [], "creative_feedbacks": []}

    nodes = [{"id": c, "label": c} for c in concepts]
    edges = []
    
    # 상태 추적 변수
    connected_status = {c: False for c in concepts}
    potential_bridges = {} # Zone B 저장용
    
    # [배치 처리를 위한 데이터 컨테이너]
    zone_c_candidates = [] # [{'id': 0, 'source': 'A', 'target': 'B', 'context': '...'}, ...]
    bridge_candidates = [] # [{'id': 0, 'iso': 'A', 'partner': 'B'}, ...]
    
    paragraphs = [p for p in text.split('\n') if len(p) > 20]

    # 1. S-BERT Batch Encoding
    if embedding_model:
        concept_vectors = embedding_model.encode(concepts) 
    else:
        concept_vectors = [None] * len(concepts) 

    # 2. Pairwise 분석 (N x N)
    print("   [Neuron Map] Pairwise 계산 및 Zone 분류...")
    zone_c_idx = 0 # Zone C 배치 ID 카운터

    for i in range(len(concepts)):
        for j in range(i + 1, len(concepts)):
            c1 = concepts[i]
            c2 = concepts[j]
            
            # (A) 물리적 거리 계산
            physical_score = 0.0
            context_sent = ""
            for p in paragraphs:
                if c1 in p and c2 in p:
                    physical_score += 1.0
                    if not context_sent: context_sent = p # 첫 발견 문장 저장
            physical_score = min(physical_score / 2.0, 1.0)

            # (B) 의미적 거리 계산
            if concept_vectors[i] is not None:
                semantic_score = float(cosine_similarity([concept_vectors[i]], [concept_vectors[j]])[0][0])
            else:
                semantic_score = 0.0
            
            # --- Zone 판별 및 엣지 생성 ---
            
            # Case 1: Zone C (창의적/억지 연결 의심) -> 배치 리스트에 추가
            if semantic_score < 0.2 and physical_score >= 0.5:
                edges.append({
                    "source": c1, "target": c2, 
                    "weight": round(semantic_score, 2),
                    "type": "questionable" # 프론트엔드에서 점선/물결선 표시
                })
                connected_status[c1] = True
                connected_status[c2] = True
                
                if context_sent:
                    zone_c_candidates.append({
                        "id": zone_c_idx,
                        "source": c1,
                        "target": c2,
                        "context": context_sent[:200] # 너무 길면 자름
                    })
                    zone_c_idx += 1

            # Case 2: Zone B (잠재적 연결) -> 나중에 Bridge 후보로 사용
            elif semantic_score > 0.55 and physical_score < 0.2:
                potential_bridges[(c1, c2)] = semantic_score

            # Case 3: Zone A (일반적 강한 연결)
            else:
                total_weight = (physical_score * 0.3) + (semantic_score * 0.7)
                if total_weight >= 0.3:
                    edges.append({
                        "source": c1, "target": c2, 
                        "weight": round(total_weight, 2),
                        "type": "strong" if total_weight > 0.55 else "normal"
                    })
                    connected_status[c1] = True
                    connected_status[c2] = True

    # 3. 외딴 섬(Isolated Node) Bridge 후보 선정
    isolated_nodes = [node for node, connected in connected_status.items() if not connected]
    processed_iso_nodes = set()
    bridge_idx = 0 # Bridge 배치 ID 카운터

    for iso_node in isolated_nodes:
        if iso_node in processed_iso_nodes: continue
        
        best_partner = None
        best_score = -1.0
        
        # 전략 1: Zone B (잠재적 연결) 활용
        for (p1, p2), score in potential_bridges.items():
            partner = None
            if p1 == iso_node: partner = p2
            elif p2 == iso_node: partner = p1
            
            if partner and score > best_score:
                best_score = score
                best_partner = partner

        # 전략 2: Fallback (S-BERT 유사도 전체 검색)
        if not best_partner:
            try: iso_idx = concepts.index(iso_node)
            except: continue
            
            best_sim = -1.0
            for k, other in enumerate(concepts):
                if iso_node == other: continue
                if concept_vectors[iso_idx] is None: continue
                sim = float(cosine_similarity([concept_vectors[iso_idx]], [concept_vectors[k]])[0][0])
                if sim > best_sim:
                    best_sim = sim
                    best_partner = other

        # 후보 등록
        if best_partner:
            bridge_candidates.append({
                "id": bridge_idx,
                "iso_node": iso_node,
                "partner_node": best_partner
            })
            bridge_idx += 1
            processed_iso_nodes.add(iso_node)


    # ----------------------------------------------------------------
    # [배치 처리 1] Zone C 창의성 검증 (LLM 1회 호출)
    # ----------------------------------------------------------------
    creative_feedbacks = []
    
    if zone_c_candidates:
        print(f"   [Neuron Map] Zone C 검증 {len(zone_c_candidates)}건 일괄 처리 중...")
        
        # 1. 프롬프트용 텍스트 블록 생성
        items_block = ""
        for item in zone_c_candidates:
            items_block += f"- ID {item['id']}: '{item['source']}' - '{item['target']}' (문맥: \"{item['context']}\")\n"
        
        # 2. LLM 호출
        prompt = CREATIVE_CONNECTION_BATCH_PROMPT.format(items_block=items_block)
        batch_result = _call_llm_json(prompt)
        
        # 3. 결과 매핑
        if batch_result and isinstance(batch_result, list):
            result_map = {res.get('id'): res for res in batch_result}
            
            for item in zone_c_candidates:
                res = result_map.get(item['id'])
                if res:
                    creative_feedbacks.append({
                        "concepts": [item['source'], item['target']],
                        "judgment": res.get('judgment', 'Forced'),
                        "reason": res.get('reason', ''),
                        "feedback": res.get('feedback', '')
                    })
    else:
        print("   [Neuron Map] Zone C(창의성 검증) 대상 없음.")


    # ----------------------------------------------------------------
    # [배치 처리 2] Bridge 제안 생성 (LLM 1회 호출)
    # ----------------------------------------------------------------
    suggestions = []
    
    if bridge_candidates:
        print(f"   [Neuron Map] Bridge 제안 {len(bridge_candidates)}건 일괄 처리 중...")
        
        # 1. 프롬프트용 텍스트 블록 생성
        pairs_block = ""
        for item in bridge_candidates:
            pairs_block += f"- ID {item['id']}: '{item['iso_node']}' <-> '{item['partner_node']}'\n"
            
        # 2. LLM 호출
        prompt = BRIDGE_CONCEPT_BATCH_PROMPT.format(
            core_thesis=core_thesis, 
            pairs_block=pairs_block
        )
        batch_result = _call_llm_json(prompt)
        
        # 3. 결과 매핑
        if batch_result and isinstance(batch_result, list):
            result_map = {res.get('id'): res.get('socratic_guide') for res in batch_result}
            
            for item in bridge_candidates:
                guide = result_map.get(item['id'])
                if guide:
                    suggestions.append({
                        "target_node": item['iso_node'],
                        "partner_node": item['partner_node'],
                        "suggestion": guide
                    })
    else:
        print("   [Neuron Map] 외딴 섬(Isolated Node) 없음.")


    # 최종 완료
    total_time = time() - start_time
    print(f"✅ [Neuron Map] 완료. (총 소요시간: {total_time:.3f}초)")
    
    return {
        "nodes": nodes, 
        "edges": edges, 
        "suggestions": suggestions, 
        "creative_feedbacks": creative_feedbacks
    }

def scan_logical_integrity(text):
    """[기능 2] 논리 정합성 스캐너 (Naver)"""
    start_time = time()
    print("🔎 [Integrity] (Naver) 시작.")
    prompt = INTEGRITY_SCANNER_PROMPT.format(text=text[:4000]) # 네이버 토큰 제한 고려
    issues = _call_llm_json(prompt)
    print(f"✅ [Integrity] (Naver) 완료. 시간: {time() - start_time:.3f}초")
    return issues or []

def check_flow_disconnects_with_llm(flow_pattern_json, raw_text):
    """[기능 3] 흐름 단절 검사 (최적화 + 가독성 향상 적용)"""
    start_time = time()
    print("🌊 [Disconnect] (Naver) 시작.")
    
    if not flow_pattern_json or 'nodes' not in flow_pattern_json or 'edges' not in flow_pattern_json:
        return []

    nodes = flow_pattern_json['nodes']
    edges = flow_pattern_json['edges']
    
    # 1. 문장 분리
    split_start = time()
    raw_sentences = [s.strip() for s in re.split(r'[.?!]\s+', raw_text) if len(s.strip()) > 10]
    print(f"   [Debug] 문장 분리 완료 ({len(raw_sentences)}문장). 소요: {time() - split_start:.3f}초")
    
    edges_context = []
    snippets_context = {}

    # ------------------------------------------------------------------
    # [최적화] 본문 임베딩 Pre-calculation
    # ------------------------------------------------------------------
    embed_start = time()
    if embedding_model and raw_sentences:
        doc_embeddings = embedding_model.encode(raw_sentences)
        print(f"   [Debug] 본문 전체 임베딩 완료. 소요: {time() - embed_start:.3f}초")
    else:
        doc_embeddings = None
        print("   [Debug] 임베딩 모델 없음. 스킵.")

    # 2. 증거 문장 추출 (Retrieval)
    retrieval_start = time()
    
    for idx, edge in enumerate(edges):
        parent_id, child_id = edge
        
        # 노드 전체 텍스트 가져오기
        parent_full_text = nodes.get(parent_id, "")
        child_full_text = nodes.get(child_id, "")
        
        # [수정] 대괄호 [] 안의 카테고리 명 추출 (예: "문제 제기", "핵심 주장")
        # 정규식: 문자열 시작 부분의 [ ... ] 패턴을 찾음
        p_match = re.search(r'\[(.*?)\]', parent_full_text)
        c_match = re.search(r'\[(.*?)\]', child_full_text)
        
        p_label = p_match.group(1) if p_match else parent_id
        c_label = c_match.group(1) if c_match else child_id
        
        # 요약 내용 추출 (마지막 줄)
        parent_summary = parent_full_text.split('\n')[-1].strip()
        child_summary = child_full_text.split('\n')[-1].strip()
        
        if not parent_summary or not child_summary: continue

        # [최적화된 추출 로직]
        p_rep = ""
        c_rep = ""
        
        if embedding_model and doc_embeddings is not None:
            # Parent 쿼리
            p_query_vec = embedding_model.encode(parent_summary)
            p_sims = cosine_similarity([p_query_vec], doc_embeddings)[0]
            p_idx = np.argmax(p_sims)
            p_rep = raw_sentences[p_idx]

            # Child 쿼리
            c_query_vec = embedding_model.encode(child_summary)
            c_sims = cosine_similarity([c_query_vec], doc_embeddings)[0]
            c_idx = np.argmax(c_sims)
            c_rep = raw_sentences[c_idx]
        
        # [핵심 수정] Edge Key를 가독성 있게 변경
        # 예: "[문제 제기] P1 -> [핵심 주장] T1"
        edge_key = f"[{p_label}] {parent_id} -> [{c_label}] {child_id}"
        
        edges_context.append(edge_key)
        snippets_context[edge_key] = {
            "parent_summary": parent_summary,
            "child_summary": child_summary,
            "parent_snippet": p_rep,
            "child_snippet": c_rep
        }

    print(f"   [Debug] 스니펫 추출 완료. 엣지 {len(edges)}개 처리 소요: {time() - retrieval_start:.3f}초")

    if not edges_context: return []

    # 3. LLM 판결 (Judge)
    prompt_content = f"""
    {LOGIC_FLOW_CHECK_PROMPT}
    [Structure Edges] {json.dumps(edges_context, ensure_ascii=False)}
    [Text Snippets] {json.dumps(snippets_context, ensure_ascii=False)}
    """

    llm_start = time()
    print(f"   [Debug] LLM 호출 시작... (데이터 크기: {len(prompt_content)} chars)")
    
    # 네이버 API 호출
    weak_links_result = _call_llm_json(prompt_content)
    
    print(f"   [Debug] LLM 응답 수신 완료. 소요: {time() - llm_start:.3f}초")

    # 필터링 (Strong 제외)
    filtered_result = []
    if weak_links_result:
        filtered_result = [
            item for item in weak_links_result 
            if item.get('issue_type') in ['Weak', 'Bridge Needed'] 
        ]

    print(f"✅ [Disconnect] (Naver) 최종 완료. 총 소요 시간: {time() - start_time:.3f}초")
    return filtered_result
# --------------------------------------------------------------------------------------
# --- 4. 메인 진입 ---
# --------------------------------------------------------------------------------------
def perform_deep_analysis_async(summary_json, raw_text, on_task_complete):
    """
    [비동기 병렬 처리]
    3개의 분석 작업을 동시에 시작하고, 끝나는 대로 on_task_complete 콜백을 호출합니다.
    """
    start_time = time()
    print("\n--- 🧠 [DEEP ANALYSIS] 병렬 처리 시작 ---")
    
    key_concepts = summary_json.get('key_concepts', '')
    core_thesis = summary_json.get('Core_Thesis', '')
    flow_pattern = summary_json.get('Flow_Pattern', {})

    # 작업 정의 (함수명, 인자 리스트, 결과 키 이름)
    tasks = [
        {
            "func": analyze_logic_neuron_map,
            "args": (raw_text, key_concepts, core_thesis),
            "key": "neuron_map"
        },
        {
            "func": scan_logical_integrity,
            "args": (raw_text,),
            "key": "integrity_issues"
        },
        {
            "func": check_flow_disconnects_with_llm,
            "args": (flow_pattern, raw_text),
            "key": "flow_disconnects"
        }
    ]

    results = {}
    
    # ThreadPool로 3개 함수 동시 실행
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_key = {
            executor.submit(task["func"], *task["args"]): task["key"] 
            for task in tasks
        }

        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                data = future.result()
                results[key] = data
                print(f"⚡ [Async] '{key}' 완료. DB 업데이트 요청.")
                
                # [핵심] 작업 하나 끝날 때마다 콜백 호출 -> DB 저장
                if on_task_complete:
                    on_task_complete(key, data)
                    
            except Exception as e:
                print(f"❌ [Async Error] '{key}' 실패: {e}")
                if on_task_complete:
                    on_task_complete(key, {"error": str(e)})

    total_time = time() - start_time
    print(f"--- ✅ [DEEP ANALYSIS] 전체 병렬 처리 완료. 시간: {total_time:.3f}초 ---\n")
    return results