import re
import textwrap
from collections import deque, defaultdict
import json
import plotly.graph_objects as go # 👈 [신규] HTML 생성을 위해 임포트

# --- 1. 백엔드에서 생성된 원본 데이터 (사용자 샘플 데이터) ---
# 실제 환경에서는 이 데이터가 DB나 다른 로직에서 생성될 것입니다.
SAMPLE_FLOW_PATTERN = {
  "edges": [
    ["A1", "A2"], ["A2", "A3"], ["A3", "B1"], ["B1", "B2"], ["B2", "B3"],
    ["B3", "A3"], ["A3", "C1"], ["C1", "C2"], ["C2", "C3"], ["C3", "A3"],
    ["A3", "D1"], ["D1", "D2"], ["D2", "D3"]
  ],
  "nodes": {
    "A1": "[문제 제기]\nAI 기술 발전으로 사회 전반의 구조가 변화하고 있습니다.",
    "A2": "[대조]\nAI는 효율성 뛰어나나 인간의 윤리, 창의, 공감 능력은 고유한 영역입니다.",
    "A3": "[핵심 주장]\nAI 시대에 인간 고유 역량을 길러주는 인문학 교육의 재정립 및 강화가 필요합니다.",
    "B1": "[근거1]\nAI의 사회 통합 심화로 윤리적 딜레마가 복잡해지고 있습니다.",
    "B2": "[근거1 세부 설명]\n기술만으로는 윤리 문제의 해답을 찾을 수 없습니다.",
    "B3": "[근거1 결론]\n인문학은 비판적 사고와 도덕적 근거를 제공하여 인간 가치 중심 기술 설계를 돕습니다.",
    "C1": "[근거2]\nAI는 새로운 질문 제시 및 심층적 감정 공감 능력에 근본적 한계가 있습니다.",
    "C2": "[근거2 세부 설명]\nAI 시대에는 독창적 아이디어와 깊은 통찰력을 요구하는 직업이 중요해질 것입니다.",
    "C3": "[근거2 결론]\n인문학은 인간의 내면 탐구, 문화 이해, 새로운 관점 창출 능력을 키워 AI가 해결 못 하는 문제에 대한 원동력이 됩니다.",
    "D1": "[해결 방안 제안]\n인문학 교육은 기술 분야와 융합되어야 합니다.",
    "D2": "[해결 방안 구체화]\n지식 암기식 교육에서 벗어나 실제 문제 해결 중심의 융합 교육이 필요합니다.",
    "D3": "[결론 강조]\n인문학 교육은 인간 중심의 지속 가능한 미래 설계를 위한 능동적 투자입니다."
  }
}

# --- 2. 헬퍼 함수 (Python 로직) ---

def _calculate_levels(node_ids, edges):
    """위상 정렬로 레벨 계산"""
    levels = {}
    indegree = {node_id: 0 for node_id in node_ids}
    graph = {node_id: [] for node_id in node_ids}

    for src, tgt in edges:
        if src in node_ids and tgt in node_ids:
            if src > tgt and src[0] != tgt[0]:
                print(f"[Backend] 레이아웃 순환 엣지 무시: {src} -> {tgt}")
                continue
            graph[src].append(tgt)
            indegree[tgt] += 1

    queue = deque([node_id for node_id in node_ids if indegree[node_id] == 0])
    
    if not queue and node_ids:
        for idx, node_id in enumerate(node_ids): levels[node_id] = idx
        return levels

    level = 0
    visited_nodes = set()
    while queue:
        level_size = len(queue)
        for _ in range(level_size):
            node = queue.popleft()
            if node in visited_nodes: continue
            
            visited_nodes.add(node)
            levels[node] = level
            
            for neighbor in graph[node]:
                indegree[neighbor] -= 1
                if indegree[neighbor] == 0: queue.append(neighbor)
        level += 1

    for node_id in node_ids:
        if node_id not in levels:
            levels[node_id] = level
            level += 1
    return levels

def _wrap_text(text, max_width=18):
    """텍스트 줄바꿈"""
    if not text: return ''
    lines = textwrap.wrap(text, width=max_width, 
                          break_long_words=True, 
                          replace_whitespace=False,
                          fix_sentence_endings=False)
    return "<br>".join(lines)

# --- 3. 메인 변환 함수 (모든 로직 통합) ---

