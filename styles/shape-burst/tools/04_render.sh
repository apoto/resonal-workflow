#!/bin/zsh
# 本編(16:9)＋ショート(9:16)＋サムネを render し、720p プレビューも作る。
# Usage: tools/04_render.sh [out_dir=out] [title=main]
#   出力: <out_dir>/<title>.mp4 / <title> (Short).mp4 / thumbnail.jpg / <title>_preview_720p.mp4
set -eu
cd "$(dirname "$0")/.."
OUT="${1:-out}"; TITLE="${2:-main}"
mkdir -p "$OUT"
echo "=== ShortVideo ==="; npx remotion render ShortVideo "$OUT/${TITLE} (Short).mp4" --log=error
echo "=== LyricVideo ==="; npx remotion render LyricVideo "$OUT/${TITLE}.mp4" --log=error
echo "=== Thumbnail ==="; npx remotion still Thumbnail "$OUT/thumbnail.jpg" --quality=92 --log=error
ffmpeg -y -i "$OUT/${TITLE}.mp4" -vf "scale=1280:720" -c:v libx264 -crf 26 -preset veryfast -c:a aac -b:a 128k "$OUT/${TITLE}_preview_720p.mp4" -loglevel error
echo "[done] $OUT/${TITLE}.mp4 / ${TITLE} (Short).mp4 / thumbnail.jpg / ${TITLE}_preview_720p.mp4"
