#!/usr/bin/env bash
set -o errexit

# 1. 패키지 설치
echo "---- 1. 패키지 설치 ----"
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# 2. 폰트 설정 (시스템 폴더가 아닌 프로젝트 폴더 사용)
echo "---- 2. 폰트 설정 (Project Local) ----"

# Render의 프로젝트 루트 경로 (절대 경로)
PROJECT_ROOT="/opt/render/project/src"
FONT_DIR="$PROJECT_ROOT/fonts"

# fonts 폴더가 있는지 확인
if [ -d "$FONT_DIR" ]; then
    echo " -> 폰트 폴더 확인됨: $FONT_DIR"
else
    echo " -> [오류] fonts 폴더가 없습니다! Git에 포함되었는지 확인하세요."
    # 폴더가 없으면 만들어라도 둡니다 (에러 방지)
    mkdir -p $FONT_DIR
fi

# [핵심] fonts.conf를 프로젝트 루트에 생성 (사라짐 방지)
# 그리고 폰트 경로도 프로젝트 내의 /fonts 폴더를 바라보게 함
cat > $PROJECT_ROOT/fonts.conf <<EOL
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$FONT_DIR</dir>
  <cachedir>$PROJECT_ROOT/.fontcache</cachedir>
</fontconfig>
EOL
echo " -> fonts.conf 생성 완료: $PROJECT_ROOT/fonts.conf"

# 캐시 생성 (권한 문제없음)
mkdir -p $PROJECT_ROOT/.fontcache
echo " -> 폰트 캐시 갱신 중..."
fc-cache -f -v $FONT_DIR

# 확인
echo "---- [Debug] 폰트 리스트 확인 ----"
fc-list :lang=ko

# 3. DB 마이그레이션
echo "---- 3. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"