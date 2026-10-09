#!/bin/zsh
# 書き出した mp4 の機械検査（04 の後に通す）。落ちたら非0で終わる。
# Usage: tools/07_verify.sh <song_dir> [project_dir]
# なぜ要るか: Remotion は容量不足だと無言で壊れた mp4 を吐く（前半だけデコード不能など、サムネや still では気づけない）。
set -eu
SONG="$(cd "${1:?song dir}" && pwd)"
PROJ="$(cd "${2:-$PWD}" && pwd)"
TITLE="$(basename "$SONG" | sed 's/^[0-9]*_//')"
MAIN="$SONG/${TITLE}.mp4"; SHORT="$SONG/${TITLE} (Short).mp4"; THUMB="$SONG/thumbnail.jpg"

fail=0
for f in "$MAIN" "$SHORT" "$THUMB"; do
  [ -f "$f" ] || { echo "[NG] 無い: $f" >&2; fail=1; }
done
[ "$fail" = "0" ] || exit 1

for f in "$MAIN" "$SHORT"; do
  n="$(ffmpeg -v error -i "$f" -f null - 2>&1 | wc -l | tr -d ' ')"
  [ "$n" = "0" ] && echo "[OK] デコード: $(basename "$f")" || { echo "[NG] デコードエラー ${n}行: $f" >&2; fail=1; }
done

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MAIN" | cut -d. -f1)"
for t in 3 $((DUR/4)) $((DUR/2)) $((DUR*3/4)) $((DUR-4)); do
  ffmpeg -v error -ss "$t" -i "$MAIN" -frames:v 1 -y "${TMPDIR:-/tmp}/_v7.png" 2>/dev/null \
    || { echo "[NG] ${t}s がデコードできない" >&2; fail=1; }
done
[ "$fail" = "0" ] && echo "[OK] 抜き取りシーク 5点"

B="$(ffmpeg -v error -i "$MAIN" -vf blackdetect=d=0.5:pix_th=0.06 -f null - 2>&1 | grep -c blackdetect || true)"
[ "$B" = "0" ] && echo "[OK] 意図しない黒落ちなし" || echo "[!!] 黒落ち ${B}件（意図した暗転なら無視可）"

python3 -c "import json,sys;c=json.load(open(sys.argv[1])).get('credits') or [];sys.exit(0 if c else 1)" "$PROJ/input/project.json" 2>/dev/null \
  && echo "[OK] クレジット（input/project.json の credits）" \
  || { echo "[NG] input/project.json の credits が空か読めない" >&2; fail=1; }

[ "$fail" = "0" ] || { echo "[NG] 検査に落ちた" >&2; exit 1; }
echo "[done] 検査すべて通過"
