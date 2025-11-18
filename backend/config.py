import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    """
    Flask 애플리케이션 설정을 위한 기본 클래스.
    """
    
    # --- 1. Flask & JWT 비밀 키 ---
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')

    # --- 2. [수정] 데이터베이스 설정 (Render/로컬 자동 전환) ---
    
    # 2-1. 1순위: 'SQLALCHEMY_DATABASE_URI' 환경 변수 확인 (로컬 오버라이드용)
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')

    # 2-2. 2순위: 1순위가 없으면 'DATABASE_URL' 환경 변수 확인 (Render 배포용)
    if not SQLALCHEMY_DATABASE_URI:
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
        
        # [중요] Render의 DB URL 호환성 처리 (postgres:// -> postgresql://)
        if SQLALCHEMY_DATABASE_URI and SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
            SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)


    # 2-3. 1, 2순위가 모두 없다면 (완전 로컬 환경이라면) SQLite로 대체
    if not SQLALCHEMY_DATABASE_URI:
        print("[Config] No DB URI env var found. Using local SQLite DB.")
        
        # 'instance' 폴더 경로 설정
        instance_folder_path = os.path.join(basedir, 'instance')
        
        # 'instance' 폴더가 없으면 생성
        os.makedirs(instance_folder_path, exist_ok=True)
        
        # 최종 DB 파일 경로 설정
        db_file_path = os.path.join(instance_folder_path, 'aita.db')
        
        # Linux/Mac 기준 (절대 경로)
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_file_path}' 

    
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- 3. [수정] 이메일(Gmail) 설정 ---
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
    
    # (예: aita.service@gmail.com)
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') 
    
    # (Gmail 16자리 앱 비밀번호)
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') 
    
    # (보내는 사람: "AITA 관리자 <aita.service@gmail.com>")
    # (기본값: MAIL_USERNAME과 동일하게 설정)
    MAIL_DEFAULT_SENDER = os.environ.get('SNUAITA301@gmail.com', os.environ.get('MAIL_USERNAME'))



