import os
import pandas as pd
import json
import uuid
from tqdm import tqdm

# --- [중요] Flask App 컨텍스트 로드 ---
from app import app, db
from models import AnalysisReport, User # User 모델도 임포트
# [수정] generate_password_hash는 models.py에 없으므로 여기서도 필요 없음

# --- [설정] ---
CSV_FILE_PATH = 'final_with_embeddings (3).csv' 
# --- [설정] ---

def create_system_user():
    """'system_importer' 사용자를 확인하고, 없으면 생성합니다."""
    
    # [수정] User 모델의 '@snu.ac.kr' 검증을 통과할 수 있는 이메일로 변경
    SYSTEM_EMAIL = 'system_importer@snu.ac.kr' 
    system_user = User.query.filter_by(email=SYSTEM_EMAIL).first()
    
    if system_user:
        print(f"   -> 'system_importer' 사용자 (Email: {SYSTEM_EMAIL}, ID: {system_user.id})를 사용합니다.")
        return system_user

    print(f"   -> 'system_importer' 사용자를 새로 생성합니다.")
    
    # [수정] models.py의 __init__(self, email, role) 시그니처에 맞게 생성
    new_user = User(
        email=SYSTEM_EMAIL,
        role='student' # (임의 지정)
    )
    
    # (참고: 이 사용자는 CSV 임포트용이며, 
    # models.py의 로직에 따라 is_verified=False 상태로 생성됩니다.)
    
    db.session.add(new_user)
    try:
        db.session.commit()
        print(f"   -> 'system_importer' (ID: {new_user.id}) 생성 완료.")
        return new_user
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL: 'system_importer' 사용자 생성 실패: {e}")
        print("   -> (참고) User 모델의 'email' 등이 Unique 제약조건에 걸렸을 수 있습니다.")
        return None

def import_csv_to_db():
    """
    CSV 파일의 데이터를 읽어 AnalysisReport 테이블로 임포트합니다.
    """
    print("--- 1회용 CSV 임포트 스크립트 시작 ---")
        
    # 1. 기존 CSV 파일 읽기
    if not os.path.exists(CSV_FILE_PATH):
        print(f"CRITICAL: CSV 파일을 찾을 수 없습니다: {CSV_FILE_PATH}")
        print("         (이 스크립트와 같은 위치에 CSV 파일을 넣어주세요)")
        return
        
    print(f"1. 원본 CSV 파일 로드 중: {CSV_FILE_PATH}")
    try:
        df = pd.read_csv(CSV_FILE_PATH)
        # NaN 값이 있는 텍스트 필드를 빈 문자열로 대체
        df = df.fillna('') 
        print(f"   -> {len(df)}개의 행을 읽었습니다.")
    except Exception as e:
        print(f"CRITICAL: CSV 파일 읽기 실패: {e}")
        return

    # Flask 앱 컨텍스트 내에서 DB 작업 수행
    with app.app_context():
        
        # 2. 시스템 사용자 준비
        print("2. 시스템 사용자 확인 중...")
        system_user = create_system_user()
        if not system_user:
            return # 사용자 생성 실패 시 중단

        # 3. [경고] 기존 비교 대조군 데이터 삭제
        try:
            print("3. [주의] 기존 '비교 대조군 (is_test=False)' 데이터 삭제 중...")
            deleted_count = db.session.query(AnalysisReport).filter_by(is_test=False).delete()
            db.session.commit()
            print(f"   -> {deleted_count}개의 기존 리포트를 삭제했습니다.")
        except Exception as e:
            db.session.rollback()
            print(f"CRITICAL: 기존 데이터 삭제 실패: {e}")
            return

        # 4. CSV 데이터를 DB 모델 객체로 변환
        print("4. CSV 데이터를 DB 모델 객체로 변환 중...")
        new_reports_for_sql = []
        
        # CSV의 요약 필드 (summary JSON으로 합쳐질 필드들)
        summary_keys = [
            'assignment_type', 'Core_Thesis', 'Problem_Framing', 'Claim', 
            'Reasoning', 'Flow_Pattern', 'Conclusion_Framing', 'key_concepts'
        ]

        for index, row in tqdm(df.iterrows(), total=df.shape[0], desc="[Importing]"):
            try:
                # 4-A. Summary JSON 객체 생성
                summary_data = {}
                for key in summary_keys:
                    if key in row:
                        summary_data[key] = row[key]
                summary_json_str = json.dumps(summary_data, ensure_ascii=False)
                
                # 4-B. AnalysisReport 객체 생성
                report_obj = AnalysisReport(
                    id=str(uuid.uuid4()), # 새 UUID 생성
                    user_id=system_user.id, # '시스템 사용자' ID
                    original_filename=row['source_file'],
                    
                    is_test=False, # [CRITICAL] 이 데이터는 '비교 대조군'임
                    
                    status="completed", # 이미 완료된 데이터
                    text_snippet=None, # CSV에 원본 텍스트가 없으므로 비워둠
                    
                    summary=summary_json_str, # 4-A에서 만든 JSON
                    
                    # CSV에 이미 문자열로 저장된 임베딩 값을 그대로 사용
                    embedding_keyconcepts_corethesis=row['embedding_keyconcepts_corethesis'],
                    embedding_keyconcepts_claim=row['embedding_keyconcepts_claim'],
                    
                    # (기타 필드는 기본값 또는 None으로 둠)
                    evaluation=json.dumps({"info": "Imported from CSV"}),
                    logic_flow=json.dumps({}),
                    qa_history=json.dumps([]),
                    questions_pool=json.dumps([]),
                    is_refilling=False,
                    advancement_ideas=json.dumps([])
                )
                new_reports_for_sql.append(report_obj)
            
            except KeyError as e:
                print(f"WARNING: {row.get('source_file', '알 수 없는 행')} 처리 중 오류: 필수 컬럼({e}) 누락. 건너뜁니다.")
            except Exception as e:
                print(f"WARNING: {row.get('source_file', '알 수 없는 행')} 처리 중 오류: {e}. 건너뜁니다.")
        
        # 5. SQL DB에 저장
        try:
            print(f"\n5. SQL 데이터베이스에 {len(new_reports_for_sql)}개 항목 저장 시작...")
            db.session.bulk_save_objects(new_reports_for_sql)
            db.session.commit()
            print(f"   -> {len(new_reports_for_sql)}개 항목 SQL DB 저장 완료.")
        except Exception as e:
            db.session.rollback()
            print(f"CRITICAL: SQL DB 저장 실패: {e}")
            return

    print("\n--- 모든 CSV 임포트 작업 완료 ---")
    print("이제 `is_test=False`인 리포트는 이 CSV의 데이터를 대조군으로 사용합니다.")

if __name__ == "__main__":
    # 이 스크립트를 직접 실행할 때 (e.g., python import_csv_tool.py)
    import_csv_to_db()