#!/usr/bin/env bash
# 本編(16:9)＋ショート(9:16)＋サムネを曲フォルダへ規約名で書き出す。
# Usage: tools/05_render.sh <song_dir>
#   出力: <song>/<Title>.mp4 / <Title> (Short).mp4 / thumbnail.jpg
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 05_render.sh <song_dir>}")"
TITLE="$(song_title "$SONG")"
cd "$PROJ"
[ -d node_modules ] || { echo "[NG] node_modules が無い（npm install）" >&2; exit 2; }

"$PROJ/tools/00_project.sh" "$SONG"

# 音源はマスター（<Title>.wav）。あれば public/ へ同期＝仮音源のままレンダーしない
AUDIO_NAME="$(node -e 'console.log(require(process.argv[1]).meta.audio)' "$PROJ/input/lyrics.json")"
case "$AUDIO_NAME" in */*|..*|"") echo "[NG] lyrics.json の meta.audio はファイル名だけにする: $AUDIO_NAME" >&2; exit 2;; esac
META_DUR="$(node -e 'console.log(require(process.argv[1]).meta.duration)' "$PROJ/input/lyrics.json")"
mkdir -p public
if [ -s "$SONG/$TITLE.wav" ]; then
  cmp -s "$SONG/$TITLE.wav" "public/$AUDIO_NAME" || { cp "$SONG/$TITLE.wav" "public/$AUDIO_NAME"; echo "[OK] マスターを public/$AUDIO_NAME へ同期"; }
else
  echo "[NG] マスター $TITLE.wav が無い（先にマスタリング）" >&2; exit 1
fi
[ -s "public/$AUDIO_NAME" ] || { echo "[NG] public/$AUDIO_NAME が無い" >&2; exit 1; }
for f in bg.png bg_vertical.png fg.png fg_vertical.png; do
  [ -s "public/$f" ] || { echo "[NG] public/$f が無い（03a / 03b を先に）" >&2; exit 1; }
done

# 尺ガード: 音源の尺は編集しない前提。meta.duration が実音源とズレていたら尾が切れる／無音が続く
A_DUR="$(media_dur "public/$AUDIO_NAME")"
awk -v a="$A_DUR" -v m="$META_DUR" 'BEGIN{ d=a-m; if (d<0) d=-d; exit !(d<=0.5) }' \
  || { echo "[NG] meta.duration=${META_DUR}s が音源の実尺 ${A_DUR}s と 0.5 秒以上違う（04 を再実行して合わせる）" >&2; exit 4; }

# 出力を「実在＋尺が想定どおり」まで検査してから次へ（レンダラは素材欠けでも 0 を返すことがある）
need() {
  local f="$1" min="$2" d
  [ -s "$f" ] || { echo "[NG] 出来ていない: $f" >&2; exit 4; }
  d="$(media_dur "$f")"
  awk -v d="$d" -v m="$min" 'BEGIN{ exit !(d+0 >= m+0) }' \
    || { echo "[NG] 尺が短い: $f (${d}s < ${min}s)＝レンダーが途中で落ちている" >&2; exit 4; }
}
echo "=== ShortVideo ==="; npx remotion render ShortVideo "$SONG/$TITLE (Short).mp4" --log=error
need "$SONG/$TITLE (Short).mp4" 5
echo "=== LyricVideo ==="; npx remotion render LyricVideo "$SONG/$TITLE.mp4" --log=error
need "$SONG/$TITLE.mp4" "$(awk -v m="$META_DUR" 'BEGIN{print m-0.5}')"
echo "=== Thumbnail ==="; npx remotion still Thumbnail "$SONG/thumbnail.jpg" --jpeg-quality=92 --log=error
[ -s "$SONG/thumbnail.jpg" ] || { echo "[NG] thumbnail.jpg が出来ていない" >&2; exit 4; }
echo "[done] $SONG/$TITLE.mp4 / $TITLE (Short).mp4 / thumbnail.jpg"
