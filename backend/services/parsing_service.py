import os
import re
import json

# --- 1. 텍스트 추출 헬퍼 (파일 업로드용) ---

def extract_text(file_storage):
    """
    Flask FileStorage 객체를 받아, 파일 확장자에 따라 텍스트를 추출합니다.
    (현재는 .txt만 지원하며, 향후 .pdf, .docx 등을 추가할 수 있습니다.)
    """
    filename = file_storage.filename
    
    try:
        if filename.endswith('.txt'):
            # FileStorage.read()는 bytes를 반환하므로, 'utf-8'로 디코딩
            # (디코딩 실패를 대비해 'replace' 옵션 추가)
            text = file_storage.read().decode('utf-8', errors='replace')
            return text
            
        # (추후 확장)
        # elif filename.endswith('.docx'):
        #     import docx2txt
        #     return docx2txt.process(file_storage)
            
        # elif filename.endswith('.pdf'):
        #     import PyPDF2
        #     reader = PyPDF2.PdfReader(file_storage)
        #     text = ""
        #     for page in reader.pages:
        #         text += page.extract_text()
        #     return text
            
        else:
            # 지원하지 않는 파일 형식
            print(f"[Parsing Service] WARNING: Unsupported file type: {filename}")
            # (임시) 텍스트 파일로 강제 디코딩 시도
            try:
                text = file_storage.read().decode('utf-8', errors='replace')
                return text
            except Exception:
                return None

    except Exception as e:
        print(f"[Parsing Service] CRITICAL: Error extracting text from {filename}: {e}")
        return None

# --- 2. Flow Pattern 파싱 헬퍼 (시각화용) ---

def parse_flow_pattern(flow_pattern_obj):
    """
    LLM이 생성한 'Flow_Pattern' JSON 객체를 받아,
    프론트엔드 시각화 라이브러리(D3, Vis.js 등)가 사용하기 쉬운
    노드 리스트(id, label)와 엣지 리스트(from, to)로 변환합니다.
    
    Args:
        flow_pattern_obj (dict): 
            LLM이 생성한 객체. 예: {"nodes": {"A1": "[단계]: 요약"}, "edges": [["A1", "B1"]]}

    Returns:
        tuple: (nodes_for_viz, edges_for_viz)
            - nodes_for_viz (list): [{"id": "A1", "label": "[단계]: 요약"}, ...]
            - edges_for_viz (list): [{"from": "A1", "to": "B1"}, ...]
    """
    
    nodes_for_viz = []
    edges_for_viz = []

    if not isinstance(flow_pattern_obj, dict):
        print("[Parsing Service] WARNING: Flow_Pattern is not a valid dictionary.")
        return [], []

    # 1. 노드 파싱 (Dictionary -> List of Objects)
    # LLM이 생성한 {"A1": "[단계]: 요약", "B1": ...} 형태
    nodes_dict = flow_pattern_obj.get("nodes")
    
    if isinstance(nodes_dict, dict):
        for node_id, node_label in nodes_dict.items():
            nodes_for_viz.append({
                "id": str(node_id), # ID는 항상 문자열로 보장
                "label": str(node_label) # Label도 문자열로 보장
            })
    else:
        print("[Parsing Service] WARNING: 'nodes' key is missing or not a dictionary.")

    # 2. 엣지 파싱 (List of Lists -> List of Objects)
    # LLM이 생성한 [["A1", "B1"], ["B1", "C1"]] 형태
    edges_list = flow_pattern_obj.get("edges")
    
    if isinstance(edges_list, list):
        for edge_pair in edges_list:
            # 엣지 쌍이 [출발, 도착] 형태의 리스트인지 확인
            if isinstance(edge_pair, (list, tuple)) and len(edge_pair) == 2:
                edges_for_viz.append({
                    "from": str(edge_pair[0]), # ID는 항상 문자열로 보장
                    "to": str(edge_pair[1])    # ID는 항상 문자열로 보장
                })
            else:
                print(f"[Parsing Service] WARNING: Invalid edge format found: {edge_pair}")
    else:
        print("[Parsing Service] WARNING: 'edges' key is missing or not a list.")

    return nodes_for_viz, edges_for_viz