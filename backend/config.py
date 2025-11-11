import os

class Config:
    """
    Flask 애플리케이션 설정을 위한 기본 클래스.
    환경 변수(GitHub Secrets)에서 값을 불러옵니다.
    """
    
    # --- 1. Flask & JWT 비밀 키 ---
    # (터미널에서 python -c 'import secrets; print(secrets.token_hex(16))'로 생성)
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')

    # --- 2. 데이터베이스 설정 ---
    # (기본값: 'sqlite:///aita.db' - backend 폴더에 파일 생성)
    SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI', 'sqlite:///aita.db')
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
    "You are an expert academic text analyst. Your task is to carefully read the provided text and "
    "produce a detailed logical-structural analysis in JSON format. "
    "You **must** write all output in **full, natural-language sentences** in Korean. "
    "Do NOT use keyword lists or fragmented phrases. "
    "Your goal is to create a semantically rich, specific, and unique analysis that reflects the logical and rhetorical structure of the document.\n\n"
    "Follow the logical-structural evaluation framework below. "
    "Each field should be written as a complete and concrete explanation, not as a short label.\n\n"
    "Field Definitions:\n"
    "1. **Core Thesis** – Describe the central issue or thesis of the text. "
    "(e.g., 'This essay argues that digital dependency among teenagers weakens self-control.')\n"
    "2. **Problem Framing** – Explain how the introduction defines or interprets the main topic. "
    "(e.g., 'The introduction frames technological dependency as a psychological issue rather than a social one.')\n"
    "3. **Claim** – Write the most essential argument of the text as a complete, specific sentence.\n"
    "4. **Reasoning** – State the number of main reasons, summarize each one, and classify their types "
    "(e.g., statistical evidence, example, value-based reasoning, or authority citation). Write in at least one full paragraph.\n"
    "5. **Flow Pattern** – Analyze the logical flow of the given text in sequence, such as: "
    "Problem Statement: “~~”, “~~” → Claim: “~~” → Supporting Evidence: “~~”, “~~” → "
    "Counterargument and Rebuttal: “~~” → Conclusion: “~~~”.\n"
    "6. **Conclusion Framing** – Explain how the conclusion is structured (summary, recommendation, or value emphasis) and its rhetorical focus.\n"
    "7. **key_concepts** – Extract 5–7 unique, topic-specific keywords or proper nouns that represent the text’s key ideas, separated by commas. "
    "(e.g., 'digital dependency, self-control, technology culture, social isolation, resilience')\n\n"
    "You must output strictly in the following JSON format (in Korean):\n\n"
    "```json\n"
    "{\n"
    "  \"assignment_type\": \"[e.g., Argumentative Essay, Editorial, Research Proposal]\",\n"
    "  \"Core_Thesis\": \"[A full Korean sentence describing the central thesis or issue]\",\n"
    "  \"Problem_Framing\": \"[Explanation of how the introduction defines or interprets the topic, in Korean]\",\n"
    "  \"Claim\": \"[The most essential argument, written in a complete Korean sentence]\",\n"
    "  \"Reasoning\": \"[Number of reasons, summaries, and classifications, written in Korean]\",\n"
    "  \"Flow_Pattern\": \"[Explanation of logical flow sequence, in Korean]\",\n"
    "  \"Conclusion_Framing\": \"[Explanation of the conclusion type and focus, in Korean]\",\n"
    "  \"key_concepts\": \"[5–7 specific keywords, comma-separated, in Korean]\"\n"
    "}\n"
    "```\n\n"
    "Answer in Korean."
)

# 2. 후보 문서 간 비교 프롬프트
COMPARISON_SYSTEM_PROMPT = (
"You are an expert evaluator comparing two structured analysis reports (JSON format) derived from academic essays. "
"Your task is to assess the *logical and structural similarity* between the 'Submission' report and the 'Candidate' report. "
"Do NOT compare the original text; compare only the provided JSON analysis data.\n\n"

"Please analyze the following two JSON reports:\n"
"--- (Submission JSON) ---\n"
"{submission_json_str}\n"
"--- (Candidate JSON) ---\n"
"{candidate_json_str}\n\n"

"Evaluate the pair by comparing their corresponding JSON fields according to the following ten logical-structural criteria. "
"For each criterion, assign a similarity score from **1 to 5** (1 = completely different, 5 = almost identical) "
"and briefly explain the reasoning behind your score.\n\n"

"Evaluation Criteria:\n"
"1. **Core Thesis** – Assess how similar the two essays are in their central issue or thesis focus. "
"   Evaluate whether both discuss the same core problem and stance.\n"
"2. **Problem Framing** – Compare how each essay defines and interprets the topic in the introduction "
"(e.g., phenomenon-centered vs. value-centered vs. ethical perspective).\n"
"3. **Claim** – Evaluate how semantically and logically similar the central claims are. "
"   Focus on conceptual direction, not surface wording.\n"
"4. **Reasoning** – Assess whether the reasoning patterns and types of evidence (statistics, examples, value-based, authority-based) are similar.\n"
"5. **Flow Pattern** – Assess whether the sequence of argument–counterargument–rebuttal is similar.\n"
"6. **Conclusion Framing** – Compare the conclusion types "
"(summary / recommendation / value emphasis) and determine whether both essays employ the same framing style.\n"

"Please provide your evaluation strictly in the following format (in Korean):\n\n"
"- **Overall Comment:** [A brief overall statement about logical/structural similarity]\n\n"
"- **Detailed Scoring:**\n"
"  1. Core Thesis Similarity: [Score 1–5] – [Reason in Korean]\n"
"  2. Problem Framing Similarity: [Score 1–5] – [Reason in Korean]\n"
"  3. Claim Similarity: [Score 1–5] – [Reason in Korean]\n"
"  4. Reasoning Similarity: [Score 1–5] – [Reason in Korean]\n"
"  5. Flow Pattern Similarity: [Score 1–5] – [Reason in Korean]\n"
"  6. Conclusion Framing Similarity: [Score 1–5] – [Reason in Korean]\n"

"Answer in Korean."
)
