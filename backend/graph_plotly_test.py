# pip install plotly
import plotly.graph_objects as go
import plotly.io as pio
import textwrap
from collections import defaultdict, deque
import math
import re

# ====== 박스/폰트/간격 설정 ======
BOX_STYLE = {
    "base_w": 1.35,
    "base_h": 3.0,
    "per_line_h": 2.5,
    "per_char_w": 0.032,
    "min_w": 1.20,
    "max_w": 3.10,
    "pad_x": 0.14,
    "pad_y": 0.25
}

FONT_SIZE = 16
WRAP_WIDTH = 15

SPACING = {
    "base_x_gap": 0.70,
    "base_y_gap": 2.0,
    "level_gap_scale": 2.0,
    "center_jitter_amp": 0.06
}

# ------------------ HTML/텍스트 유틸 ------------------

def bold_category(text: str) -> str:
    return re.sub(r"\[(.+?)\]", r"<b>[\1]</b>", text or "")


def strip_html_tags(s: str) -> str:
    return re.sub(r"<.*?>", "", s or "")


def wrap_ko(text: str, width=WRAP_WIDTH) -> str:
    if not text:
        return ""

    text = bold_category(text.replace("·", "•"))
    parts = text.split("\n")

    wrapped_lines = []
    for part in parts:
        part = part.strip()
        if not part:
            wrapped_lines.append("")
            continue

        if part.startswith("<b>["):
            wrapped_lines.append(part)
            continue

        clean = strip_html_tags(part)
        if len(clean) <= width:
            wrapped_lines.append(part)
        else:
            for seg in textwrap.wrap(clean, width=width):
                wrapped_lines.append(seg)

    return "<br>".join(wrapped_lines)


def rect_size(label_html: str,
              base_w=BOX_STYLE["base_w"], base_h=BOX_STYLE["base_h"],
              per_line_h=BOX_STYLE["per_line_h"], per_char_w=BOX_STYLE["per_char_w"],
              max_w=BOX_STYLE["max_w"], min_w=BOX_STYLE["min_w"],
              pad_x=BOX_STYLE["pad_x"], pad_y=BOX_STYLE["pad_y"]):

    lines = (label_html or "").split("<br>")
    n_lines = len(lines)
    max_chars = max((len(strip_html_tags(s)) for s in lines), default=0)

    w = base_w + max_chars * per_char_w + pad_x * 2
    w = max(min_w, min(max_w, w))
    h = base_h + (n_lines - 1) * per_line_h + pad_y * 2
    return w, h

# ================================
#     카테고리 색상 판별
# ================================

_core_claim_re = re.compile(r"\[(핵심 ?주장|주장)\]")
_evidence_re   = re.compile(r"\[(.*근거.*)\]")
_counter_re    = re.compile(r"\[(.*반론.*)\]")

def get_node_color(text: str) -> str:
    """
    1) 핵심 주장 → 진한 연두색
    2) 근거, 반론 → 더 연한 연두색
    3) 기타 → 연한 파랑
    """
    if _core_claim_re.search(text):
        return "#dcfce7"     # 진한 연두색

    if _evidence_re.search(text) or _counter_re.search(text):
        return  "#f0f9ff"

    return "#dbeafe"       # 기본 색

# ================================
#     자동 배치
# ================================

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


def auto_positions_rect(nodes: dict, edges):
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
    box_size   = {n: rect_size(label_html[n]) for n in node_ids}

    layers = defaultdict(list)
    for n in node_ids:
        layers[level[n]].append(n)

    max_level = max(layers.keys()) if layers else 0
    per_level_h = {lv: max((box_size[n][1] for n in layers[lv]), default=0.6)
                   for lv in layers}

    base_y_gap = SPACING["base_y_gap"] * SPACING["level_gap_scale"]
    y = sum(per_level_h.values()) / 2.0 + base_y_gap * max_level / 2.0

    pos = {}
    for lv in range(max_level + 1):
        grp = layers.get(lv, [])
        if not grp:
            continue

        widths = [box_size[n][0] for n in grp]

        if len(grp) == 1:
            xs = [0.0]
        else:
            total_width = sum(widths) + SPACING["base_x_gap"] * (len(grp) - 1)
            left = -total_width / 2.0
            xs = []
            cursor = left
            for w in widths:
                xs.append(cursor + w/2)
                cursor += w + SPACING["base_x_gap"]
            xs = [x + SPACING["center_jitter_amp"] * math.sin(i)
                  for i, x in enumerate(xs)]

        for i, n in enumerate(grp):
            pos[n] = (xs[i], y)

        if lv < max_level:
            y -= (per_level_h[lv]/2 + per_level_h[lv+1]/2 + base_y_gap)

    base_key_map = {n: base_key(nodes[n]) for n in node_ids}
    for n in node_ids:
        if len(parents[n]) == 1 and is_deepen_label(nodes[n]):
            p = parents[n][0]
            if base_key_map[n] == base_key_map[p] and base_key_map[n]:
                px, _ = pos[p]
                nx, ny = pos[n]
                pos[n] = (px, ny)

    return pos, label_html, box_size

