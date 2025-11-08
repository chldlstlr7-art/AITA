AITA
AITA는 단순한 표절 검사기를 넘어, 사용자가 자신의 아이디어를 더 깊고, 날카롭고, 독창적으로 발전시킬 수 있도록 돕는 능동적 사고 보조 시스템입니다.

단순히 "AI가 써주는" 수동적인 경험이 아닌, AI 멘토와의 소크라테스식 문답(QA)을 통해 사용자가 "스스로" 통찰을 얻도록 유도하는 것을 목표로 합니다.

📌 핵심 기능
3단계 심층 분석 (Analysis Service)

LLM 요약: 제출된 텍스트의 핵심 논지와 근거를 추출합니다.

S-BERT 유사도 검색: 로컬 DB의 수천 개 문서와 비교하여 S-BERT 벡터 기반의 1차 후보군을 선별합니다.

LLM 정밀 비교: 1차 후보군을 LLM이 1:1로 정밀 비교하여 'High'/'Very High' 수준의 표절 의심 문서를 필터링합니다.

2단계 비동기 QA (QA Service)

비동기 파이프라인: 사용자가 1단계 분석 결과를 보는 동안, 백그라운드에서 2단계 QA 질문 생성을 완료하여 대기 시간을 최소화합니다.

능동적 사고 유도: 분석 결과('High' 유사도 문서 포함)를 기반으로, 사용자의 논리적 허점이나 확장 가능한 지점을 파고드는 3가지 유형(비판적, 관점 전환, 혁신)의 질문을 생성합니다.

스마트 리필: 사용자가 질문을 소비하면, 질문 풀이 바닥나기 전에 백그라운드 스레드가 '상태 잠금(Lock)' 하에 지능적으로 새 질문을 리필합니다.

🛠️ 기술 스택 (Backend)
Server: Flask

Hosting: GitHub Codespace (w/ .devcontainer)

LLM: Google Gemini (Generative AI)

Embedding: S-BERT (Sentence Transformers)

데이터 관리: Pandas, Numpy

비동기 처리: Python threading