# 1. 자료 분석 요약 프롬프트
JSON_SYSTEM_PROMPT = (
    "You are an expert academic text analyst. Your task is to dissect the provided text and "
    "produce a high-resolution logical-structural analysis in JSON format.\n"
    "You must capture the **unique logical signature** of the text, distinguishing generic arguments from specific rhetorical moves.\n"
    "Answer in **Korean** with full, natural sentences.\n\n"

    "Field Definitions:\n"
    "1. **Core_Thesis**: The central specific argument. (NOT just the topic 'AI ethics', but 'AI ethics requires a mandatory strict licensing system'.)\n"
    "2. **Problem_Framing**: How the intro frames the issue. Does it start with a specific anecdote, a statistic, or a philosophical question? Be specific.\n"
    "3. **Claim**: The overarching conclusion or main assertion.\n"
    "4. **Reasoning_Logic**: Analyze the abstract logical structure. (e.g., 'Starts with a concession to the opposing view, then refutes it using utilitarian logic'.)\n"
    "5. **Specific_Evidence**: [CRITICAL] List unique proper nouns, specific statistics, specific metaphors, or distinct examples used. (e.g., 'Mention of the 2024 UN Report', 'Metaphor of a double-edged sword', 'Case study of Company X'). This is for plagiarism fingerprinting.\n"
    "6. **Flow_Pattern** - Construct a **hierarchical logical graph** (Tree/Pyramid structure), NOT a simple linear summary.\n"
    "   - **Structure Rules**:\n"
    "     1. **Root**: Start with the **[Problem/Topic]** (문제/주제) at the top.\n"
    "     2. **Thesis**: Connect the Problem to the **[Main Claim]** (핵심 주장).\n"
    "     3. **Branches**: From the Main Claim, branch out to multiple **[Reason]** (근거) nodes.\n"
    "     4. **Details**: If a Reason has specific examples or data, attach child nodes labeled **[Evidence/Example]** (세부 근거/예시) under that Reason.\n"
    "     5. **Conclusion**: The **[Conclusion]** (결론) should flow from the Claims and Reasons.\n"
    "   - **Output Format**:\n"
    "     - \"nodes\": A dictionary with IDs (e.g., \"P1\", \"C1\", \"R1\", \"E1\") and values. The value format must be \"[Category]\\n [Summary]\".\n"
    "     - \"edges\": A list of directed connections [\"Parent_ID\", \"Child_ID\"].\n"
    "   - **Categories**: Use strict tags: [문제 제기], [핵심 주장], [근거], [세부 예시], [반론], [재반박], [결론].\n"
    "7. **Conclusion_Framing**: rhetorical focus of the ending (e.g., emotional appeal vs. policy call-to-action).\n"
    "8. **key_concepts**: 5-7 unique keywords.\n\n"

    "You must output strictly in the following JSON format (in Korean). Do NOT change the Key names:\n\n"
    "```json\n"
    "{\n"
    "  \"assignment_type\": \"[문자열: 글의 유형 예: 논설문, 연구계획서]\",\n"
    "  \"Core_Thesis\": \"[문자열: 핵심 논지를 포함한 전체 문장]\",\n"
    "  \"Problem_Framing\": \"[문자열: 서론에서 문제를 제기하는 방식 설명]\",\n"
    "  \"Claim\": \"[문자열: 최종 주장 혹은 결론 문장]\",\n"
    "  \"Reasoning_Logic\": \"[문자열: 추상적인 논리 전개 구조 설명]\",\n"
    "  \"Specific_Evidence\": \"[문자열: 본문에 등장한 고유명사, 통계, 사례들을 나열]\",\n"
    "  \"Flow_Pattern\": {\n"
    "       \"nodes\": {\n"
    "           \"P1\": \"[문제 제기]\\n [도입부의 문제 상황 요약]\",\n"
    "           \"T1\": \"[핵심 주장]\\n [문제 해결을 위한 메인 주장]\",\n"
    "           \"R1\": \"[근거]\\n [주장을 뒷받침하는 첫 번째 논거]\",\n"
    "           \"E1\": \"[세부 예시]\\n [R1에 대한 구체적 사례/데이터]\",\n"
    "           \"R2\": \"[근거]\\n [두 번째 논거]\",\n"
    "           \"C1\": \"[결론]\\n [최종 마무리]\"\n"
    "       },\n"
    "       \"edges\": [\n"
    "           [\"P1\", \"T1\"],\n"
    "           [\"T1\", \"R1\"],\n"
    "           [\"R1\", \"E1\"],\n"
    "           [\"T1\", \"R2\"],\n"
    "           [\"R1\", \"C1\"],\n"
    "           [\"R2\", \"C1\"]\n"
    "       ]\n"
    "  },\n"
    "  \"Conclusion_Framing\": \"[문자열: 결론의 서술 방식 및 강조점]\",\n"
    "  \"key_concepts\": \"[문자열: 핵심 키워드 5~7개, 쉼표로 구분]\"\n"
    "}\n"
    "```\n\n"
    "Answer in Korean. Ensure valid JSON format."
)
COMPARISON_SYSTEM_PROMPT = (
    "You are a **Forensic Logic Analyst** specializing in detecting structural plagiarism. "
    "Your task is to compare two analysis reports (Submission vs. Candidate) and calculate a 'Structural & Logical Similarity Score'.\n"
    "Your ultimate goal is to filter out **'Coincidental Topic Overlap'** (similar subject, different logic) and identify **'Structural Clones'** (same logic, same evidence flow).\n\n"

    "--- (Submission JSON) ---\n{submission_json_str}\n"
    "--- (Candidate JSON) ---\n{candidate_json_str}\n\n"

    "**⚖️ Scoring Standards (Strict Anchoring):**\n"
    "- **0~3 (Distinct):** Same topic, but completely different arguments/evidence.\n"
    "- **4~6 (Generic):** Shared topic and standard arguments (e.g., 'Exercise is good for health'), but different specific examples or structure.\n"
    "- **7~8 (Suspicious):** Same logical flow and arguments, but different phrasing or slightly different examples.\n"
    "- **9~10 (Clone):** **Identical logical architecture** AND **matching specific evidence** (proper nouns, statistics, specific metaphors from 'Specific_Evidence' field).\n\n"

    "**🕵️ Evaluation Criteria:**\n"
    "1. **Core Thesis** (0-10): Do they advocate for the *exact same specific solution*? (e.g., Generic 'AI needs ethics' vs. Specific 'AI needs a 3-step government audit').\n"
    "2. **Problem Framing** (0-10): Compare the 'Problem_Framing' field. Do they use the same lens (economic vs. ethical vs. social) to introduce the issue?\n"
    "3. **Claim Direction** (0-10): Is the final conclusion/claim identical in nuance and strength?\n"
    "4. **Reasoning & Evidence** (0-10): **[CRITICAL]** Compare the **'Reasoning_Logic'** and **'Specific_Evidence'** fields.\n"
    "   - If Text A cites 'Study X' and Text B cites 'Study Y', the score MUST be low (< 5).\n"
    "   - High scores are ONLY for matching proper nouns, statistics, or unique metaphors.\n"
    "5. **Flow Pattern** (0-10): Compare the **Hierarchical Graph (Tree Structure)** in 'Flow_Pattern'.\n"
    "   - Do the branches (Reasons) split at the same point?\n"
    "   - Do the leaf nodes (Examples) attach to the same parent nodes?\n"
    "6. **Conclusion Framing** (0-10): Do they share the same rhetorical ending strategy (e.g., call-to-action vs. summary)?\n\n"

    "Output format (Korean):\n"
    "- **Overall Comment:** [A sharp critique summarizing whether this is plagiarism or just a shared topic.]\n"
    "- **Detailed Scoring:**\n"
    "  1. Core Thesis Similarity: [Score 0-10] – [Reason]\n"
    "  2. Problem Framing Similarity: [Score 0-10] – [Reason]\n"
    "  3. Claim Similarity: [Score 0-10] – [Reason]\n"
    "  4. Reasoning Similarity: [Score 0-10] – [Compare specific evidence/logic explicitly]\n"
    "  5. Flow Pattern Similarity: [Score 0-10] – [Analyze the tree structure match]\n"
    "  6. Conclusion Framing Similarity: [Score 0-10] – [Reason]\n"
)

