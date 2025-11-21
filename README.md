**AITA**

AITA는 단순 표절 검사기를 넘어, 학생의 원고를 '구조적·논리적'으로 분석하고, 소크라테스식 질문과 심층 피드백으로 사용자의 사고를 발전시키는 능동형 학술 멘토링 시스템입니다.

**핵심 목표**
- **학생 사고 강화:** 단순 단락 요약이 아니라 논리 구조(핵심 논지, 근거, 논리 흐름)를 분석해 학생 스스로 통찰을 얻도록 유도합니다.
- **구조적 유사도 판별:** 임베딩 + LLM 기반의 다단계 비교로 '우연한 주제 중복'과 '구조적 복제'를 구분합니다.
- **대화형 보완:** 초기 질문(3개) → 답변 → 심화 질문(Deep-dive)으로 이어지는 상호작용을 제공합니다.

**How It Works (요약 파이프라인)**
- **1) Analysis & Embedding (빠른 단계)**: 제출 텍스트를 LLM(Naver HyperCLOVA X 사용 가능)에 JSON 출력 형식으로 분석(JSON_SYSTEM_PROMPT). 결과에서 핵심 개념/주장(Claim, Core_Thesis 등)을 추출하고, S-BERT(`paraphrase-multilingual-MiniLM-L12-v2`)로 핵심 텍스트 임베딩을 생성하여 DB에 저장.
- **2) Similarity Search & LLM Comparison (중간 단계)**: DB의 임베딩들과 코사인 유사도를 계산해 후보군을 추출한 뒤, 각 후보와 1:1 LLM 비교(COMPARISON_SYSTEM_PROMPT)를 수행해 항목별 점수(Reasoning, Flow 등)를 추출하고, 임계치 기반으로 'high similarity' 후보를 필터링.
- **3) QA Generation (질문 생성 단계)**: 분석·비교 결과를 바탕으로 `generate_initial_questions`가 9문항(critical / perspective / innovative) 풀을 생성하고 `_distribute_questions`로 초기 3문항을 사용자에 제공. 질문이 소진되면 백그라운드에서 `background_refill`로 자동 보충.
- **심층 분석(선택)**: 사용자가 요청하면 `perform_deep_analysis_async`로 심층 신경망/그래프 기반의 추가 분석(Neuron map, integrity issues 등)을 수행.

**주요 API (백엔드 블루프린트)**
- **블루프린트:** `/api/student`, `/api/auth`, `/api/ta` (각 기능별 라우트가 `backend/api/*.py`에 정의됨)
- **학생(예제 주요 엔드포인트)**:
	- `POST /api/student/analyze` : 파일 또는 텍스트 전송 → 리포트 생성 → 비동기 분석(202)
	- `GET  /api/student/report/<report_id>` : 리포트 상태 및 결과 조회
	- `POST /api/student/report/<report_id>/question/next` : 다음 질문(풀에서 하나 꺼내기)
	- `POST /api/student/report/<report_id>/answer` : 질문에 대한 학생 답변 저장
	- `POST /api/student/report/<report_id>/question/deep-dive` : parent_question_id로 심화 질문 생성 요청(백그라운드)
	- `POST /api/student/report/<report_id>/advancement` : 발전 아이디어 생성 요청(백그라운드)
	- `GET  /api/student/report/<report_id>/flow-graph` : 논리 흐름을 Plotly PNG로 반환
	- `POST /api/student/reports/<report_id>/deep-analysis` and `GET` : 심층 분석 시작/조회

**프롬프트(주요 템플릿) 및 역할**
- **`JSON_SYSTEM_PROMPT`**: 제출 텍스트를 고해상도 JSON 구조(핵심 논지, Flow_Pattern, Specific_Evidence 등)로 변환하도록 강제합니다. 출력은 반드시 유효한 JSON이어야 함.
- **`COMPARISON_SYSTEM_PROMPT`**: 제출본과 후보본의 JSON을 비교해 항목별(Thesis, Reasoning, Flow 등) 점수를 계산하는 엄격한 채점 기준을 제공합니다.
- **질문 생성 프롬프트들**: `question_making_prompt`, `deep_dive_prompt`, `BRIDGE_CONCEPT_BATCH_PROMPT` 등은 QA 서비스에서 각각 초기 질문, 심화 질문, 브리지 질문 등 다양한 질문 유형을 JSON으로 생성하도록 설계되어 있습니다.

**데이터 흐름 & 동시성 원칙**
- 리포트는 DB(Flask SQLAlchemy)의 단일 레코드로 생성 후, **백그라운드 스레드**로 1단계→2단계→3단계 파이프라인을 진행합니다.
- 긴 작업(LLM 호출, 심층분석)은 별도 스레드에서 실행하고, DB 업데이트는 앱 컨텍스트 내에서 안전하게 커밋합니다. refill/심화 질문 등은 상태 잠금(`is_refilling` 등)을 사용해 중복 생성을 방지합니다.

