#!/bin/zsh
# 本編(16:9)＋ショート(9:16)＋サムネを render し、720p プレビューも作る。
# Usage: tools/04_render.sh <project_dir> <song_dir>
#   project_dir: この Remotion プロジェクト（npm i 済み）
#   song_dir:    出力先（例 ../../songs/My Song）。フォルダ名の先頭の「数字_」は外して Title にする
set -eu
PROJ="${1:?project dir}"; SONG="${2:?song out dir}"
TITLE="$(basename "$SONG" | sed 's/^[0-9]*_//')"
cd "$PROJ"
echo "=== ShortVideo ==="; npx remotion render ShortVideo "$SONG/${TITLE} (Short).mp4" --log=error
echo "=== LyricVideo ==="; npx remotion render LyricVideo "$SONG/${TITLE}.mp4" --log=error
echo "=== Thumbnail ==="; npx remotion still Thumbnail "$SONG/thumbnail.jpg" --quality=92 --log=error
mkdir -p out
ffmpeg -y -i "$SONG/${TITLE}.mp4" -vf "scale=1280:720" -c:v libx264 -crf 26 -preset veryfast -c:a aac -b:a 128k "out/${TITLE}_preview_720p.mp4" -loglevel error
echo "[done] $SONG/${TITLE}.mp4 / ${TITLE} (Short).mp4 / thumbnail.jpg  + out/${TITLE}_preview_720p.mp4"
