import sys
import os
import json
import csv
from datetime import datetime

# [중요]
# 이 스크립트가 app, db, models를 임포트할 수 있도록 
# 프로젝트 루트에서 실행되어야 합니다.
try:
    from app import app 
    from extensions import db
    from models import User, Course, Assignment, AnalysisReport
    
    # [수정 1] 임베딩 재생성을 위한 헬퍼 함수 임포트
    from services.analysis_service import get_embedding_vector, build_concat_text

except ImportError as e:
    print(f"Import Error: {e}")
    print("스크립트를 프로젝트 루트에서 실행했는지, 'from app import app' 경로가 맞는지 확인하세요.")
    sys.exit(1)

# --- CSV 파일 설정 ---
CSV_FILE_PATH = 'corrected_dummy_data.csv'
# (COLUMN_ORDER는 이제 CSV 파일 자체에 의존하므로 스크립트 내에서 사용 X)


# --- 생성할 데이터 정의 ---

# --- 1. 관리자 계정 정보 ---
ADMIN_DATA = {
    "email": "admin@snu.ac.kr",
    "username": "admin_user",
    "password": "admin_password_123!" 
}

# --- 2. 학생 계정 정보 (10명) ---
STUDENT_DATA = []
for i in range(1, 11):
    STUDENT_DATA.append({
        "email": f"student{i:02d}@snu.ac.kr",
        "username": f"student{i:02d}",
        "password": f"student_pass_{i:02d}!" 
    })

# --- 3. 과목 및 과제 데이터 (사용자 제공 최종본) ---
# 마감일은 2026-02-25로 공통 적용
DUE_DATE_STR = "2026-02-25T23:59:00"

