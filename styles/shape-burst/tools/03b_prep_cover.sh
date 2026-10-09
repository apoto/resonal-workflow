#!/bin/zsh
# カバー静止画 → 16:9(bg.png) と 9:16(bg_vertical.png) を public/ へ。
# Usage: tools/03b_prep_cover.sh <cover.(png|jpg)> <public_dir>
set -eu
IN="${1:?cover image}"; PUB="${2:?public dir}"
mkdir -p "$PUB"
ffmpeg -y -i "$IN" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" "$PUB/bg.png" -loglevel error
ffmpeg -y -i "$IN" -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" "$PUB/bg_vertical.png" -loglevel error
echo "[done] $PUB/bg.png + bg_vertical.png"
