#!/usr/bin/env bash
set -o errexit

echo "---- 1. 가상환경 생성 및 활성화 ----"
python -m venv venv
source venv/bin/activate

echo "---- 2. 패키지 설치 (PyTorch CPU 버전 포함) ----"
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

echo "---- 3. 한글 폰트 설치 ----"
mkdir -p ~/.fonts
# fonts 폴더의 모든 ttf 파일을 시스템 폰트 폴더로 복사
cp ./fonts/*.ttf ~/.fonts/
# 폰트 캐시 갱신
fc-cache -fv

echo "---- 4. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"