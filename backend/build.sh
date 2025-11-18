#!/usr/bin/env bash
set -o errexit

# 1. 패키지 설치 (가상환경 없이 시스템 레벨 설치)
echo "---- 1. 패키지 설치 ----"
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# 2. 폰트 설치 및 설정
echo "---- 2. 한글 폰트 설치 및 설정 ----"

# 폰트 경로 설정
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p $FONT_DIR

# 폰트 파일 복사
if [ -d "./fonts" ]; then
    cp ./fonts/*.ttf $FONT_DIR/
    echo " -> 폰트 파일 복사 완료: $FONT_DIR"
else
    echo " -> [경고] 'fonts' 폴더가 없습니다."
fi

# fonts.conf 생성 (Plotly가 경로를 무시하지 못하도록 강제)
mkdir -p $HOME/.config/fontconfig
cat > $HOME/.config/fontconfig/fonts.conf <<EOL
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$FONT_DIR</dir>
  <cachedir>$HOME/.cache/fontconfig</cachedir>
</fontconfig>
EOL

# [핵심 수정] 전체 스캔(-f -v) 대신, 내 폴더만 콕 집어서 스캔합니다.
# 이렇게 하면 권한 없는 시스템 폴더(/usr/share/fonts)를 건드리지 않아 에러가 안 납니다.
echo " -> 폰트 캐시 갱신 중..."
fc-cache -f -v $FONT_DIR

# 설치 확인
echo "---- [Debug] 설치된 폰트 확인 ----"
fc-list :lang=ko

# 3. DB 마이그레이션
echo "---- 3. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"