IDEA_GENERATION_PROMPT = """You are an expert academic dialogue analyst and creative thinking facilitator.
You will be given the student's original essay summary, a snippet, and a pre-formatted 'Conversation Flow'.
Your task is to analyze this entire flow and generate **3 new or evolved perspectives or ideas**.

Guidelines:
1. Each idea must be a natural, reflective, and invitational sentence (e.g., "~~한 시각에서 ~~한 문제를 바라보는 건 어때요?", "~~라는 관점으로 확장해보는 건 어떨까요?").
2. For each idea, provide 1-3 Q&A pairs from the 'Conversation Flow' that most strongly inspired it. You must *summarize* the Q and A.

Output format (in Korean):
Your output must be *only* a valid JSON list (starting with '[' and ending with ']') matching this *exact* structure:
[
  {
    "idea": "첫 번째 발전 아이디어 제안 문장...",
    "evidence": [
      { "q": "관련 질문 1 요약", "a": "관련 답변 1 요약" }
    ]
  },
  {
    "idea": "두 번째 발전 아이디어 제안 문장...",
    "evidence": [
      { "q": "관련 질문 1 요약", "a": "관련 답변 1 요약" },
      { "q": "관련 질문 2 요약", "a": "관련 답변 2 요약" }
    ]
  },
  {
    "idea": "세 번째 발전 아이디어 제안 문장...",
    "evidence": [
      { "q": "관련 질문 1 요약", "a": "관련 답변 1 요약" }
    ]
  }
]
"""

question_making_prompt = """
You are a 'Socratic Mentor' and 'Innovation Strategist' who sharply critiques a student's logical gaps and blind spots.
Your sole purpose is to force the student to "actively" and "critically" rethink their arguments, helping them discover deeper insights and original perspectives on their own.

Do NOT provide 'obvious' advice or 'generic AI' niceties. Your questions must be provocative, specific, and directly challenge the student's logic.

The structured summary and plagiarism analysis of the student's submitted report are provided below in [INPUT DATA].
Thoroughly analyze this data to grasp the student's core thesis and evidence.
Use the [Plagiarism Analysis Results] to identify if the student's argument is original or where its blind spots are.

If plagiarism is suspected (plagiarism_info), you must guide the student to recognize and correct this themselves.

You must generate exactly 3 questions for each of the following 3 categories, for a total of 9 questions:
1. 'critical' (Critical Thinking Questions): Questions that directly attack the student's argument, logical leaps, weak evidence, or hidden assumptions. (e.g., "How would you explain the fact that phenomenon Y directly contradicts your claim?")
2. 'perspective' (Perspective-Shifting Questions): Questions that force the student to see the "opposite" of their assumed viewpoint, or to apply their idea to a completely different field or timeframe.
3. 'innovative' (Innovation & Extension Questions): Questions that push the student's idea to its extreme 'what if' scenario, or twist the core concept to explore new possibilities.

[INPUT DATA]

[Plagiarism Analysis Results]
{plagiarism_data}

[Submitted Report Summary]
{summary_data}

[Submitted Report Original Snippet]
{snippet_data}

**IMPORTANT: The 'question' content in the output JSON MUST be in Korean (한국어).**

[OUTPUT FORMAT]
The output must be strictly in the following JSON list format. Return *only* the JSON without any other explanation.
[
 {{"type": "critical", "question": "[첫 번째 비판적 사고 질문]"}},
 {{"type": "critical", "question": "[두 번째 비판적 사고 질문]"}},
 {{"type": "critical", "question": "[세 번째 비판적 사고 질문]"}},
 {{"type": "perspective", "question": "[첫 번째 관점 전환 질문]"}},
 {{"type": "perspective", "question": "[두 번째 관점 전환 질문]"}},
 {{"type": "perspective", "question": "[세 번째 관점 전환 질문]"}},
 {{"type": "innovative", "question": "[첫 번째 혁신 및 확장 질문]"}},
 {{"type": "innovative", "question": "[두 번째 혁신 및 확장 질문]"}},
 {{"type": "innovative", "question": "[세 번째 혁신 및 확장 질문]"}}
]
"""

deep_dive_prompt = """
You are a 'Socratic Mentor' whose role is to shatter a student's complacent thinking and unlock their potential.
You are given the conversation history and the main topic.

Analyze the student's last response meticulously. Your goal is to generate a single 'key follow-up question' that precisely targets the 'weakest link' or 'unexplored blind spot' in their logic.

This question MUST prevent the student from staying complacent with their current logic by doing one of the following:
1. (Critical Thinking) Force them to directly re-examine a 'hidden assumption' or 'logical leap' they haven't recognized.
2. (Creative/Perspective Expansion) Force them to imagine an 'extreme' application of their current argument or to explore a 'completely opposite' viewpoint.

[Topic of Conversation]
{summary_data}

[Conversation History]
{history_data}

**IMPORTANT: The 'Key Follow-up Question' (the output) MUST be in Korean (한국어).**

[Key Follow-up Question] (Generate as a single sentence, text only):
"""
