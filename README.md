# AITA

/AITA_Project (GitHub Repo Root)
├── .github/
│   └── workflows/
│       └── vercel_deploy.yml   # 프론트엔드 Vercel 자동 배포 CI/CD
│
├── frontend/                   # Next.js (Vercel) 프로젝트
│   ├── app/
│   │   ├── (auth)/             # 인증 관련 페이지 (로그인)
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (main)/             # 메인 어플리케이션 (로그인 후)
│   │   │   ├── dashboard/      # 리포트 업로드 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── report/
│   │   │   │   └── [reportId]/   # 개별 리포트 분석 결과 페이지 (동적 라우트)
│   │   │   │       ├── page.tsx
│   │   │   │       └── components/
│   │   │   │           ├── 1_SummaryDisplay.tsx     # (요약/구조화)
│   │   │   │           ├── 2_EvaluationMetrics.tsx  # (종합 평가)
│   │   │   │           ├── 3_LogicFlowGraph.tsx     # (논리 흐름도)
│   │   │   │           ├── 4_SimilarityDetails.tsx  # (유사 의심 내역)
│   │   │   │           ├── 5_ThinkingPrompt.tsx     # (사고 자극 질문)
│   │   │   │           └── 6_Advancement.tsx        # (발전)
│   │   │   └── layout.tsx
│   │   └── layout.tsx
│   │   └── page.tsx            # 홈 (로그인/대시보드로 리다이렉트)
│   ├── components/             # 공용 UI 컴포넌트
│   │   ├── FileUploader.tsx
│   │   └── Navbar.tsx
│   ├── lib/                    # 유틸리티 및 API 클라이언트
│   │   └── api.ts              # Flask 백엔드 API 호출 래퍼
│   ├── next.config.mjs
│   └── package.json
│
├── backend/                    # Flask (Python) API 프로젝트
│   ├── app.py                  # 메인 Flask 라우터
│   ├── requirements.txt        # Python 의존성
│   ├── config.py               # 설정 (API 키 등)
│   ├── .env                    # 환경 변수 (API 키 로드)
│   ├── venv/                   # 가상 환경 (gitignore 처리)
│   └── services/               # 핵심 비즈니스 로직
│       ├── __init__.py
│       ├── 0_parsing_service.py   # 파일 파싱 (pdf, docx, txt)
│       ├── 1_plagiarism_service.py # 텍스트 표절률 API 호출
│       ├── 2_rag_service.py       # RAG 및 임베딩 (유사 문서 검색)
│       ├── 3_analysis_service.py  # LLM 호출 (요약, 구조화, 논리흐름)
│       ├── 4_qa_service.py        # LLM 호출 (사고 자극 질문 생성)
│       └── 5_advancement_service.py # LLM 호출 (발전)
│
├── .gitignore                  # Git 무시 목록
└── README.md                   # 프로젝트 설명
