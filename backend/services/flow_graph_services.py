import re
import textwrap
from collections import deque, defaultdict
from flask import Flask, jsonify, request # 또는 FastAPI
import math
import plotly.graph_objects as go
import plotly.io as pio

# ----------------------------------------------------
# --- 4. [신규] 논리 흐름 시각화 (Plotly) 서비스 ---
# ----------------------------------------------------
# (제공된 스크립트의 함수들을 API가 호출할 수 있도록 내부 헬퍼 함수로 추가)

# ====== 박스/폰트/간격 설정 ======
_BOX_STYLE = {
    "base_w": 1.35,
    "base_h": 3.0,
    "per_line_h": 2.5,
    "per_char_w": 0.032,
    "min_w": 1.20,
    "max_w": 3.10,
    "pad_x": 0.14,
    "pad_y": 0.25
}

_FONT_SIZE = 16
_WRAP_WIDTH = 15

_SPACING = {
    "base_x_gap": 0.70,
    "base_y_gap": 2.0,
    "level_gap_scale": 2.0,
    "center_jitter_amp": 0.06
}
font_family = "NanumGothic, 'Nanum Gothic', sans-serif"

# ------------------ HTML/텍스트 유틸 ------------------

def _bold_category(text: str) -> str:
    return re.sub(r"\[(.+?)\]", r"<b>[\1]</b>", text or "")


def _strip_html_tags(s: str) -> str:
    return re.sub(r"<.*?>", "", s or "")


def _wrap_ko(text: str, width=_WRAP_WIDTH) -> str:
    if not text:
        return ""

    text = _bold_category(text.replace("·", "•"))
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

        clean = _strip_html_tags(part)
        if len(clean) <= width:
            wrapped_lines.append(part)
        else:
            # 원본 textwrap.wrap은 HTML 태그를 고려하지 않으므로,
            # 여기서는 textwrap의 기본 동작을 모방합니다. (참고: 이 로직은 HTML 태그가 깨질 수 있음)
            # 좀 더 견고한 래핑이 필요하면 복잡한 파싱이 필요하지만,
            # 제공된 코드의 textwrap.wrap(clean, ...) 로직을 따릅니다.
            wrapped_segments = textwrap.wrap(clean, width=width)
            
            # 원본 로직은 textwrap.wrap(clean, ...)을 사용했으므로,
            # HTML 태그가 있는 원본 'part' 대신 'clean' 텍스트를 래핑합니다.
            # 만약 원본 'part'의 HTML을 보존하며 래핑하려면
            # 'clean'의 래핑 지점을 'part'에 매핑하는 복잡한 로직이 필요합니다.
            # 여기서는 제공된 코드의 로직(clean 텍스트 래핑)을 그대로 따릅니다.
            for seg in wrapped_segments:
                wrapped_lines.append(seg)

    return "<br>".join(wrapped_lines)


def _rect_size(label_html: str,
              base_w=_BOX_STYLE["base_w"], base_h=_BOX_STYLE["base_h"],
              per_line_h=_BOX_STYLE["per_line_h"], per_char_w=_BOX_STYLE["per_char_w"],
              max_w=_BOX_STYLE["max_w"], min_w=_BOX_STYLE["min_w"],
              pad_x=_BOX_STYLE["pad_x"], pad_y=_BOX_STYLE["pad_y"]):

    lines = (label_html or "").split("<br>")
    n_lines = len(lines)
    max_chars = max((len(_strip_html_tags(s)) for s in lines), default=0)

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

def _get_node_color(text: str) -> str:
    """
    1) 핵심 주장 → 진한 연두색
    2) 근거, 반론 → 더 연한 연두색
    3) 기타 → 연한 파랑
    """
    if _core_claim_re.search(text or ""):
        return "#dcfce7"     # 진한 연두색

    if _evidence_re.search(text or "") or _counter_re.search(text or ""):
        return  "#f0f9ff"

    return "#dbeafe"       # 기본 색

# ================================
#     자동 배치
# ================================

_base_tag_re = re.compile(r"\[(.+?)\]")

def _base_key(label_text: str) -> str:
    m = _base_tag_re.search(label_text or "")
    if not m:
        return ""
    raw = m.group(1).strip()
    tails = ("심화", "보강", "확장", "세부", "상세", "추가")
    parts = raw.split()
    if parts and any(t in parts for t in tails):
        parts = [p for p in parts if p not in tails]
    return " ".join(parts)

