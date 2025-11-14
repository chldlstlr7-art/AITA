# backend/temp_app.py

from flask import Flask

# Flask 인스턴스 생성
app = Flask(__name__)

# 기본 라우트 설정
@app.route('/')
def hello_world():
    return 'Temporary App Running for Render Upgrade!'

if __name__ == '__main__':
    # Render 환경에서는 Gunicorn이 포트를 설정하므로, 로컬 테스트용으로만 사용
    app.run(debug=True)
