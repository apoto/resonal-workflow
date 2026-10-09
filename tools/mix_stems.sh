#!/bin/bash
# 伴奏と自分の録音（歌・楽器）を1本に混ぜて audio.wav にする。本格的なミックス（EQ・コンプ・リバーブ）は DAW で。
# 使い方: tools/mix_stems.sh "<曲フォルダ>" <wav>[:ずらす秒[:音量dB]] ...
#   例:   tools/mix_stems.sh "songs/261004_My Song" stems/inst.wav stems/vocal.wav:0.120:-2 stems/guitar.wav:0:-6
#   ずらす秒は、その音源を後ろへずらす量（録音の頭が早いときに正の値）。パスは曲フォルダからの相対パスでもよい。
set -euo pipefail
[ $# -ge 2 ] || { sed -n '2,5p' "$0"; exit 2; }
SONG="$1"; shift
[ -d "$SONG" ] || { echo "[NG] 曲フォルダが無い: $SONG" >&2; exit 2; }
OUT="$SONG/audio.wav"
[ -e "$OUT" ] && cp "$OUT" "$SONG/audio.before-mix.wav" && echo "[keep] 今の audio.wav を audio.before-mix.wav に残した"

ins=(); filt=""; i=0
for spec in "$@"; do
  IFS=: read -r f off db <<<"$spec"
  [ -f "$f" ] || f="$SONG/$f"
  [ -f "$f" ] || { echo "[NG] 無い: $spec" >&2; exit 2; }
  off="${off:-0}"; db="${db:-0}"
  [[ "$off" =~ ^-?[0-9]+(\.[0-9]+)?$ && "$db" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] || { echo "[NG] ずらす秒・音量dB は数値で: $spec" >&2; exit 2; }
  ms=$(python3 -c 'import sys; print(max(0, int(round(float(sys.argv[1]) * 1000))))' "$off")
  ins+=(-i "$f")
  filt+="[$i:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}:all=1,volume=${db}dB[a$i];"
  echo "[in] $(basename "$f")  ずらす ${off}s  音量 ${db}dB"
  i=$((i+1))
done
mix=""; for k in $(seq 0 $((i-1))); do mix+="[a$k]"; done
# normalize=0: 足し算のまま混ぜる（自動で音量を下げない＝指定した dB がそのまま効く）
ffmpeg -v error -y "${ins[@]}" -filter_complex "${filt}${mix}amix=inputs=$i:normalize=0:duration=longest[m]" \
  -map "[m]" -ar 48000 -c:a pcm_s24le "$OUT"

[ -s "$OUT" ] || { echo "[NG] audio.wav ができていない" >&2; exit 1; }
peak=$(ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | awk '/Peak:/{p=$2} END{print p}')
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
echo "[done] $OUT  長さ ${dur}s  ピーク ${peak} dBFS"
if python3 -c "import sys; sys.exit(0 if float('$peak') > -0.1 else 1)"; then
  echo "[NG] 音割れしている（ピークが 0 dBFS 近い）。各音源の音量を下げてやり直す" >&2; exit 1
fi
