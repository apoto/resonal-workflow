#!/usr/bin/env bash
# カバー静止画 → 16:9(bg.png) と 9:16(bg_vertical.png) を public/ へ。
# Usage: tools/03a_prep_cover.sh <cover.(png|jpg)> [public_dir=public] [name=bg]
#   name を変えると <name>.png / <name>_vertical.png に書く（シーンの背景 scene_01 など）
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
IN="${1:?usage: 03a_prep_cover.sh <cover image> [public_dir] [name]}"; PUB="${2:-$PROJ/public}"; NAME="${3:-bg}"
mkdir -p "$PUB"
ffmpeg -v error -y -i "$IN" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" "$PUB/$NAME.png"
# 縦は中央を 9:16 で切り出す（03b の fg_vertical.png と同じ crop＝前後が正確に重なる）
ffmpeg -v error -y -i "$IN" -vf "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920" "$PUB/${NAME}_vertical.png"
for f in "$NAME.png" "${NAME}_vertical.png"; do [ -s "$PUB/$f" ] || { echo "[NG] 出来ていない: $PUB/$f" >&2; exit 4; }; done
echo "[done] $PUB/$NAME.png + ${NAME}_vertical.png"