def _is_deepen_label(label_text: str) -> bool:
    return any(t in (label_text or "") for t in ("심화", "보강", "확장", "세부", "상세", "추가"))


def _auto_positions_rect(nodes: dict, edges):
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

    sources = [n for n in node_ids if indeg[n] == 0]
    if not sources:
      # 순환 그래프 또는 빈 그래프 엣지 케이스 처리
      if not node_ids:
          return {}, {}, {} # 노드가 없으면 빈 dict 반환
      sources = [node_ids[0]] # fallback

    level = {}
    q = deque()

    for s in sources:
        level[s] = 0
        q.append(s)

    visited_in_bfs = set(sources) # 순환 감지용

    while q:
        cur = q.popleft()
        for nxt in out_edges.get(cur, []):
            # indeg가 0이 된 노드만 큐에 추가 (BFS 레벨링)
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                plv = [level.get(p, 0) for p in parents[nxt]] or [level[cur]]
                level[nxt] = max(plv) + 1
                q.append(nxt)
                visited_in_bfs.add(nxt)

    if len(level) < len(node_ids):
        max_assigned = max(level.values()) if level else 0
        # 순환 등으로 인해 레벨이 할당되지 않은 노드 처리
        for n in node_ids:
            if n not in level:
                # 부모 노드가 있다면 부모 레벨 + 1 시도
                parent_levels = [level[p] for p in parents.get(n, []) if p in level]
                if parent_levels:
                    level[n] = max(parent_levels) + 1
                else:
                    max_assigned += 1
                    level[n] = max_assigned


    label_html = {n: _wrap_ko(nodes[n]) for n in node_ids}
    box_size   = {n: _rect_size(label_html[n]) for n in node_ids}

    layers = defaultdict(list)
    for n in node_ids:
        layers[level[n]].append(n)

    max_level = max(layers.keys()) if layers else 0
    per_level_h = {lv: max((box_size[n][1] for n in layers[lv]), default=0.6)
                   for lv in layers}

    base_y_gap = _SPACING["base_y_gap"] * _SPACING["level_gap_scale"]
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
            total_width = sum(widths) + _SPACING["base_x_gap"] * (len(grp) - 1)
            left = -total_width / 2.0
            xs = []
            cursor = left
            for w in widths:
                xs.append(cursor + w/2)
                cursor += w + _SPACING["base_x_gap"]
            xs = [x + _SPACING["center_jitter_amp"] * math.sin(i)
                  for i, x in enumerate(xs)]

        for i, n in enumerate(grp):
            pos[n] = (xs[i], y)

        if lv < max_level:
            next_h = per_level_h.get(lv+1, 0.6)
            y -= (per_level_h[lv]/2 + next_h/2 + base_y_gap)

    base_key_map = {n: _base_key(nodes[n]) for n in node_ids}
    for n in node_ids:
        if len(parents[n]) == 1 and _is_deepen_label(nodes[n]):
            p = parents[n][0]
            # p가 pos에 있는지 확인 (순환 그래프 등 예외 처리)
            if p in pos and base_key_map[n] == base_key_map[p] and base_key_map[n]:
                px, _ = pos[p]
                nx, ny = pos[n]
                pos[n] = (px, ny)

    return pos, label_html, box_size

# ================================
#     그리기 (API용)
# ================================

def _create_flow_graph_figure(nodes, edges,
                         width=1300, height=1000,
                         line_width=2.6):
    """
    [신규] Plotly Figure 객체를 생성합니다. (기존 draw_flow_rect_auto 수정)
    show()나 write_image() 대신 fig 객체를 반환합니다.
    """

    pos, labels, box_size = _auto_positions_rect(nodes, edges)
    fig = go.Figure()

    # pos가 비어있는 경우 (노드가 없는 경우)
    if not pos:
        fig.update_layout(
            width=width, height=height,
            showlegend=False,
            plot_bgcolor="white",
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            annotations=[dict(
                text="그래프 데이터를 생성할 수 없습니다.",
                xref="paper", yref="paper",
                x=0.5, y=0.5, showarrow=False,
                font=dict(size=16)
            )]
        )
        return fig

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

        fillcolor = _get_node_color(nodes[n])  # 여기서 색 결정

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
        textfont=dict(family=font_family, size=_FONT_SIZE, color="#0f172a")
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
        font=dict(family=font_family)
    )

    # API로 전송하기 위해 fig 객체 반환
    return fig
