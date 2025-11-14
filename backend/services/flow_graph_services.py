# flow_graph_services.py

# pip install plotly kaleido
# (이미지 변환을 위해 kaleido가 필요합니다)
import plotly.graph_objects as go
import plotly.io as pio
import textwrap
from collections import defaultdict, deque
import math
import re

# ====== 박스/폰트/간격 설정 (원래 코드와 동일) ======
BOX_STYLE = {
    "base_w": 1.35,      # 기본 폭(조금 넓힘)
    "base_h": 1.5,       # ✅ 기본 높이 크게 (폰트 확대 대응)
    "per_line_h": 1.0,   # ✅ 줄당 높이 증가 크게
    "per_char_w": 0.032, # 줄 내 최대 글자수에 따른 폭 증가
    "min_w": 1.20,
    "max_w": 3.10,
    "pad_x": 0.14,       # 좌우 여백
    "pad_y": 0.20        # ✅ 상하 여백 증가
}

FONT_SIZE = 16           # (원하시면 17~18로)
WRAP_WIDTH = 15          # 폰트 커졌으니 줄바꿈 폭 살짝 줄여 높이 확보

SPACING = {
    "base_x_gap": 0.70,      # 가로 간격
    "base_y_gap": 1.35,      # ✅ 기본 세로 간격 넉넉히
    "level_gap_scale": 1.15, # ✅ 레벨 간 추가 여유 배수
    "center_jitter_amp": 0.06
}
# ====================================

# ------------------ 유틸 (원래 코드와 동일) ------------------
def wrap_ko(text: str, width=WRAP_WIDTH) -> str:
    text = (text or "").replace("·", "•")
    return "<br>".join(textwrap.wrap(text, width=width))

def rect_size(label_html: str,
             base_w=BOX_STYLE["base_w"], base_h=BOX_STYLE["base_h"],
             per_line_h=BOX_STYLE["per_line_h"], per_char_w=BOX_STYLE["per_char_w"],
             max_w=BOX_STYLE["max_w"], min_w=BOX_STYLE["min_w"],
             pad_x=BOX_STYLE["pad_x"], pad_y=BOX_STYLE["pad_y"]):
    lines = (label_html or "").split("<br>")
    n_lines = len(lines)
    max_chars = max((len(s) for s in lines), default=0)
    # 폭: 한 줄 최대 글자 수 기준 + 패딩
    w = base_w + max_chars * per_char_w + pad_x * 2
    w = max(min_w, min(max_w, w))
    # 높이: 줄 수 기준 + 패딩(상향)
    h = base_h + (n_lines - 1) * per_line_h + pad_y * 2
    return w, h

# -------- “심화/보강” 부모-자식 인식 (원래 코드와 동일) --------
_base_tag_re = re.compile(r"\[(.+?)\]")

def base_key(label_text: str) -> str:
    m = _base_tag_re.search(label_text or "")
    if not m:
        return ""
    raw = m.group(1).strip()
    tails = ("심화", "보강", "확장", "세부", "상세", "추가")
    parts = raw.split()
    if parts and any(t in parts for t in tails):
        parts = [p for p in parts if p not in tails]
    return " ".join(parts)

def is_deepen_label(label_text: str) -> bool:
    return any(t in (label_text or "") for t in ("심화", "보강", "확장", "세부", "상세", "추가"))

