import re
import textwrap
from collections import deque, defaultdict
from flask import Flask, jsonify, request # 또는 FastAPI

# --- 1. 위상 정렬 (JS의 calculateLevels 로직) ---
def _calculate_levels(node_ids, edges):
    """
    위상 정렬을 사용하여 노드의 레벨(Y축 위치)을 계산합니다.
    JS 로직의 순환 엣지 무시 규칙을 동일하게 적용합니다.
    """
    levels = {}
    indegree = {node_id: 0 for node_id in node_ids}
    graph = {node_id: [] for node_id in node_ids}

    for src, tgt in edges:
        if src in node_ids and tgt in node_ids:
            # [중요] JS의 레이아웃용 순환 엣지 무시 로직
            # (예: B3 -> A3 같이 레벨이 역행하는 엣지는 레이아웃 계산에서 제외)
            if src > tgt and src[0] != tgt[0]:
                print(f"[Backend] 레이아웃 순환 엣지 무시: {src} -> {tgt}")
                continue
            
            graph[src].append(tgt)
            indegree[tgt] += 1

    # 진입 차수가 0인 노드를 큐에 추가
    queue = deque([node_id for node_id in node_ids if indegree[node_id] == 0])
    
    if not queue and node_ids:
        print("[Backend] 시작 노드 없음/순환 그래프. 노드 순서대로 레벨 할당.")
        for idx, node_id in enumerate(node_ids):
            levels[node_id] = idx
        return levels

    level = 0
    visited_nodes = set()
    while queue:
        level_size = len(queue)
        for _ in range(level_size):
            node = queue.popleft()
            if node in visited_nodes:
                continue
            
            visited_nodes.add(node)
            levels[node] = level
            
            for neighbor in graph[node]:
                indegree[neighbor] -= 1
                if indegree[neighbor] == 0:
                    queue.append(neighbor)
        level += 1

    # 순환 구조에 포함된 노드 처리 (JS와 동일)
    for node_id in node_ids:
        if node_id not in levels:
            print(f"[Backend] 노드 {node_id}가 순환 구조에 포함됨. 마지막 레벨 할당.")
            levels[node_id] = level
            level += 1

    return levels

# --- 2. 텍스트 줄바꿈 (JS의 wrapText 로직) ---
def _wrap_text(text, max_width=18):
    """
    텍스트를 지정된 너비로 줄바꿈하고 <br> 태그로 연결합니다.
    """
    if not text:
        return ''
    # textwrap.wrap이 공백을 알아서 처리해줍니다.
    lines = textwrap.wrap(text, width=max_width, 
                          break_long_words=True, 
                          replace_whitespace=False,
                          fix_sentence_endings=False)
    return "<br>".join(lines)

