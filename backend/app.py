import os
import threading
import uuid
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from services.analysis_service import perform_full_analysis_and_comparison

# 🔽🔽🔽 디버그 코드 시작 🔽🔽🔽
print("\n[DEBUG] -----------------------------------------")
print("[DEBUG] 'services' 파일이 임포트/실행됩니다.")

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("[DEBUG] 🔴 치명적: os.environ.get('GEMINI_API_KEY')가 'None'입니다!")
    print("[DEBUG] ➡️ 'app.py'에서 load_dotenv()가 먼저 실행되었는지 확인하세요.")
else:
    print(f"[DEBUG] ✅ API 키 로드 성공 (마지막 4자리): ...{GEMINI_API_KEY[-4:]}")

print("[DEBUG] -----------------------------------------\n")
# 🔼🔼🔼 디버그 코드 끝 🔼🔼🔼

# --- 임시 함수들 (나중에 진짜로 대체해야 함) ---
def parse_file(file):
    """임시: 지금은 텍스트 파일만 처리. file.read()는 bytes를 반환하므로 decode 필요"""
    try:
        return file.read().decode('utf-8')
    except Exception:
        return file.read().decode('cp949', errors='ignore')

def get_initial_questions(text, summary):
    """임시: 사고 자극 질문 (하드코딩)"""
    return [
        "이 주장에 대한 가장 강력한 반론은 무엇인가요?",
        "핵심 근거 1을 뒷받침하는 다른 사례는 없나요?",
        "이 결론이 현실에 적용될 때의 잠재적 위험은 무엇인가요?"
    ]
# --- 임시 함수 끝 ---


# --- 1. Flask 앱 설정 ---
app = Flask(__name__)
# Vercel 프론트엔드 및 로컬 개발 환경에서의 접근을 허용 (매우 중요)
CORS(app, resources={r"/api/*": {"origins": ["*.vercel.app", "http://localhost:3000"]}})

# 분석 결과를 저장할 임시 딕셔너리 (나중엔 DB로)
analysis_results = {}
analysis_status = {}

# --- 2. 백그라운드 분석 스레드 ---
def background_analysis(report_id, text, doc_type, original_filename):
    """(매우 중요) 백그라운드 스레드에서 무거운 작업을 처리"""
    print(f"[{report_id}] 백그라운드 분석 시작...")
    try:
        # 1. 핵심 분석 (LLM 요약 -> S-BERT 검색 -> LLM 1:1 비교)
        analysis_data = perform_full_analysis_and_comparison(text, original_filename)
        
        if not analysis_data:
            raise Exception("perform_full_analysis_and_comparison returned None")

        # 2. 초기 질문 생성
        initial_questions = get_initial_questions(text, analysis_data['submission_summary'])

        # 3. 최종 결과 취합
        final_result = {
            "summary": analysis_data['submission_summary'], 
            "evaluation": {
                "structural_similarity_comment": "LLM 정밀 비교 결과를 확인하세요." 
            },
            "logicFlow": {}, # (임시) 논리 흐름도는 아직 없음
            "similarity_details": {
                "structural_similarity_details": analysis_data['llm_comparison_results']
            },
            "initialQuestions": initial_questions,
            "qa_history": []
        }
        
        analysis_results[report_id] = final_result
        analysis_status[report_id] = "completed"
        print(f"[{report_id}] 분석 완료 및 저장됨.")

    except Exception as e:
        print(f"[{report_id}] 백그라운드 분석 중 오류 발생: {e}")
        analysis_status[report_id] = "error"
        analysis_results[report_id] = {"error": str(e)}


# --- 3. API 라우트(주소) 정의 ---

@app.route("/api/analyze", methods=["POST"])
def analyze_report():
    """
    POST /api/analyze
    프론트엔드에서 파일과 폼 데이터를 받아 분석을 '시작'시킴
    """
    
    # (파일 파싱 로직)
    file = request.files.get("file")
    text = request.form.get("text")
    doc_type = request.form.get("docType")
    original_filename = "new_submission.txt" # 기본값

    if not text and file:
        original_filename = secure_filename(file.filename)
        text = parse_file(file) # 0_parsing_service.py (임시 함수)
    elif text:
        pass # 텍스트 직접 입력 사용
    else:
        return jsonify({"error": "No content provided (file or text)"}), 400
    
    if not text or len(text) < 50:
        return jsonify({"error": "Text is too short for analysis"}), 400

    report_id = str(uuid.uuid4())
    analysis_status[report_id] = "processing"
    
    # (매우 중요) 분석을 백그라운드 스레드에서 시작시킴
    thread = threading.Thread(
        target=background_analysis, 
        args=(report_id, text, doc_type, original_filename)
    )
    thread.start()
    
    # 프론트엔드에는 즉시 reportId를 반환 (202 Accepted)
    return jsonify({"reportId": report_id}), 202


@app.route("/api/report/<report_id>", methods=["GET"])
def get_report_status(report_id):
    """
    GET /api/report/<report_id>
    프론트엔드가 이 주소를 '폴링'하여 분석 상태를 확인
    """
    status = analysis_status.get(report_id, "not_found")
    
    if status == "completed":
        data = analysis_results.get(report_id)
        return jsonify({"status": "completed", "data": data})
    elif status == "processing":
        return jsonify({"status": "processing"})
    elif status == "error":
        data = analysis_results.get(report_id, {"error": "Unknown error"})
        return jsonify({"status": "error", "data": data}), 500
    else:
        return jsonify({"status": "not_found"}), 404

# (참고: 사고 자극 질문 / 발전 단계 API는 나중에 추가)

# --- 4. (선택 사항) 루트 확인용 ---
@app.route("/")
def hello_world():
    return jsonify({"message": "AITA Backend is running!"})
