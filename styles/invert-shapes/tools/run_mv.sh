#!/bin/zsh
# レンダー → 検査 を1本で走り切らせる（繋ぐだけ。レンダーは 04_render.sh、検査は 07_verify.sh）。
# Usage: tools/run_mv.sh <song_dir>
set -eu
SONG="$(cd "${1:?song dir}" && pwd)"
PROJ="$(cd "$(dirname "$0")/.." && pwd)"

FREE_GB="$(df -g "$PROJ" | awk 'NR==2{print $4}')"
[ "${FREE_GB:-0}" -ge 15 ] || { echo "[NG] 空き ${FREE_GB}GB（1080p/3分台は15GB以上必要）" >&2; exit 1; }

"$PROJ/tools/04_render.sh" "$PROJ" "$SONG"
"$PROJ/tools/07_verify.sh" "$SONG" "$PROJ"
echo "[done] レンダー→検査 完了"