# --- 3. 메인 변환 함수 (JS의 convertToPlotlyJSON 로직) ---
def generate_flow_chart_json(flow_pattern):
    """
    nodes/edges 딕셔너리를 Plotly JSON 객체로 변환합니다.
    """
    if not isinstance(flow_pattern, dict):
        raise ValueError("입력값은 딕셔너리여야 합니다.")
        
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

    # 2. 텍스트 및 툴팁 처리 (Text Processing)
    node_texts = []
    hover_texts = []
    title_regex = re.compile(r'^(\[.*?\])') # [타이틀] 추출

    for node_id in node_ids:
        text = nodes_data.get(node_id, node_id)
        title_match = title_regex.match(text)
        
        # 툴팁용 타이틀/내용
        tooltip_title = f"<b>({node_id})</b>"
        tooltip_content = text

        # 노드 텍스트용 타이틀/내용
        node_title = f"<b>{node_id}</b>"
        node_content = text

        if title_match:
            title_str = title_match.group(1) # 대괄호 안의 내용
            title_full = title_match.group(0) # 대괄호 포함
            
            # JS의 .replace(/^:?\s*/, '').trim() 로직
            content_str = text[len(title_full):].lstrip(': ').strip()
            
            tooltip_title = f"<b>{title_full} ({node_id})</b>"
            tooltip_content = content_str
            
            node_title = f"<b>{title_full}</b>"
            node_content = content_str

        # 노드 텍스트: 18자 줄바꿈 적용
        wrapped_content = _wrap_text(node_content, max_width=18)
        node_texts.append(f"{node_title}<br>{wrapped_content}")
        
        # 툴팁 텍스트: 원본의 \n만 <br>로 변경
        hover_texts.append(f"{tooltip_title}<br>{tooltip_content.replace(chr(10), '<br>')}")

    # 3. 화살표 생성 (Annotations)
    edge_arrows = []
    
    # [신규] 픽셀 단위 오프셋 값
    # 노드 상자의 "절반 높이 + 여백"에 해당하는 픽셀(px) 값입니다.
    # 이 값은 폰트 크기, 패딩, 줄 수에 따라 미세 조정이 필요할 수 있습니다.
    Y_PIXEL_OFFSET = 30  # 예: 30px (이 값을 조정하여 간격 변경)

    for src, tgt in edges_data:
        pos_src = positions.get(src)
        pos_tgt = positions.get(tgt)
        
        if not pos_src or not pos_tgt:
            print(f"[Backend] 엣지 {src}->{tgt} 위치 누락. 건너뜁니다.")
            continue
            
        # [신규] 오프셋 초기화
        yshift = 0
        ayshift = 0
        
        # [신규] 수직 방향 감지 (어느 방향으로 흐르는가)
        # (pos_tgt["y"]가 pos_src["y"]보다 작으면 하향 흐름)
        y_diff = pos_tgt["y"] - pos_src["y"]

        # y_diff == 0 인 경우는 (현재 레이아웃 로직상) 거의 없으므로 
        # 수평 로직은 생략하고 수직 이동만 처리합니다.

        if y_diff < 0: 
            # (y_diff < 0) == 하향 흐름 (예: A1 -> A2)
            # 요청하신 내용:
            # 시작점(src)은 중앙에서 '아래로' (음수)
            ayshift = -Y_PIXEL_OFFSET
            # 끝점(tgt)은 중앙에서 '위로' (양수)
            yshift = Y_PIXEL_OFFSET
        
        elif y_diff > 0:
            # (y_diff > 0) == 상향 흐름 (예: B3 -> A3)
            # 하향 흐름의 반대로 적용해야 자연스럽습니다.
            # 시작점(src)은 중앙에서 '위로' (양수)
            ayshift = Y_PIXEL_OFFSET
            # 끝점(tgt)은 중앙에서 '아래로' (음수)
            yshift = -Y_PIXEL_OFFSET
        
        # else: y_diff == 0 (수평) - 현재 로직에서는 무시

        edge_arrows.append({
            "showarrow": True,
            "arrowhead": 2,
            "arrowsize": 1.2,
            "arrowwidth": 2,
            "arrowcolor": '#334155',
            
            # [수정] 기본 좌표는 노드의 중앙을 그대로 사용
            "x": pos_tgt["x"],
            "y": pos_tgt["y"],
            "ax": pos_src["x"],
            "ay": pos_src["y"],

            # [신규] 픽셀 단위 시프트(shift) 적용
            "yshift": yshift,   # 끝점(head)의 픽셀 시프트
            "ayshift": ayshift, # 시작점(start)의 픽셀 시프트

            "xref": 'x', "yref": 'y',
            "axref": 'x', "ayref": 'y',
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
                "family": '"Noto Sans KR", Arial, sans-serif',
                "size": 12,
                "color": '#1E293B',
                "bgcolor": 'rgba(0,0,0,0)',
                # [수정] JS와 동일하게 검정 테두리 적용
                "bordercolor": '#000000', 
                "borderwidth": 2,
                "borderpad": 4
            },
            "hovertext": hover_texts,
            "hoverinfo": 'text'
        }],
        "layout": {
            "title": '<b>논리 흐름도</b>',
            "titlefont": {
                "family": '"Noto Sans KR", Arial, sans-serif',
                "size": 18,
                "color": '#111827'
            },
            "showlegend": False,
            "hovermode": 'closest',
            "plot_bgcolor": 'white',
            "paper_bgcolor": '#F9FAFB',
            "margin": {"l": 40, "r": 40, "t": 80, "b": 40},
            "xaxis": {"visible": False, "showgrid": False, "zeroline": False},
            "yaxis": {"visible": False, "showgrid": False, "zeroline": False, "scaleanchor": "x", "scaleratio": 1},
            "annotations": edge_arrows,
            "font": {"family": '"Noto Sans KR", Arial, sans-serif'}
        }
    }
    
    return plotly_json
