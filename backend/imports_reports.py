# import_reports.py
import csv  # [수정] json 대신 csv 모듈 import
from app import app
from models import AnalysisReport, db

def import_data():
    with app.app_context():
        # [수정] 파일명을 .csv로 변경
        print("친구의 reports_data.csv 파일을 로드합니다...")
        try:
            reports_data = [] # 데이터를 담을 리스트
            with open('reports_data.csv', 'r', encoding='utf-8') as f:
                # [수정] csv.DictReader를 사용해 CSV를 딕셔너리 리스트로 읽어옴
                reader = csv.DictReader(f)
                for row in reader:
                    reports_data.append(row)
                    
        except FileNotFoundError:
            print("❌ 파일 로드 실패: reports_data.csv 파일을 찾을 수 없습니다.")
            return
        except Exception as e:
            print(f"❌ 파일 로드 실패: {e}")
            return

        print(f"총 {len(reports_data)}개의 리포트 임포트를 시작합니다...")
        
        try:
            for report_data in reports_data:
                # [중요] CSV의 헤더(key)가 AnalysisReport 모델의
                # 컬럼명과 일치한다고 가정
                
                # [수정] CSV는 모든 값을 문자열로 읽으므로, ID는 정수(int)로 변환
                try:
                    user_id_int = int(report_data['user_id'])
                    assignment_id_int = int(report_data['assignment_id'])
                except (ValueError, KeyError) as e:
                    print(f"⚠️ 경고: user_id 또는 assignment_id가 잘못된 행을 건너뜁니다. 데이터: {report_data}")
                    continue

                new_report = AnalysisReport(
                    user_id=user_id_int,
                    assignment_id=assignment_id_int,
                    
                    # [수정] .get()을 사용하면 CSV에 해당 컬럼이 없어도 오류 대신 None을 반환
                    report_title=report_data.get('report_title'),
                    text_snippet=report_data.get('text_snippet'),
                    evaluation=report_data.get('evaluation'),
                    summary=report_data.get('summary'),
                    logic_flow=report_data.get('logic_flow'),
                    
                    embedding_keyconcepts_corethesis=report_data.get('embedding_keyconcepts_corethesis'),
                    embedding_keyconcepts_claim=report_data.get('embedding_keyconcepts_claim'),
                    
                    # [삭제] auto_score_details, ta_score_details, ta_feedback
                    # 이 3개 필드는 생성 시 값을 주지 않으므로 DB에 NULL (비어 있음)로 저장됩니다.
                    
                    status="completed", # AI 분석까지는 '완료'된 상태
                    original_filename=report_data.get('original_filename', "dummy_import.txt")
                )
                db.session.add(new_report)
            
            db.session.commit()
            print("✅ 모든 리포트 임포트 성공!")

        except KeyError as e:
            # DictReader가 CSV 헤더를 key로 사용하므로, KeyError는 컬럼명이 일치하지 않음을 의미
            db.session.rollback()
            print(f"❌ 임포트 중 오류 발생: CSV 헤더(컬럼명)에 {e} 키가 없습니다.")
        except Exception as e:
            db.session.rollback()
            print(f"❌ 임포트 중 오류 발생: {e}")
            print("-> (확인!) user_id 또는 assignment_id가 DB에 없는 값일 수 있습니다. (ForeignKey 위반)")

if __name__ == "__main__":
    import_data()