**프론트엔드(요약)**
- 위치: `my-frontend/` (Vite + React)
- 주요 라이브러리: React 19, Vite, MUI(Material UI), `reactflow` (논리 흐름 시각화), `react-plotly.js` / `plotly.js` (그래프), `dagre` / `d3-force` (레이아웃), `axios` (API 호출)
- 핵심 컴포넌트: `AnalysisForm.jsx` (제출 UI), `ReportDisplay.jsx`, `QAChat.jsx`, `LogicFlowDiagram.jsx`, `SimilarityAnalysis.jsx` 등 — 백엔드 API와 연동해 리포트 생성/폴링, 질문/답변 흐름, 시각화 제공.

**기술 스택 (상세)**
- Backend: `Python`, `Flask`, `Flask-JWT-Extended`, `Flask-Mail`, `Flask-Migrate`, `SQLAlchemy`
- LLM: Naver HyperCLOVA X (환경에 따라) — LLM 호출은 `requests` 기반으로 수행. 프롬프트는 JSON 출력을 강제함.
- Embedding: `sentence-transformers` (S-BERT: `paraphrase-multilingual-MiniLM-L12-v2`)
- ML/유틸: `numpy`, `scikit-learn`(cosine_similarity), `tenacity`(retry), `plotly`(그래프 이미지)
- Concurrency: Python `threading`, `concurrent.futures` (비동기 비교 등)
- Frontend: `React` (Vite), `@mui/material`, `reactflow`, `plotly.js`, `axios`

**환경 변수(중요)**
- `NAVER_CLOVA_URL`, `NAVER_API_KEY` : LLM 호출용 (필수: LLM 기능 사용 시)
- `SQLALCHEMY_DATABASE_URI` 또는 `DATABASE_URL` : DB 연결
- `SECRET_KEY`, `JWT_SECRET_KEY` : Flask / JWT
- `MAIL_USERNAME`, `MAIL_PASSWORD` : 이메일 발송

**로컬 실행(간단 안내)**
- Backend (Python 가상환경 권장):
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# 환경변수 설정(.env 또는 export)
python app.py
```
- Frontend:
```bash
cd my-frontend
npm install
npm run dev
```

**개발/운영상 고려사항 & 다음 단계 제안**
- LLM 응답 파싱이 실패할 수 있어 여러 단계(JSON/ast 정제)를 추가해 방어적으로 처리했습니다. 운영 시에는 LLM 응답 안정화를 위해 프롬프트 튜닝과 예외 로깅 강화가 필요합니다.
- 대규모 DB에서 임베딩 유사도 검색 성능 향상을 위해 FAISS 또는 Milvus 같은 벡터 DB 도입을 권장합니다.
- CORS, JWT, 권한(학생/TA/관리자) 관련 보안 검토 및 rate-limiting/로깅을 강화하세요.

**응답 예시 (사용자 경험 관점)**
아래 예시는 서비스를 처음 사용하는 학생 또는 프론트엔드 개발자가 API와 상호작용할 때 참고할 수 있는 간단한 요청/응답 예시입니다.

- 1) 제출(분석) 요청 (텍스트 기반)
```bash
curl -X POST "http://localhost:5000/api/student/analyze" \
	-H "Authorization: Bearer <JWT>" \
	-F "text=여기에 분석할 텍스트를 입력합니다..." \
	-F "docType=report" \
	-F "is_test=true"
```
응답(202 Accepted):
```json
{ "reportId": "123e4567-e89b-12d3-a456-426614174000" }
```

- 2) 리포트 조회 (폴링)
```bash
curl -H "Authorization: Bearer <JWT>" \
	http://localhost:5000/api/student/report/123e4567-e89b-12d3-a456-426614174000
```
예시 응답(완료된 경우):
```json
{
	"status": "completed",
	"data": {
		"report_title": null,
		"summary": { "Core_Thesis": "...","Claim": "...","Flow_Pattern": {...} },
		"initialQuestions": [ {"question_id":"q1","question":"...","type":"critical"} ],
		"questions_pool_count": 6,
		"similarity_details": [ /* LLM 비교 문자열 목록 */ ],
		"text_snippet": "원문 앞부분..."
	}
}
```

- 3) 다음 질문 가져오기
```bash
curl -X POST -H "Authorization: Bearer <JWT>" \
	http://localhost:5000/api/student/report/123/report/123e4567-e89b-12d3-a456-426614174000/question/next
```
응답(200):
```json
{ "question_id": "uuid-q-1", "question": "당신의 주장에 대한 반례는 무엇인가요?", "type": "critical" }
```

- 4) 답변 제출
```bash
curl -X POST "http://localhost:5000/api/student/report/123/answer" \
	-H "Authorization: Bearer <JWT>" \
	-H "Content-Type: application/json" \
	-d '{"question_id":"uuid-q-1","user_answer":"제 답변 내용입니다."}'
