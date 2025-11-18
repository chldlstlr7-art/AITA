#!/usr/bin/env bash
set -o errexit

echo "---- 1. 가상환경 생성 및 활성화 (캐시 활용) ----"
if [ ! -d "venv" ]; then
    python -m venv venv
fi
source venv/bin/activate

echo "---- 2. 패키지 설치 (PyTorch CPU 버전 포함) ----"
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

echo "---- 3. 한글 폰트 설치 (모든 경로에 복사) ----"

# 1) 신형 표준 경로
DIR_NEW="$HOME/.local/share/fonts"
mkdir -p $DIR_NEW

# 2) 구형 호환 경로 (Plotly/Kaleido 구버전 대비)
DIR_OLD="$HOME/.fonts"
mkdir -p $DIR_OLD

if [ -d "./fonts" ]; then
    # 양쪽 다 복사
    cp ./fonts/*.ttf $DIR_NEW/
    cp ./fonts/*.ttf $DIR_OLD/
    echo " -> 폰트 파일 복사 완료 (New & Old paths)"
else
    echo " -> [경고] 'fonts' 폴더가 없습니다."
fi

# 폰트 캐시 갱신
fc-cache -f -v

# [중요] 어떤 이름으로 등록되었는지 확인
echo "---- [Debug] 등록된 폰트 이름 확인 ----"
fc-list :lang=ko

echo "---- 4. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"