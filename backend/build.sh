#!/usr/bin/env bash
set -o errexit

# [변경 1] 가상환경(venv) 제거
# Render는 기본적으로 Python 환경이 격리되어 있으므로 venv가 불필요합니다.
# 캐시는 Render가 pip 레벨에서 알아서 처리해줍니다.

echo "---- 1. 패키지 설치 (System-wide) ----"
pip install --upgrade pip
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

echo "---- 2. 한글 폰트 설치 및 강제 설정(Fonts.conf) ----"
# 폰트 폴더 준비
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p $FONT_DIR

# 폰트 복사
if [ -d "./fonts" ]; then
    cp ./fonts/*.ttf $FONT_DIR/
    echo " -> 폰트 파일 복사 완료"
else
    echo " -> [경고] 'fonts' 폴더가 없습니다."
fi

# [중요] fonts.conf 생성 (그대로 유지)
mkdir -p $HOME/.config/fontconfig
cat > $HOME/.config/fontconfig/fonts.conf <<EOL
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$HOME/.local/share/fonts</dir>
  <dir>$HOME/.fonts</dir>
  <cachedir>$HOME/.cache/fontconfig</cachedir>
</fontconfig>
EOL

# 캐시 갱신
fc-cache -f -v

echo "---- [Debug] 설치된 폰트 확인 ----"
fc-list :lang=ko

echo "---- 3. DB 마이그레이션 ----"
flask db upgrade

echo "Build Script Finished!"