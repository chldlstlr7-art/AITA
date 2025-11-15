import csv
import os

# --- 설정 ---
# 원본 CSV 파일 이름을 지정하세요
INPUT_FILE = 'aita_report_dummy.csv' 
# 새로 생성될 CSV 파일 이름을 지정하세요
OUTPUT_FILE = 'corrected_dummy_data.csv'
# ---

def fix_csv_columns():
    """
    INPUT_FILE을 읽어 'summary'와 'evaluation' 컬럼의 값을
    서로 맞바꾼 뒤 OUTPUT_FILE로 저장합니다.
    """
    
    # 1. 원본 파일 존재 여부 확인
    if not os.path.exists(INPUT_FILE):
        print(f"오류: 원본 파일 '{INPUT_FILE}'을(를) 찾을 수 없습니다.")
        print("스크립트와 같은 폴더에 CSV 파일을 위치시키거나 INPUT_FILE 변수 경로를 수정해주세요.")
        return

    rows_processed = 0
    
    try:
        with open(INPUT_FILE, mode='r', encoding='utf-8-sig') as infile:
            # CSV 파일을 딕셔너리 형태로 읽습니다.
            reader = csv.DictReader(infile)
            
            # 원본 파일의 컬럼 헤더(fieldnames)를 그대로 가져옵니다.
            fieldnames = reader.fieldnames
            
            # 2. 필수 컬럼 확인
            if 'summary' not in fieldnames or 'evaluation' not in fieldnames:
                print(f"오류: CSV 파일에 'summary' 또는 'evaluation' 컬럼이 없습니다.")
                return

            print(f"'{INPUT_FILE}' 파일 처리를 시작합니다...")

            # 3. 수정된 파일을 쓰기 모드로 엽니다.
            with open(OUTPUT_FILE, mode='w', encoding='utf-8', newline='') as outfile:
                # 딕셔너리 형태로 CSV를 작성합니다.
                writer = csv.DictWriter(outfile, fieldnames=fieldnames)
                
                # 헤더(컬럼명)를 먼저 씁니다.
                writer.writeheader()
                
                # 4. 각 행을 순회하며 데이터 교체
                for row in reader:
                    # 원본 'summary'와 'evaluation' 값을 임시 변수에 저장
                    original_summary = row['summary']
                    original_evaluation = row['evaluation']
                    
                    # [핵심 로직] 두 변수의 값을 서로 맞바꿔서 다시 할당
                    row['summary'] = original_evaluation  # 'summary' 컬럼에 JSON 삽입
                    row['evaluation'] = original_summary # 'evaluation' 컬럼에 'Core Thesis' 텍스트 삽입
                    
                    # 수정된 행(row)을 새 파일에 씁니다.
                    writer.writerow(row)
                    rows_processed += 1

        print("\n--- 작업 완료 ---")
        print(f"총 {rows_processed}개의 행을 처리했습니다.")
        print(f"수정된 데이터가 '{OUTPUT_FILE}' 파일로 저장되었습니다.")
        print(f"이제 이 '{OUTPUT_FILE}'을 사용하여 데이터베이스에 적용하시면 됩니다.")

    except Exception as e:
        print(f"\n스크립트 실행 중 오류가 발생했습니다: {e}")
        # 오류 발생 시 생성 중이던 OUTPUT_FILE 삭제
        if os.path.exists(OUTPUT_FILE):
            os.remove(OUTPUT_FILE)
            print(f"'{OUTPUT_FILE}' 파일이 삭제되었습니다 (작업 롤백).")

# --- 스크립트 실행 ---
if __name__ == "__main__":
    fix_csv_columns()