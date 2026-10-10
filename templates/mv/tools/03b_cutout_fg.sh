#!/usr/bin/env bash
# 前景 fg.png(16:9) / fg_vertical.png(9:16) を public/ へ。
# Usage: tools/03b_cutout_fg.sh <image> [--place] [public_dir=public]
#        tools/03b_cutout_fg.sh --none [public_dir=public]
#   既定      : カバーから被写体を切り抜き、bg と同じ crop で置く（背景と正確に重なる）。切り抜ける被写体が無ければ exit 3
#   --none    : 前景なし（透明の fg を置く。背景だけで見せる）
#   --place   : 立ち絵（キャラ画像）を下端中央に置く（背景はカバー、前にキャラが立つ）
#   画像が既に透過していれば切り抜かない。切り抜きは rembg の isnet-anime（ローカル実行）。
#   venv は REMBG_VENV（既定 ~/.venvs/rembg）に初回だけ作る。python 3.10〜3.12 が要る（onnxruntime の対応版）。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
if [ "${1:-}" = "--none" ]; then
  PUB="${2:-$PROJ/public}"; mkdir -p "$PUB"
  ffmpeg -v error -y -f lavfi -i "color=c=black@0:s=1920x1080,format=rgba" -frames:v 1 "$PUB/fg.png"
  ffmpeg -v error -y -f lavfi -i "color=c=black@0:s=1080x1920,format=rgba" -frames:v 1 "$PUB/fg_vertical.png"
  echo "[cutout] 前景なし（透明の fg）"
  exit 0
fi
IN="${1:?usage: 03b_cutout_fg.sh <image> [--place] [public_dir]}"; shift
PLACE=0; [ "${1:-}" = "--place" ] && { PLACE=1; shift; }
PUB="${1:-$PROJ/public}"
mkdir -p "$PUB"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/resonal-mv.XXXXXX")"; trap 'rm -rf "$TMP"' EXIT
CUT="$TMP/cutout.png"

# 透過の平均（255=不透明）。透過のない画像は format=rgba で 255 になる
ALPHA_AVG="$(ffmpeg -v error -i "$IN" -vf "format=rgba,alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - 2>/dev/null \
  | sed -n 's/.*YAVG=//p' | head -1)"
if awk -v a="${ALPHA_AVG:-255}" 'BEGIN{exit !(a < 245)}'; then
  echo "[cutout] 透過済みの画像＝切り抜かない"
  ffmpeg -v error -y -i "$IN" -pix_fmt rgba "$CUT"
else
  VENV="${REMBG_VENV:-$HOME/.venvs/rembg}"
  if [ ! -x "$VENV/bin/python" ]; then
    PY=""
    for c in python3.12 python3.11 python3.10; do command -v "$c" >/dev/null && { PY="$c"; break; }; done
    [ -n "$PY" ] || { echo "[NG] python3.10〜3.12 が必要（rembg が使う onnxruntime の対応版）" >&2; exit 2; }
    echo "[rembg] venv を作成: ${VENV}（初回のみ・数分）"
    "$PY" -m venv "$VENV"
    "$VENV/bin/pip" install --quiet --upgrade pip
    "$VENV/bin/pip" install --quiet "rembg[cpu]" pillow
  fi
  echo "[rembg] 切り抜き中（isnet-anime・初回はモデル取得 ~176MB）…"
  "$VENV/bin/python" - "$IN" "$CUT" <<'PY'
import sys
from rembg import remove, new_session
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
out = remove(im, session=new_session('isnet-anime'), post_process_mask=True)
out.save(sys.argv[2])
a = out.getchannel('A').histogram()
clear = sum(a[:32]) / max(1, sum(a))
print(f'  cutout {out.size} 透過 {clear*100:.1f}%')
if clear < 0.05 or clear > 0.97:
    print('[NG] 切り抜ける被写体が無い（透過率が極端）', file=sys.stderr)
    sys.exit(3)
PY
fi

if [ "$PLACE" = 1 ]; then
  # 画面の高さの 90% に収めて下端中央へ（横長の立ち絵でも幅 90% を超えない）
  place() { ffmpeg -v error -y -f lavfi -i "color=c=black@0:s=$1,format=rgba" -i "$CUT" \
    -filter_complex "[1]scale=$2:force_original_aspect_ratio=decrease[c];[0][c]overlay=(W-w)/2:H-h:format=auto,format=rgba" \
    -frames:v 1 "$3"; }
  place 1920x1080 1728:972 "$PUB/fg.png"
  place 1080x1920 972:1728 "$PUB/fg_vertical.png"
else
  ffmpeg -v error -y -i "$CUT" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -pix_fmt rgba "$PUB/fg.png"
  ffmpeg -v error -y -i "$CUT" -vf "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920" -pix_fmt rgba "$PUB/fg_vertical.png"
fi
for f in fg.png fg_vertical.png; do [ -s "$PUB/$f" ] || { echo "[NG] 出来ていない: $PUB/$f" >&2; exit 4; }; done
echo "[done] $PUB/fg.png + fg_vertical.png"