# ================================
#     그리기
# ================================

def draw_flow_rect_auto(nodes, edges,
                        width=1300, height=1000, scale=1.5,
                        line_width=2.6, out_png=None):

    pos, labels, box_size = auto_positions_rect(nodes, edges)
    fig = go.Figure()

    # 1) 실선(직선) 엣지
    for u, v in edges:
        if u in pos and v in pos:
            x0, y0 = pos[u]
            x1, y1 = pos[v]
            h0 = box_size[u][1]
            h1 = box_size[v][1]

            start_x, start_y = x0, y0
            end_x, end_y     = x1, y1

            if y1 < y0:
                start_y = y0 - h0/2
                end_y   = y1 + h1/2
            elif y1 > y0:
                start_y = y0 + h0/2
                end_y   = y1 - h1/2
            else:
                w0 = box_size[u][0]
                w1 = box_size[v][0]
                if x1 > x0:
                    start_x = x0 + w0/2
                    end_x   = x1 - w1/2
                else:
                    start_x = x0 - w0/2
                    end_x   = x1 + w1/2

            fig.add_shape(
                type="line",
                x0=start_x, y0=start_y,
                x1=end_x, y1=end_y,
                xref="x", yref="y",
                line=dict(color="#334155", width=line_width),
                layer="below"
            )

    # 2) 박스: 카테고리별 색상 적용
    node_ids = list(nodes.keys())
    node_x   = [pos[n][0] for n in node_ids]
    node_y   = [pos[n][1] for n in node_ids]

    for n in node_ids:
        x, y = pos[n]
        w, h = box_size[n]

        fillcolor = get_node_color(nodes[n])  # 여기서 색 결정

        fig.add_shape(
            type="rect",
            x0=x - w/2, x1=x + w/2,
            y0=y - h/2, y1=y + h/2,
            xref="x", yref="y",
            line=dict(color="#2b3a55", width=2.3),
            fillcolor=fillcolor,
            layer="below"
        )

    # 3) 텍스트
    fig.add_trace(go.Scatter(
        x=node_x, y=node_y,
        mode="text",
        text=[labels[n] for n in node_ids],
        textposition="middle center",
        hoverinfo="text",
        textfont=dict(family="NanumGothic,'Noto Sans KR',Arial",
                      size=FONT_SIZE, color="#0f172a")
    ))

    # 4) 레이아웃
    xs, ys = [], []
    for n in node_ids:
        x, y = pos[n]
        w, h = box_size[n]
        xs += [x-w/2, x+w/2]
        ys += [y-h/2, y+h/2]

    pad_x, pad_y = 1.0, 1.3

    fig.update_layout(
        width=width, height=height,
        showlegend=False,
        plot_bgcolor="white",
        margin=dict(l=30, r=30, t=30, b=30),
        xaxis=dict(visible=False, showgrid=False, zeroline=False,
                   range=[min(xs)-pad_x, max(xs)+pad_x]),
        yaxis=dict(visible=False, showgrid=False, zeroline=False,
                   range=[min(ys)-pad_y, max(ys)+pad_y]),
        font=dict(family="NanumGothic,'Noto Sans KR',Arial")
    )

    if out_png:
        pio.write_image(fig, out_png, format="png", scale=scale)
        print(f"[저장 완료] {out_png}")
    else:
        fig.show()

# ---------------- 사용 예 ----------------
if __name__ == "__main__":
    nodes = {
        "A1": "[문제 제기]\nAI 시대 도래와 AI의 한계 및 인간 역량의 중요성 부각",
        "A2": "[핵심 주장]\n인문학 교육의 재정립 및 강화 필요성",
        "B1": "[근거1]\nAI 기술 활용의 복잡한 윤리적 딜레마 발생",
        "B2": "[근거1 상세 설명]\n인문학이 윤리적 판단 및 인간 가치 중심 기술 설계에 기여",
        "C1": "[근거2]\nAI의 창의성, 공감 능력의 근본적 부족 및 반복 업무 대체",
        "C2": "[근거2 상세 설명]\n인문학이 독창적 아이디어와 통찰력으로 AI 한계 극복에 기여",
        "D1": "[해결 방안 제안]\n인문학과 기술의 융합 교육 필요성",
        "D2": "[결론 강조]\n인문학 교육 재정립이 인간 중심 미래를 위한 능동적 투자임을 강조"
      }

    edges = [
        [
          "A1",
          "A2"
        ],
        [
          "A2",
          "B1"
        ],
        [
          "B1",
          "B2"
        ],
        [
          "A2",
          "C1"
        ],
        [
          "C1",
          "C2"
        ],
        [
          "B2",
          "D1"
        ],
        [
          "C2",
          "D1"
        ],
        [
          "D1",
          "D2"
        ]
      ]

    draw_flow_rect_auto(nodes, edges)