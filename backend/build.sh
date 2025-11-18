#!/usr/bin/env bash
set -o errexit

echo "---- 1. 가상환경 생성 및 활성화 ----"
python -m venv venv
source venv/bin/activate

echo "---- 2. 패키지 설치 (PyTorch CPU 버전 포함) ----"
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

echo "---- 3. 한글 폰트 설치 및 캐시 갱신 ----"
# 리눅스 표준 사용자 폰트 경로 설정
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p $FONT_DIR

# ./fonts 폴더의 폰트를 시스템 경로로 복사
if [ -d "./fonts" ]; then
    cp ./fonts/*.ttf $FONT_DIR/
    echo " -> 폰트 파일 복사 완료: $FONT_DIR"
else
    echo " -> [경고] 'fonts' 폴더가 없습니다."
fi

# 폰트 캐시 강제 갱신
fc-cache -f -v

# [중요] 설치 확인: NanumGothic이 리스트에 뜨는지 확인
echo "---- [Debug] 설치된 폰트 확인 ----"
fc-list :lang=ko

echo "---- 4. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"