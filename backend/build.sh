#!/usr/bin/env bash
set -o errexit

# Render 프로젝트 루트 (절대 경로)
PROJECT_ROOT="/opt/render/project/src"

echo "---- 1. 패키지 설치 ----"
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

echo "---- 2. 폰트 설정 (Absolute Path Strategy) ----"

# 1) 폰트 타겟 폴더 생성
TARGET_FONT_DIR="$PROJECT_ROOT/fonts_installed"
mkdir -p "$TARGET_FONT_DIR"

# 2) 폰트 원본 찾기 & 복사 (루트와 backend 폴더 모두 탐색)
# 로그를 보니 'fonts' 폴더가 있긴 한데 스크립트가 못 찾았으므로, 강제로 찾습니다.
echo " -> 폰트 파일 탐색 및 복사 중..."

# Case A: 루트에 있는 경우
if [ -d "$PROJECT_ROOT/fonts" ]; then
    cp $PROJECT_ROOT/fonts/*.ttf "$TARGET_FONT_DIR/" 2>/dev/null || true
    echo " -> 루트 fonts 폴더에서 복사 시도 완료."
fi

# Case B: backend 폴더 안에 있는 경우 (혹시 몰라서 추가)
if [ -d "$PROJECT_ROOT/backend/fonts" ]; then
    cp $PROJECT_ROOT/backend/fonts/*.ttf "$TARGET_FONT_DIR/" 2>/dev/null || true
    echo " -> backend/fonts 폴더에서 복사 시도 완료."
fi

# 3) fonts.conf 생성 (무조건 루트에 생성)
# 시스템이 $TARGET_FONT_DIR 를 바라보게 설정
cat > "$PROJECT_ROOT/fonts.conf" <<EOL
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$TARGET_FONT_DIR</dir>
  <cachedir>$PROJECT_ROOT/.fontcache</cachedir>
</fontconfig>
EOL
echo " -> fonts.conf 생성 완료: $PROJECT_ROOT/fonts.conf"

# 4) 캐시 갱신 (타겟 폴더 기준)
mkdir -p "$PROJECT_ROOT/.fontcache"
echo " -> 폰트 캐시 갱신 중..."
fc-cache -f -v "$TARGET_FONT_DIR"

# 5) 확인
echo "---- [Debug] 최종 설치된 폰트 확인 (fc-list) ----"
# 환경 변수를 임시로 주입해서 잘 읽히는지 테스트
export FONTCONFIG_FILE="$PROJECT_ROOT/fonts.conf"
fc-list :lang=ko

echo "---- 3. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"