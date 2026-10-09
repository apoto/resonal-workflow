#!/usr/bin/env bash
# 背景ループ動画（任意）→ public/bg_loop.mp4（16:9 1920x1080）と bg_loop_vertical.mp4（9:16 1080x1920）。30fps・音声なし。
# Usage: tools/03c_prep_loop.sh <song_dir> [public_dir=public]
#   <曲>/bg_loop.mp4 が無ければ public/ の古いループを消して終わる（背景は bg.png の静止画に戻る）。
#   縦は <曲>/bg_loop_vertical.mp4 があればそれを、無ければ横の中央を 9:16 で切り出す（03a の bg_vertical.png と同じ切り方）。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 03c_prep_loop.sh <song_dir> [public_dir]}")"; PUB="${2:-$PROJ/public}"
mkdir -p "$PUB"
if [ ! -s "$SONG/bg_loop.mp4" ]; then
  rm -f "$PUB/bg_loop.mp4" "$PUB/bg_loop_vertical.mp4"
  echo "[skip] bg_loop.mp4 なし（背景は静止画）"; exit 0
fi
ENC=(-an -r 30 -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -movflags +faststart)
ffmpeg -v error -y -i "$SONG/bg_loop.mp4" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" "${ENC[@]}" "$PUB/bg_loop.mp4" </dev/null
if [ -s "$SONG/bg_loop_vertical.mp4" ]; then
  ffmpeg -v error -y -i "$SONG/bg_loop_vertical.mp4" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" "${ENC[@]}" "$PUB/bg_loop_vertical.mp4" </dev/null
else
  ffmpeg -v error -y -i "$SONG/bg_loop.mp4" -vf "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920" "${ENC[@]}" "$PUB/bg_loop_vertical.mp4" </dev/null
fi
for f in bg_loop.mp4 bg_loop_vertical.mp4; do
  d="$(media_dur "$PUB/$f")"
  awk -v d="$d" 'BEGIN{ exit !(d+0 >= 1) }' || { echo "[NG] $PUB/$f が読めない／1秒未満" >&2; exit 4; }
done
echo "[done] $PUB/bg_loop.mp4 + bg_loop_vertical.mp4"
