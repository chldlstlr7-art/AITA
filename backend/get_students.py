# get_students.py
from app import app
from models import User, db

print("DB에서 학생 목록을 조회합니다...")

with app.app_context():
    try:
        # 학생(role='student')만 ID 오름차순으로 조회
        students = User.query.filter_by(role='student').order_by(User.id).all()
        
        if not students:
            print("오류: DB에 학생이 없습니다. seed.py를 먼저 실행하세요.")
        else:
            print("\n--- 🧑‍🎓 학생 ID 및 이메일 목록 ---")
            for student in students:
                print(f"  ID: {student.id}  (Email: {student.email})")
            print("---------------------------------")
            print(f"총 {len(students)}명의 학생 ID를 확인했습니다.")

    except Exception as e:
        print(f"DB 조회 중 오류 발생: {e}")