#!/bin/zsh
# 書き出し物の機械検査（04 の後に通す）。落ちたら非0で終わる。
# Usage: tools/07_verify.sh [out_dir=out] [title=main]
# Remotion は容量不足だと無言で壊れた mp4 を吐くことがある＝デコード全走査と抜き取りシークで確かめる。
set -eu
cd "$(dirname "$0")/.."
OUT="${1:-out}"; TITLE="${2:-main}"
MAIN="$OUT/${TITLE}.mp4"; SHORT="$OUT/${TITLE} (Short).mp4"; THUMB="$OUT/thumbnail.jpg"
TMP="$(mktemp -d)"

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
  ffmpeg -v error -ss "$t" -i "$MAIN" -frames:v 1 -y "$TMP/_v7.png" 2>/dev/null \
    || { echo "[NG] ${t}s がデコードできない" >&2; fail=1; }
done
[ "$fail" = "0" ] && echo "[OK] 抜き取りシーク 5点"

B="$(ffmpeg -v error -i "$MAIN" -vf blackdetect=d=0.5:pix_th=0.06 -f null - 2>&1 | grep -c blackdetect || true)"
[ "$B" = "0" ] && echo "[OK] 意図しない黒落ちなし" || echo "[!!] 黒落ち ${B}件（意図した暗転なら無視可）"

rm -rf "$TMP"
[ "$fail" = "0" ] || { echo "[NG] 検査に落ちた" >&2; exit 1; }
echo "[done] 検査すべて通過"
