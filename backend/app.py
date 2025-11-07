from flask import Flask, jsonify
from flask_cors import CORS

# 1. 'app'이라는 이름의 Flask 서버 생성
app = Flask(__name__)

# 2. 나중을 위해 CORS 보안 설정 (모든 요청 허용)
CORS(app)

# 3. "http://127.0.0.1:5000/" 라는 주소(루트) 만들기
@app.route("/")
def hello_world():
    # 4. 이 주소로 접속하면 "Hello, World!" 라는 JSON을 보여줌
    return jsonify({"message": "Hello, World! This is AITA Backend!"})

# 5. (선택 사항) /api/test 주소도 하나 만들기
@app.route("/api/test")
def test_route():
    return jsonify({"status": "OK", "data": "Test route is working!"})