def generate_flow_chart_json(flow_pattern):
    """
    (nodes/edges) 입력을 받아 (Plotly JSON)을 반환합니다.
    [수정] 화살표 픽셀 오프셋 로직 포함
    """
    
    nodes_data = flow_pattern.get("nodes")
    edges_data = flow_pattern.get("edges")

    if not nodes_data or not isinstance(edges_data, list):
        raise ValueError("유효한 'nodes'와 'edges'가 필요합니다.")

    node_ids = list(nodes_data.keys())

    # 1. 위치 계산 (Layout)
    positions = {}
    levels = _calculate_levels(node_ids, edges_data)
    level_groups = defaultdict(list)
    for node_id in node_ids:
        lv = levels.get(node_id, 0)
        level_groups[lv].append(node_id)

    y_gap = 3.0
    x_gap = 4.0
    for lv, nodes_in_level in level_groups.items():
        start_x = -(len(nodes_in_level) - 1) * x_gap / 2
        for idx, node_id in enumerate(nodes_in_level):
            positions[node_id] = {
                "x": start_x + idx * x_gap,
                "y": -int(lv) * y_gap
            }

    # 2. 텍스트 및 툴팁 처리
    node_texts, hover_texts = [], []
    title_regex = re.compile(r'^(\[.*?\])')

    for node_id in node_ids:
        text = nodes_data.get(node_id, node_id)
        title_match = title_regex.match(text)
        
        tooltip_title = f"<b>({node_id})</b>"
        tooltip_content = text
        node_title = f"<b>{node_id}</b>"
        node_content = text

        if title_match:
            title_full = title_match.group(0)
            content_str = text[len(title_full):].lstrip(': ').strip()
            
            tooltip_title = f"<b>{title_full} ({node_id})</b>"
            tooltip_content = content_str
            node_title = f"<b>{title_full}</b>"
            node_content = content_str

        wrapped_content = _wrap_text(node_content, max_width=18)
        node_texts.append(f"{node_title}<br>{wrapped_content}")
        hover_texts.append(f"{tooltip_title}<br>{tooltip_content.replace(chr(10), '<br>')}")

    # 3. 화살표 생성 (Annotations) - [수정] 픽셀 오프셋 적용
    edge_arrows = []
    Y_PIXEL_OFFSET = 30 # 👈 화살표 간격 조정

    for src, tgt in edges_data:
        pos_src = positions.get(src)
        pos_tgt = positions.get(tgt)
        
        if not pos_src or not pos_tgt:
            continue
            
        yshift, ayshift = 0, 0
        y_diff = pos_tgt["y"] - pos_src["y"]

        if y_diff < 0: # 하향 흐름
            ayshift = -Y_PIXEL_OFFSET # 시작점(src) 아래로
            yshift = Y_PIXEL_OFFSET   # 끝점(tgt) 위로
        elif y_diff > 0: # 상향 흐름
            ayshift = Y_PIXEL_OFFSET   # 시작점(src) 위로
            yshift = -Y_PIXEL_OFFSET # 끝점(tgt) 아래로
        
        edge_arrows.append({
            "showarrow": True, "arrowhead": 2, "arrowsize": 1.2, "arrowwidth": 2, "arrowcolor": '#334155',
            "x": pos_tgt["x"], "y": pos_tgt["y"], "ax": pos_src["x"], "ay": pos_src["y"],
            "yshift": yshift,   # 👈 끝점 픽셀 시프트
            "ayshift": ayshift, # 👈 시작점 픽셀 시프트
            "xref": 'x', "yref": 'y', "axref": 'x', "ayref": 'y',
            "layer": 'below'
        })

    # 4. Plotly JSON 최종 조립
    plotly_json = {
        "data": [{
            "x": [positions.get(node_id, {}).get("x", 0) for node_id in node_ids],
            "y": [positions.get(node_id, {}).get("y", 0) for node_id in node_ids],
            "mode": 'text',
            "type": 'scatter',
            "text": node_texts,
            "textposition": 'middle center',
            "textfont": {
                "family": '"Noto Sans KR", Arial, sans-serif', "size": 12, "color": '#1E293B',
                "bgcolor": 'rgba(0,0,0,0)', "bordercolor": '#000000', "borderwidth": 2, "borderpad": 4
            },
            "hovertext": hover_texts,
            "hoverinfo": 'text'
        }],
        "layout": {
            "title": '<b>논리 흐름도 (백엔드 테스트)</b>',
            "titlefont": {"family": '"Noto Sans KR", Arial, sans-serif', "size": 18, "color": '#111827'},
            "showlegend": False, "hovermode": 'closest',
            "plot_bgcolor": 'white', "paper_bgcolor": '#F9FAFB',
            "margin": {"l": 40, "r": 40, "t": 80, "b": 40},
            "xaxis": {"visible": False, "showgrid": False, "zeroline": False},
            "yaxis": {"visible": False, "showgrid": False, "zeroline": False, "scaleanchor": "x", "scaleratio": 1},
            "annotations": edge_arrows,
            "font": {"family": '"Noto Sans KR", Arial, sans-serif'}
        }
    }
    
    return plotly_json

# --- 4. [신규] 테스트 실행기 ---

if __name__ == "__main__":
    print("[1] 백엔드에서 원본 데이터(nodes/edges)를 생성했습니다.")
    # (실제로는 _get_data_from_db() 같은 함수를 호출)
    raw_data = SAMPLE_FLOW_PATTERN

    print("[2] 원본 데이터를 Plotly JSON으로 변환합니다...")
    # (화살표 오프셋 로직 포함)
    plotly_json = generate_flow_chart_json(raw_data)
    
    print("[3] Plotly JSON을 'flow_chart_test.html' 파일로 저장합니다.")

    # Plotly JSON 형식({ 'data': [...], 'layout': {...} })을
    # Plotly Figure 객체로 변환
    fig = go.Figure(data=plotly_json['data'], layout=plotly_json['layout'])
    
    # HTML 파일로 저장
    # auto_open=True로 설정하면 저장 후 자동으로 브라우저가 열립니다.
    fig.write_html("flow_chart_test.html", auto_open=True)
    
    print(f"[4] 완료! 'flow_chart_test.html' 파일을 확인하세요.")