# ---------------- 자동 배치 (원래 코드와 동일) ----------------
def auto_positions_rect(nodes: dict, edges: list[tuple[str, str]]):
    node_ids = list(nodes.keys())

    out_edges = defaultdict(list)
    indeg = defaultdict(int)
    parents = defaultdict(list)
    for n in node_ids:
        indeg[n] += 0
    for u, v in edges:
        if u in nodes and v in nodes:
            out_edges[u].append(v)
            indeg[v] += 1
            parents[v].append(u)

    sources = [n for n in node_ids if indeg[n] == 0] or [node_ids[0]]

    # 위상 정렬로 레벨 결정
    level = {}
    q = deque()
    for s in sources:
        level[s] = 0
        q.append(s)

    while q:
        cur = q.popleft()
        for nxt in out_edges.get(cur, []):
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                plv = [level.get(p, 0) for p in parents[nxt]] or [level[cur]]
                level[nxt] = max(plv) + 1
                q.append(nxt)

    if len(level) < len(node_ids):
        max_assigned = max(level.values()) if level else 0
        for n in node_ids:
            if n not in level:
                max_assigned += 1
                level[n] = max_assigned

    label_html = {n: wrap_ko(nodes[n]) for n in node_ids}
    box_size = {n: rect_size(label_html[n]) for n in node_ids}

    layers = defaultdict(list)
    for n in node_ids:
        layers[level[n]].append(n)
    max_level = max(layers.keys()) if layers else 0

    # 레벨별 최대 높이
    per_level_h = {lv: max((box_size[n][1] for n in layers[lv]), default=0.6) for lv in layers}

    # 세로 위치 초기값(위에서 아래로)
    base_y_gap = SPACING["base_y_gap"] * SPACING["level_gap_scale"]
    y = sum(per_level_h.values()) / 2.0 + base_y_gap * max_level / 2.0

    pos = {}
    for lv in range(0, max_level + 1):
        grp = layers.get(lv, [])
        if not grp:
            continue

        widths = [box_size[n][0] for n in grp]
        if len(grp) == 1:
            xs = [0.0]
        else:
            total_width = sum(widths) + SPACING["base_x_gap"] * (len(grp) - 1)
            x_left = -total_width / 2.0
            xs, cursor = [], x_left
            for n, w in zip(grp, widths):
                cx = cursor + w / 2.0
                xs.append(cx)
                cursor += w + SPACING["base_x_gap"]
            xs = [x + SPACING["center_jitter_amp"] * math.sin(i) for i, x in enumerate(xs)]

        for i, n in enumerate(grp):
            pos[n] = (xs[i], y)

        if lv < max_level:
            # 인접 레벨 높이 + 넉넉한 베이스 간격
            y -= (per_level_h[lv] / 2.0 + per_level_h[lv+1] / 2.0 + base_y_gap)

    # “심화/보강 …” → 부모와 같은 x에 정렬
    base_key_map = {n: base_key(nodes[n]) for n in node_ids}
    for n in node_ids:
        if len(parents[n]) == 1 and is_deepen_label(nodes[n]):
            p = parents[n][0]
            if base_key_map.get(n) and base_key_map.get(n) == base_key_map.get(p):
                px, _ = pos[p]
                nx, ny = pos[n]
                pos[n] = (px, ny)

    return pos, label_html, box_size

# ---------------- 그리기 (내부 함수로 변경) ----------------
def _create_flow_figure(nodes: dict,
                        edges: list[tuple[str, str]],
                        width=1300, height=1000,
                        line_width=2.6):
    """
    Plotly Figure 객체를 생성하여 반환합니다. (내부용)
    """
    if not nodes:
        raise ValueError("nodes가 비어 있습니다.")

    pos, labels, box_size = auto_positions_rect(nodes, edges)

    fig = go.Figure()

    # 1) 엣지(line shape) — 아래 레이어
    for u, v in edges:
        if u in pos and v in pos:
            x0, y0 = pos[u]
            x1, y1 = pos[v]
            fig.add_shape(
                type="line",
                x0=x0, y0=y0, x1=x1, y1=y1,
                xref="x", yref="y",
                line=dict(color="#334155", width=line_width),
                layer="below"
            )

    # 2) 박스(rect shape) — 엣지보다 나중에 추가(=엣지 위)
    node_ids = list(nodes.keys())
    node_x = [pos[n][0] for n in node_ids]
    node_y = [pos[n][1] for n in node_ids]
    for n in node_ids:
        x, y = pos[n]
        w, h = box_size[n]
        fig.add_shape(
            type="rect",
            x0=x - w/2, x1=x + w/2,
            y0=y - h/2, y1=y + h/2,
            xref="x", yref="y",
            line=dict(color="#2b3a55", width=2.3),
            fillcolor="#e8f0fe",
            layer="below"
        )

    # 3) 텍스트(trace) — 항상 shape 위
    fig.add_trace(go.Scatter(
        x=node_x, y=node_y,
        mode="text",
        text=[labels[n] for n in node_ids],
        textposition="middle center",
        hoverinfo="text",
        textfont=dict(
            family="NanumGothic, 'Noto Sans KR', Malgun Gothic, Arial",
            size=FONT_SIZE,
            color="#0f172a"
        )
    ))

    # 보기 범위(여백도 조금 더)
    xs, ys = [], []
    for n in node_ids:
        x, y = pos[n]
        w, h = box_size[n]
        xs += [x - w/2, x + w/2]
        ys += [y - h/2, y + h/2]

    pad_x, pad_y = 1.0, 1.3
    fig.update_layout(
        width=width,
        height=height,
        showlegend=False,
        plot_bgcolor="white",
        margin=dict(l=30, r=30, t=30, b=30),
        xaxis=dict(visible=False, showgrid=False, zeroline=False,
                   range=[min(xs)-pad_x, max(xs)+pad_x]),
        yaxis=dict(visible=False, showgrid=False, zeroline=False,
                   range=[min(ys)-pad_y, max(ys)+pad_y]),
        font=dict(family="NanumGothic, 'Noto Sans KR', Arial")
    )

    # Figure 객체 반환
    return fig


# =================================================================
#           백엔드 서비스용 Public 함수
# =================================================================

