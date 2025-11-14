import os
import re
import json
import traceback # [신규] 상세 에러 로깅

# --- [신규!] .docx와 .pdf 라이브B러리 임포트 ---
import docx 
from pypdf import PdfReader
# --- [신규!] ---

# --- 1. 텍스트 추출 헬퍼 (파일 업로드용) ---

def extract_text(file_storage):
    """
    Flask FileStorage 객체를 받아, 파일 확장자에 따라 텍스트를 추출합니다.
    [수정] .txt, .docx, .pdf를 모두 지원합니다.
    """
    filename = file_storage.filename
    
    try:
        # [중요] file_storage는 스트림이므로, .read() 전에 seek(0)가 필요합니다.
        file_storage.seek(0) 
        
        if filename.endswith('.txt'):
            print(f"[Parsing Service] Processing .txt file: {filename}")
            # FileStorage.read()는 bytes를 반환하므로, 'utf-8'로 디코딩
            text = file_storage.read().decode('utf-8', errors='replace')
            return text
            
        # --- [신규!] .docx 파서 활성화 ---
        elif filename.endswith('.docx'):
            print(f"[Parsing Service] Processing .docx file: {filename}")
            # file_storage (스트림)를 docx.Document로 직접 엽니다.
            document = docx.Document(file_storage)
            full_text = []
            for para in document.paragraphs:
                full_text.append(para.text)
            return '\n'.join(full_text)
            
        # --- [신규!] .pdf 파서 활성화 ---
        elif filename.endswith('.pdf'):
            print(f"[Parsing Service] Processing .pdf file: {filename}")
            # file_storage (스트림)를 PdfReader로 직접 엽니다.
            reader = PdfReader(file_storage)
            full_text = []
            for page in reader.pages:
                text = page.extract_text()
                if text: # (텍스트가 있는 페이지만 추가)
                    full_text.append(text)
            return '\n'.join(full_text)
            
        else:
            # [수정] 지원하지 않는 파일 형식은 이제 텍스트로 읽으려 시도하지 않고
            # 명시적으로 None을 반환하여, AI에게 보내지 않도록 합니다.
            print(f"[Parsing Service] CRITICAL: Unsupported file type: {filename}")
            return None

    except Exception as e:
        print(f"[Parsing Service] CRITICAL: Error extracting text from {filename}: {e}")
        traceback.print_exc() # [신규] 디버깅을 위한 상세 에러 로그
        return None

# --- 2. Flow Pattern 파싱 헬퍼 (시각화용) ---
# (이하 코드는 원본과 동일하게 유지합니다)

def parse_flow_pattern(flow_pattern_obj):
    """
    LLM이 생성한 'Flow_Pattern' JSON 객체를 받아,
    프론트엔드 시각화 라이브러리(D3, Vis.js 등)가 사용하기 쉬운
    노드 리스트(id, label)와 엣지 리스트(from, to)로 변환합니다.
    """
    
    nodes_for_viz = []
    edges_for_viz = []

    if not isinstance(flow_pattern_obj, dict):
        print("[Parsing Service] WARNING: Flow_Pattern is not a valid dictionary.")
        return [], []

    # 1. 노드 파싱
    nodes_dict = flow_pattern_obj.get("nodes")
    
    if isinstance(nodes_dict, dict):
        for node_id, node_label in nodes_dict.items():
            nodes_for_viz.append({
                "id": str(node_id),
                "label": str(node_label)
            })
    else:
        print("[Parsing Service] WARNING: 'nodes' key is missing or not a dictionary.")

    # 2. 엣지 파싱
    edges_list = flow_pattern_obj.get("edges")
    
    if isinstance(edges_list, list):
        for edge_pair in edges_list:
            if isinstance(edge_pair, (list, tuple)) and len(edge_pair) == 2:
                edges_for_viz.append({
                    "from": str(edge_pair[0]),
                    "to": str(edge_pair[1])
                })
            else:
                print(f"[Parsing Service] WARNING: Invalid edge format found: {edge_pair}")
    else:
        print("[Parsing Service] WARNING: 'edges' key is missing or not a list.")

    return nodes_for_viz, edges_for_viz