import graphviz
import textwrap

# 주어진 데이터
SAMPLE_FLOW_PATTERN = {
    "edges": [
        ["A1", "A2"],
        ["A2", "A3"],
        ["A3", "B1"],
        ["B1", "B2"],
        ["B2", "B3"],
        ["B3", "A3"], # 순환 엣지 1
        ["A3", "C1"],
        ["C1", "C2"],
        ["C2", "C3"],
        ["C3", "A3"], # 순환 엣지 2
        ["A3", "D1"],
        ["D1", "D2"],
        ["D2", "D3"]
    ],
    "nodes": {
        "A1": "[문제 제기]\\nAI 기술 발전으로 사회 전반의 구조가 변화하고 있습니다.",
        "A2": "[대조]\\nAI는 효율성 뛰어나나 인간의 윤리, 창의, 공감 능력은 고유한 영역입니다.",
        "A3": "[핵심 주장]\\nAI 시대에 인간 고유 역량을 길러주는 인문학 교육의 재정립 및 강화가 필요합니다.",
        "B1": "[근거1]\\nAI의 사회 통합 심화로 윤리적 딜레마가 복잡해지고 있습니다.",
        "B2": "[근거1 세부 설명]\\n기술만으로는 윤리 문제의 해답을 찾을 수 없습니다.",
        "B3": "[근거1 결론]\\n인문학은 비판적 사고와 도덕적 근거를 제공하여 인간 가치 중심 기술 설계를 돕습니다.",
        "C1": "[근거2]\\nAI는 새로운 질문 제시 및 심층적 감정 공감 능력에 근본적 한계가 있습니다.",
        "C2": "[근거2 세부 설명]\\nAI 시대에는 독창적 아이디어와 깊은 통찰력을 요구하는 직업이 중요해질 것입니다.",
        "C3": "[근거2 결론]\\n인문학은 인간의 내면 탐구, 문화 이해, 새로운 관점 창출 능력을 키워 AI가 해결 못 하는 문제에 대한 원동력이 됩니다.",
        "D1": "[해결 방안 제안]\\n인문학 교육은 기술 분야와 융합되어야 합니다.",
        "D2": "[해결 방안 구체화]\\n지식 암기식 교육에서 벗어나 실제 문제 해결 중심의 융합 교육이 필요합니다.",
        "D3": "[결론 강조]\\n인문학 교육은 인간 중심의 지속 가능한 미래 설계를 위한 능동적 투자입니다."
    }
}

# 1. Graphviz Digraph 객체 생성 (방향성 그래프)
dot = graphviz.Digraph(comment='AI 시대의 인문학 교육 플로우 차트', graph_attr={'rankdir': 'TB', 'splines': 'ortho'})

# 2. 노드 스타일 설정 및 추가
# 노드의 텍스트 길이에 따라 자동으로 줄바꿈 처리
def format_label(text, width=30):
    return '\\n'.join(textwrap.wrap(text, width=width))

for node_id, label_text in SAMPLE_FLOW_PATTERN['nodes'].items():
    formatted_label = format_label(label_text, width=35) # 줄바꿈 폭 설정
    
    # 노드 스타일에 따른 모양 설정 (선택적)
    if node_id.startswith('A'): # 주요 주장, 문제 제기
        shape = 'box'
        fillcolor = '#C9E2F7' # 연한 파랑
    elif node_id.startswith('B') or node_id.startswith('C'): # 근거 그룹
        shape = 'ellipse'
        fillcolor = '#E9F7C9' # 연한 녹색
    elif node_id.startswith('D'): # 해결 방안, 결론
        shape = 'rect'
        fillcolor = '#F7D6C9' # 연한 주황
    else:
        shape = 'box'
        fillcolor = 'white'
        
    dot.node(
        node_id, 
        label=formatted_label, 
        shape=shape, 
        style='filled', 
        fillcolor=fillcolor,
        fontname='NanumGothic' # 한글 폰트 설정 (환경에 따라 다를 수 있음)
    )

# 3. 엣지 추가
for source, destination in SAMPLE_FLOW_PATTERN['edges']:
    dot.edge(source, destination)

# 4. 파일 렌더링 (view=False로 설정하여 'xdg-open' 오류 회피)
# 파일은 'flow_chart_example.png'와 'flow_chart_example' (dot 파일)로 생성됩니다.
dot.render('flow_chart_example', view=False, format='png', cleanup=True)

print("[SUCCESS] 'flow_chart_example.png' 파일이 성공적으로 생성되었습니다.")
print("Codespaces 파일 탐색기에서 파일을 확인해 주세요.")