def generate_flow_graph_image(nodes: dict, 
                              edges: list[tuple[str, str]], 
                              format="png", 
                              scale=1.5,
                              width=1300, 
                              height=1000) -> bytes:
    """
    플로우 그래프를 생성하여 이미지 바이트(bytes)로 반환합니다.
    - format: "png", "jpeg", "webp", "svg" 등
    - 백엔드에서 이미지 파일을 직접 반환할 때 유용합니다. (가장 추천)
    """
    fig = _create_flow_figure(nodes, edges, width=width, height=height)
    
    # pio.to_image()는 kaleido 엔진을 사용하여 이미지 바이트를 반환합니다.
    img_bytes = pio.to_image(fig, format=format, scale=scale)
    return img_bytes


def generate_flow_graph_json(nodes: dict, 
                             edges: list[tuple[str, str]], 
                             width=1300, 
                             height=1000) -> str:
    """
    플로우 그래프를 Plotly JSON 형식의 문자열로 반환합니다.
    - 프론트엔드에서 Plotly.js로 그래프를 렌더링할 때 사용합니다.
    """
    fig = _create_flow_figure(nodes, edges, width=width, height=height)
    
    # fig.to_json()은 JSON 문자열을 반환합니다.
    return fig.to_json()


def generate_flow_graph_html(nodes: dict, 
                             edges: list[tuple[str, str]], 
                             width=1300, 
                             height=1000) -> str:
    """
    플로우 그래프를 HTML 조각(div) 문자열로 반환합니다.
    - 웹페이지의 특정 부분에 <iframe>이나 <div>로 삽입할 때 사용합니다.
    """
    fig = _create_flow_figure(nodes, edges, width=width, height=height)
    
    # full_html=False는 <div> 태그 조각만 생성합니다.
    # include_plotlyjs=False는 Plotly.js 라이브러리를 포함하지 않습니다. (페이지에 이미 있다고 가정)
    html_div = pio.to_html(fig, 
                           full_html=False, 
                           include_plotlyjs=False,
                           config={'displayModeBar': False}) # 도구 모음 숨기기
    return html_div


# ---------------- 사용 예 (테스트용) ----------------
if __name__ == "__main__":
    test_nodes = {
        'A1': "[문제 제기]: 소셜 미디어의 양적 팽창이 관계의 질적 저하와 '연결된 고독'을 초래하는 역설을 제기한다.",
        'B1': "[핵심 주장]: 소셜 미디어의 피상적 소통 방식이 진정한 유대감 형성을 방해하고 정서적 투자를 회피하게 만든다고 주장한다.",
        'C1': "[근거 1]: 첫 번째 근거로 '편집된 현실'을 제시하며, 이것이 상대적 박탈감과 고립감을 유발한다고 설명한다.",
        'C2': "[근거 1 심화]: '편집된 현실' 속에서 사용자들이 타인의 인정을 얻기 위한 '페르소나'를 구축하는 데 에너지를 소모한다고 부연한다.",
        'D1': "[근거 2]: 두 번째 근거로 '필터 버블'과 '반향실 효과'를 만드는 알고리즘이 사회적 양극화와 공감 능력 저하를 초래한다고 지적한다.",
        'E1': "[반론 및 재반론]: 소셜 미디어의 긍정적 역할을 인정하면서도, 진짜 문제는 디지털 상호작용을 실제 유대감과 동일시하는 태도에 있다고 반박한다.",
        'F1': "[해결 방안]: 문제 해결을 위해 피상적 소통과 깊이 있는 교류의 차이를 인지하는 디지털 미디어 리터러시 교육의 필요성을 제안한다.",
        'G1': "[결론]: 진정한 과제는 관계의 깊이를 더하는 것이며, 디지털 너머의 실제 삶에서 공감하려는 의식적 노력이 필요하다고 강조하며 마무리한다."
    }
    test_edges = [
        ('A1', 'B1'),
        ('B1', 'C1'),
        ('C1', 'C2'),
        ('B1', 'D1'),
        ('B1', 'E1'),
        ('C2', 'F1'),
        ('D1', 'F1'),
        ('E1', 'F1'),
        ('F1', 'G1')
    ]

    print("그래프를 생성하여 'test_graph.png' 파일로 저장합니다...")
    
    # 1. 이미지 바이트 생성
    try:
        image_bytes = generate_flow_graph_image(test_nodes, test_edges)
        
        # 2. 바이트를 파일로 쓰기 (테스트)
        with open("test_graph.png", "wb") as f:
            f.write(image_bytes)
        
        print("[저장 완료] test_graph.png")

    except Exception as e:
        print(f"[오류] 그래프 생성 실패: {e}")
        print("Plotly와 'kaleido'가 올바르게 설치되었는지 확인하세요.")
        print("설치: pip install plotly kaleido")

    # JSON 또는 HTML 출력 테스트 (주석 해제)
    # json_data = generate_flow_graph_json(test_nodes, test_edges)
    # print("\n[JSON 출력]\n", json_data[:500] + "...")