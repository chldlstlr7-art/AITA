import sys
from app import app  # Flask app 객체 임포트
from extensions import db  # db 객체 임포트
from models import AnalysisReport # AnalysisReport 모델 임포트

def set_is_test_to_false():
    """
    analysis_reports 테이블의 모든 is_test 컬럼을 False로 업데이트합니다.
    """
    with app.app_context():
        try:
            print("DB에 연결하여 is_test 컬럼 업데이트를 시작합니다...")

            # AnalysisReport 테이블의 모든 레코드를 대상으로
            # is_test 값을 False로 설정하는 대량 업데이트(bulk update) 실행
            # (synchronize_session=False는 성능을 위해 사용)
            updated_count = db.session.query(AnalysisReport).update(
                {AnalysisReport.is_test: False},
                synchronize_session=False
            )

            # 변경사항을 DB에 커밋
            db.session.commit()

            print("\n[성공] 작업이 완료되었습니다.")
            print(f"총 {updated_count}개의 보고서 상태를 is_test = False 로 변경했습니다.")

        except Exception as e:
            print(f"\n[오류] 작업 중 오류가 발생했습니다: {e}")
            db.session.rollback()
            print("  - 작업이 롤백되었습니다.")
        
        finally:
            db.session.close()

# --- 스크립트 실행 ---
if __name__ == '__main__':
    set_is_test_to_false()