# (사용자가 제공한 JSON 데이터를 Python 리스트로 변환)
COURSES_DATA = [
  {
    "code": "1",
    "name": "대학글쓰기1",
    "assignments": [
      {
        "name": "논설문 쓰기 1: 대학생활과 시간 관리",
        "description": "대학생활에서의 시간 관리와 자율성을 주제로 1500자 내외의 논설문을 작성하시오. 자신의 경험 또는 주변의 보편적인 사례를 1개 이상 포함하여 논지를 뒷받침하되, 감정 호소에 치우치지 않도록 객관적 관점을 유지할 것.",
        "grading_criteria": {
          "A": { "name": "논제 이해 및 해석의 적절성", "max_score": 20 },
          "B": { "name": "주장과 근거의 명료성", "max_score": 20 },
          "C": { "name": "사례 제시의 적절성 및 개연성", "max_score": 20 },
          "D": { "name": "논리적 구성 및 전개", "max_score": 20 },
          "E": { "name": "문장 표현력 및 맞춤법", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 2: SNS와 인간관계 — 자료 활용형 과제",
        "description": "SNS가 인간관계의 질에 미치는 영향을 주제로 1500자 내외의 논설문을 작성하시오. 최소 1개 이상의 통계 자료(예: 설문조사, 연구 보고서, 뉴스 통계 등)를 반드시 활용하여 주장을 강화할 것.",
        "grading_criteria": {
          "A": { "name": "논제 이해 및 핵심 쟁점 파악", "max_score": 20 },
          "B": { "name": "통계 자료 활용의 정확성 및 출처 제시 여부", "max_score": 20 },
          "C": { "name": "자료 기반 근거의 설득력", "max_score": 20 },
          "D": { "name": "논리 전개의 일관성", "max_score": 20 },
          "E": { "name": "표현의 명확성 및 문장 완성도", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 3: 전공 선택과 진로 불안",
        "description": "전공 선택이 진로 불안에 미치는 영향에 대해 1500자 내외의 논설문을 작성하시오. 문제 제기–주장–근거–결론의 구조를 명확히 갖추고, 근거는 경험적 근거 또는 일반화 가능한 사례 중에서 2가지를 선택해 구성할 것.",
        "grading_criteria": {
          "A": { "name": "명확한 문제 제기 및 주장 제시", "max_score": 20 },
          "B": { "name": "근거의 타당성과 구체성", "max_score": 20 },
          "C": { "name": "사례 선택의 적절성", "max_score": 20 },
          "D": { "name": "논리적 연결 및 전개", "max_score": 20 },
          "E": { "name": "표현 및 문장력", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 4: 캠퍼스 다양성과 존중 문화 — 글쓰기 스킬 지정형 과제",
        "description": "대학 캠퍼스에서 다양성과 존중 문화가 왜 중요한지에 대한 논설문을 1500자 내외로 작성하시오. 반드시 ‘반론 제시 → 재반박’을 포함하여 글의 논리 구조를 강화할 것.",
        "grading_criteria": {
          "A": { "name": "쟁점 설정과 주장 제시의 명확성", "max_score": 20 },
          "B": { "name": "반론 제시의 타당성", "max_score": 20 },
          "C": { "name": "재반박의 논리적 완결성", "max_score": 20 },
          "D": { "name": "전체 전개의 일관성과 설득력", "max_score": 20 },
          "E": { "name": "문장력 및 문체의 적절성", "max_score": 20 }
        }
      }
    ]
  },
  {
    "code": "2",
    "name": "대학글쓰기2: 과학기술글쓰기",
    "assignments": [
      {
        "name": "논설문 쓰기 1: AI와 노동의 미래",
        "description": "AI 기술이 노동 시장에 미치는 영향을 주제로 1500자 내외의 논설문을 작성하시오. 기술 변화에 대한 기본 개념을 간단히 설명하고, 자신의 입장과 이를 뒷받침하는 근거 2가지를 제시할 것.",
        "grading_criteria": {
          "A": { "name": "과학기술 맥락 이해", "max_score": 20 },
          "B": { "name": "주장의 일관성", "max_score": 20 },
          "C": { "name": "근거 제시의 구체성", "max_score": 20 },
          "D": { "name": "논리적 구성", "max_score": 20 },
          "E": { "name": "표현력 및 서술의 정확성", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 2: 디지털 헬스케어 — 자료 활용형 과제",
        "description": "디지털 헬스케어 기술(웨어러블, 건강 앱 등)의 영향에 대해 1500자 내외의 논설문을 작성하시오. 반드시 2개 이상의 연구 결과 또는 통계를 인용하여 과학기술적 근거를 명확히 제시할 것.",
        "grading_criteria": {
          "A": { "name": "과학기술 개념 설명의 정확성", "max_score": 20 },
          "B": { "name": "자료 인용의 엄밀성 및 출처 명시", "max_score": 20 },
          "C": { "name": "인용 자료의 적절성과 논지 강화 정도", "max_score": 20 },
          "D": { "name": "논리 전개의 체계성", "max_score": 20 },
          "E": { "name": "전달력과 문장력", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 3: 기후위기와 과학기술의 역할",
        "description": "기후위기 해결에서 과학기술이 해야 할 역할을 주제로 1500자 내외의 논설문을 작성하시오. 기술 회의론과 기술 낙관론 중 한 입장을 선택하고, 해당 입장의 근거 2가지를 제시할 것.",
        "grading_criteria": {
          "A": { "name": "핵심 쟁점의 정확한 이해", "max_score": 20 },
          "B": { "name": "입장과 근거의 논리적 연결", "max_score": 20 },
          "C": { "name": "사례 및 근거의 타당성", "max_score": 20 },
          "D": { "name": "글 전체의 구조적 명료성", "max_score": 20 },
          "E": { "name": "서술의 정확성과 표현력", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 4: 우주개발 투자 논쟁 — 글쓰기 스킬 지정형 과제",
        "description": "우주개발 투자가 정당한지에 대한 논설문을 1500자 내외로 작성하시오. ‘비용 대비 편익 분석’ 또는 ‘윤리적 판단 기준 설정’ 중 하나를 글쓰기 전략으로 선택하여 명확히 적용할 것.",
        "grading_criteria": {
          "A": { "name": "쟁점 파악 및 논지 설정의 적절성", "max_score": 20 },
          "B": { "name": "선택한 글쓰기 전략(편익 분석/윤리 기준)의 적용 정확성", "max_score": 20 },
          "C": { "name": "논리적 타당성과 분석의 설득력", "max_score": 20 },
          "D": { "name": "근거 제시의 구체성", "max_score": 20 },
          "E": { "name": "문체의 명확성 및 완성도", "max_score": 20 }
        }
      }
    ]
  },
  {
    "code": "3",
    "name": "대학글쓰기2: 인문학글쓰기",
    "assignments": [
      {
        "name": "논설문 쓰기 1: 디지털 시대의 독서",
        "description": "디지털 읽기와 종이책 읽기의 차이를 논하며, 현대 사회에서 바람직한 독서 방식에 대해 1500자 내외의 논설문을 작성하시오. 개인 경험보다는 인문학적 관점 또는 사회적 맥락을 중심으로 논증할 것.",
        "grading_criteria": {
          "A": { "name": "인문학적 문제의식 제시", "max_score": 20 },
          "B": { "name": "주장의 논리성", "max_score": 20 },
          "C": { "name": "근거의 깊이 및 해석력", "max_score": 20 },
          "D": { "name": "구조적 일관성", "max_score": 20 },
          "E": { "name": "문장력 및 표현 적절성", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 2: 예술과 사회 비판 — 자료 활용형 과제",
        "description": "예술이 사회 비판적 역할을 수행할 수 있는지에 대해 1500자 내외의 논설문을 작성하시오. 반드시 1개 이상의 예술 작품 사례와 1개 이상의 비평/인터뷰/연구 자료를 인용하여 논지를 확장할 것.",
        "grading_criteria": {
          "A": { "name": "인문학적 쟁점 파악", "max_score": 20 },
          "B": { "name": "작품 사례 및 비평 자료 활용의 정교함", "max_score": 20 },
          "C": { "name": "자료가 논지 강화에 기여한 정도", "max_score": 20 },
          "D": { "name": "논리적 구성의 일관성", "max_score": 20 },
          "E": { "name": "표현력 및 문장 완성도", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 3: 혐오 표현과 표현의 자유",
        "description": "혐오 표현과 표현의 자유 사이의 긴장을 주제로 1500자 내외의 논설문을 작성하시오. 특정 집단을 비난하는 서술은 금지하며, 원칙 중심의 논증을 구성할 것.",
        "grading_criteria": {
          "A": { "name": "문제의식 설정의 정확성", "max_score": 20 },
          "B": { "name": "주장과 근거의 설득력", "max_score": 20 },
          "C": { "name": "사례·원칙 적용의 적절성", "max_score": 20 },
          "D": { "name": "전개 구조의 논리성", "max_score": 20 },
          "E": { "name": "서술의 명확성", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 4: 기억과 기록의 의미 — 글쓰기 스킬 지정형 과제",
        "description": "개인의 기억과 사회적 기록이 정체성 형성에 어떤 의미를 가지는지 1500자 내외의 논설문으로 작성하시오. 글쓰기 전략으로 ‘개념 정의 → 적용 → 반례 검토’ 방식을 반드시 사용할 것.",
        "grading_criteria": {
          "A": { "name": "핵심 개념 정의의 정확성", "max_score": 20 },
          "B": { "name": "적용 사례의 적절성", "max_score": 20 },
          "C": { "name": "반례 분석의 타당성", "max_score": 20 },
          "D": { "name": "논리 구조의 체계성과 설득력", "max_score": 20 },
          "E": { "name": "표현력 및 글의 완성도", "max_score": 20 }
        }
      }
    ]
  },
  {
    "code": "4",
    "name": "대학글쓰기2: 사회과학글쓰기",
    "assignments": [
      {
        "name": "논설문 쓰기 1: 청년 세대의 정치적 무관심",
        "description": "청년 세대가 정치에 무관심해지는 현상을 사회과학적 관점에서 분석하고, 그 원인과 해결 방향에 대해 1500자 내외의 논설문으로 작성하시오. 원인 분석 시 개인적·구조적 요인 중 최소 2가지를 선택하여 논리적으로 설명할 것.",
        "grading_criteria": {
          "A": { "name": "문제 제기 및 쟁점 설정의 적절성", "max_score": 20 },
          "B": { "name": "사회구조적 요인 분석의 타당성", "max_score": 20 },
          "C": { "name": "근거의 구체성 및 설득력", "max_score": 20 },
          "D": { "name": "논리적 구성 및 전개", "max_score": 20 },
          "E": { "name": "표현력 및 문장 완성도", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 2: 플랫폼 노동의 불안정성 — 자료 활용형 과제",
        "description": "플랫폼 노동(배달·대리·프리랜서 플랫폼 등)의 확산이 노동시장 안정성에 미치는 영향을 1500자 내외의 논설문으로 작성하시오. 반드시 『최소 2개 이상의 통계 또는 연구 보고서 자료』를 인용하여 논지를 강화할 것.",
        "grading_criteria": {
          "A": { "name": "논제 이해 및 사회과학적 맥락 파악", "max_score": 20 },
          "B": { "name": "인용한 통계·연구 자료의 정확성 및 출처 명시", "max_score": 20 },
          "C": { "name": "자료가 논증을 강화하는 정도", "max_score": 20 },
          "D": { "name": "사회과학적 분석의 논리성", "max_score": 20 },
          "E": { "name": "표현력 및 문장력", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 3: 사회적 불평등과 교육 기회",
        "description": "교육 기회에 영향을 미치는 사회적 불평등(경제적 자원, 가정환경, 지역 격차 등) 중 한 가지 이상을 선택하여 1500자 내외의 논설문을 작성하시오. 구체적인 사례나 관찰을 포함하되 특정 개인을 식별할 수 있는 정보는 제외할 것.",
        "grading_criteria": {
          "A": { "name": "문제의식 및 주장의 명확성", "max_score": 20 },
          "B": { "name": "사회적 불평등 요인 분석의 깊이", "max_score": 20 },
          "C": { "name": "사례 또는 근거의 타당성", "max_score": 20 },
          "D": { "name": "논리적 구조와 흐름", "max_score": 20 },
          "E": { "name": "표현력 및 문장 완결성", "max_score": 20 }
        }
      },
      {
        "name": "논설문 쓰기 4: 온라인 여론 형성의 문제점 — 글쓰기 스킬 지정형 과제",
        "description": "온라인 여론 형성 과정에서 발생하는 편향·왜곡·감정적 확산 등의 문제를 다루어 1500자 내외의 논설문을 작성하시오. 글쓰기 전략으로 반드시 ‘반론 제시 → 재반박 → 대안 제안’ 구조를 사용할 것.",
        "grading_criteria": {
          "A": { "name": "쟁점 설정 및 주장 제시의 명확성", "max_score": 20 },
          "B": { "name": "반론 제시의 타당성", "max_score": 20 },
          "C": { "name": "재반박의 논리적 완성도", "max_score": 20 },
          "D": { "name": "대안 제시의 현실성 및 설득력", "max_score": 20 },
          "E": { "name": "문장력 및 논리 흐름의 일관성", "max_score": 20 }
        }
      }
    ]
  }
]


def seed_database():
    """
    데이터베이스를 초기화하고 가상 데이터를 생성합니다.
    """
    with app.app_context():
        print("기존 데이터베이스를 삭제하고 새로 생성합니다...")
        db.drop_all()
        db.create_all()

        try:
            # --- 1. 관리자 생성 (ID: 1) ---
            print(f"관리자 생성 중: {ADMIN_DATA['email']}")
            admin = User(
                email=ADMIN_DATA['email'],
                username=ADMIN_DATA['username'],
                role='ta'
            )
            admin.is_admin = True 
            admin.set_password(ADMIN_DATA['password'])
            admin.is_verified = True 
            db.session.add(admin)

            # --- 2. 학생 생성 (ID: 2 ~ 11) ---
            print(f"{len(STUDENT_DATA)}명의 학생 생성 중...")
            students_list = []
            for s_data in STUDENT_DATA:
                student = User(
                    email=s_data['email'],
                    username=s_data['username'],
                    role='student'
                )
                student.set_password(s_data['password'])
                student.is_verified = True 
                students_list.append(student)
            db.session.add_all(students_list)
            
            db.session.commit() # 사용자 먼저 커밋 (ID 확보)
            print("사용자 계정 생성 완료.")
            print(f"  - Admin ID: {admin.id}")
            print(f"  - Student IDs: {students_list[0].id} ~ {students_list[-1].id}")

            # --- 3. 과목 및 과제 생성 (ID: 1 ~ 16) ---
            print("과목 및 과제 생성, 수강 관계 설정 중...")
            total_assignments = 0
            
            # datetime 객체로 미리 파싱
            due_date_obj = datetime.fromisoformat(DUE_DATE_STR)

            for c_data in COURSES_DATA:
                new_course = Course(
                    course_code=c_data['code'], # (사용자 데이터 'code' 사용)
                    course_name=c_data['name']
                )
                new_course.assistants.append(admin)
                for student in students_list:
                    new_course.students.append(student)
                
                db.session.add(new_course)
                
                # (과제 루프)
                for assign_data in c_data['assignments']:
                    total_assignments += 1
                    
                    new_assignment = Assignment(
                        assignment_name=assign_data['name'],
                        course=new_course,
                        description=assign_data['description'],
                        grading_criteria=json.dumps(assign_data['grading_criteria']),
                        due_date=due_date_obj
                    )
                    db.session.add(new_assignment)
                    
            db.session.commit() # 과목 및 과제 커밋
            print(f"  - 과목 {len(COURSES_DATA)}개, 총 과제 {total_assignments}개 생성 완료.")


            # --- 4. [신규] CSV 파일에서 AnalysisReport 시딩 ---
            print(f"'{CSV_FILE_PATH}'에서 AnalysisReport 시딩 시작...")
            
            if not os.path.exists(CSV_FILE_PATH):
                print(f"  - [경고] CSV 파일 '{CSV_FILE_PATH}'을(를) 찾을 수 없습니다. Report 시딩을 건너뜁니다.")
                raise FileNotFoundError(f"{CSV_FILE_PATH} not found.")

            reports_to_add = []
            with open(CSV_FILE_PATH, mode='r', encoding='utf-8-sig') as file:
                reader = csv.DictReader(file)
                
                print(f"  - CSV 로드 완료. 임베딩 재생성 시작...")
                row_count = 0
                
                for row in reader:
                    row_count += 1
                    
                    # [수정 2] 올바른 try...except 구조
                    try:
                        # 1. summary(JSON 문자열)를 딕셔너리로 파싱
                        summary_dict = json.loads(row["summary"])
                        
                        # 2. 임베딩용 텍스트 생성
                        text_for_thesis = build_concat_text(
                            summary_dict.get('key_concepts', ''),
                            summary_dict.get('Core_Thesis', '')
                        )
                        text_for_claim = build_concat_text(
                            summary_dict.get('key_concepts', ''),
                            summary_dict.get('Claim', '')
                        )
                        
                        # 3. (신규) 384차원 임베딩 생성
                        vec_thesis = get_embedding_vector(text_for_thesis)
                        vec_claim = get_embedding_vector(text_for_claim)
                        
                        if not vec_thesis or not vec_claim:
                             print(f"  - [경고] {row_count}번째 행 임베딩 생성 실패. 건너뜀.")
                             continue

                        # 4. DB에 저장할 데이터 매핑
                        report_data = {
                            "user_id": int(row["user_id"]),
                            "assignment_id": int(row["assignment_id"]),
                            "report_title": row["report_title"],
                            "text_snippet": row["text_snippet"],
                            "status": row["status"],
                            "summary": row["summary"], # JSON 원본
                            "logic_flow": row["logic_flow"],
                            
                            # (신규) CSV값이 아닌 새로 생성한 384차원 벡터를 JSON 문자열로 저장
                            "embedding_keyconcepts_corethesis": json.dumps(vec_thesis),
                            "embedding_keyconcepts_claim": json.dumps(vec_claim),
                            
                            # [수정 3] 사용자가 요청한 대로 is_test=False로 설정
                            "is_test": False, 
                            
                            "high_similarity_candidates": json.dumps([]),
                            "qa_history": json.dumps([]),
                            "created_at": datetime.now()
                        }
                        
                        # [수정 4] try 블록 안으로 이동
                        new_report = AnalysisReport(**report_data)
                        reports_to_add.append(new_report)

                    # [수정 5] 누락된 except 블록 추가
                    except Exception as e_inner:
                        print(f"  - [오류] {row_count}번째 행 처리 중 오류: {e_inner}")
                        # (오류가 발생한 행의 summary 출력)
                        if "summary" in row:
                            print(f"    - problematic summary: {row['summary'][:50]}...")
                        else:
                            print(f"    - (Summary data missing in row)")


            # [수정 6] add_all과 commit은 루프 *밖*에 있어야 함 (이건 원래 잘 되어 있었음)
            print(f"  - 임베딩 생성 완료. DB에 {len(reports_to_add)}개 삽입 시도...")
            db.session.add_all(reports_to_add)
            db.session.commit() # 보고서 데이터 커밋
            print(f"  - 총 {len(reports_to_add)}개의 AnalysisReport를 DB에 추가했습니다.")

            print("\n[성공] 모든 데이터베이스 시딩 작업이 완료되었습니다.")

        except Exception as e:
            print(f"\n[오류] 시딩 작업 중 오류 발생: {e}")
            db.session.rollback()
            print("  - 작업이 롤백되었습니다.")
        
        finally:
            db.session.close()

# --- 스크립트 실행 ---
if __name__ == '__main__':
    seed_database()