```
응답(200):
```json
{ "status": "success", "message": "Answer saved successfully" }
```

- 5) 심화 질문 요청
```bash
curl -X POST "http://localhost:5000/api/student/report/123/question/deep-dive" \
	-H "Authorization: Bearer <JWT>" \
	-H "Content-Type: application/json" \
	-d '{"parent_question_id":"uuid-q-1"}'
```
응답(202):
```json
{ "message": "Deep-dive question generation started. Please poll the report status." }
```

- 6) 논리 흐름 그래프(이미지) 가져오기
```bash
curl -H "Authorization: Bearer <JWT>" \
	http://localhost:5000/api/student/report/123/flow-graph --output flow.png
```

위 예시는 프론트엔드의 `AnalysisForm.jsx`, `QAChat.jsx`와 연동되어 사용자의 대화/폴링 UX를 구성하도록 설계되어 있습니다.

**TA 및 관리자용 기능 및 유용성**
아래는 TA/관리자 역할에서 이 서비스를 통해 할 수 있는 작업 목록과, 각 기능이 왜 TA에게 도움이 되는지 요약한 내용입니다.

- **리포트 일괄/개별 조회 (`GET /api/ta/reports`, `GET /api/ta/report/<id>`)**
	- 무엇을 하는가: 수업 내 제출물 전체 개요, 개별 리포트의 요약·유사도·QA 히스토리 조회.
	- TA에게 유용한 이유: 문제 있는 제출물을 빠르게 식별(우선순위화)하고, 학생의 논리적 약점과 기존 유사 문헌 근거를 한눈에 볼 수 있어 심사 효율을 크게 개선합니다.

- **일괄 분석 및 자동채점 트리거 (`POST /api/ta/analyze-batch`, `/auto-grade`)**
	- 무엇을 하는가: 다수 리포트를 백그라운드에서 재분석하거나 자동 채점 실행.
	- TA에게 유용한 이유: 대규모 과제의 1차 판별(빠른 불량 판단, 표절 의심 티켓 생성)을 자동화하여 수작업 부담을 줄입니다.

- **TA 채점 및 피드백 저장 (`POST /api/ta/reports/<id>/grade`)**
	- 무엇을 하는가: TA가 수동으로 점수와 피드백을 입력하고 저장.
	- TA에게 유용한 이유: LLM·임베딩 기반의 자동 추천(초기 평점, 문제 포인트)을 바탕으로 구체적 코멘트를 빠르게 작성할 수 있어 채점 시간이 단축됩니다.

- **과목/과제 관리 (`/api/ta/courses`, `/assignments`)**
	- 무엇을 하는가: 강의 및 과제 생성·수정·조회·삭제.
	- TA에게 유용한 이유: LMS와의 일부 역할을 대체해 제출물 흐름과 평가 기준을 시스템에서 직접 관리할 수 있습니다.

- **제출물 목록·학생 명단 조회 (`/courses/<id>/students`, `/assignments/<id>/submissions`)**
	- 무엇을 하는가: 수강생 리스트, 제출물 상태(분석 완료/대기/에러) 확인.
	- TA에게 유용한 이유: 리뷰 우선순위 설정(예: 높은 유사도 리포트 우선), 결석·미제출 관리 등에 빠르게 대응할 수 있습니다.

- **평가 기준 관리 및 통계 (`/assignments/<id>/criteria`, `/assignments/<id>/stats`)**
	- 무엇을 하는가: 채점 루브릭 설정 및 과제 통계(평균, 분포) 조회.
	- TA에게 유용한 이유: 일관된 채점 기준 적용과 성적 왜곡 포인트 식별(예: 특정 문항에서 낮은 점수 집중)을 통해 공정성을 확보할 수 있습니다.

- **증거 기반 리뷰(LLM 비교 리포트 포함)**
	- 무엇을 하는가: 유사 문서와의 정밀 비교 결과(문항별 점수, 비교 코멘트)를 확인.
	- TA에게 유용한 이유: 표절 여부 판단 시 사람이 바로 확인 가능한 근거(비교 리포트)를 제공하므로, 판단의 신뢰성과 설명 가능성이 높아집니다.

- **감사/이력(아카이브) 및 이메일 알림**
	- 무엇을 하는가: TA의 채점 기록, 학생 알림(메일) 발송 등 운영 로그와 통지 기능.
	- TA에게 유용한 이유: 학사 운영·증빙 목적의 기록 관리가 가능하고, 학생에게 자동 알림을 보내 후속 조치를 단축합니다.

요약: AITA는 TA의 '판단'과 '피드백' 과정을 보조하도록 설계되었습니다. 자동 분석과 유사도·논리 진단으로 TA는 더 적은 시간으로 더 많은 제출물을 검토하고, 보다 근거 있는 피드백을 제공할 수 있습니다.
