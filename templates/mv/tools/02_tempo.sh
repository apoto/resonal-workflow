#!/usr/bin/env bash
# 駆動信号とビートグリッドを実測で作る。
#   input/energy.json … 02_energy.py（セクション強度 sec / 打点 hit）
#   input/tempo.json  … 区間別 BPM・位相（02_estimate_tempo.py）
#   input/beats.json  … 上をつないだ拍グリッド（src/engine/beats.ts が読む）
# Usage: tools/02_tempo.sh <song_dir> [--sections 0,26.7,...] [--bpm MIN MAX]
#   第2引数以降は 02_estimate_tempo.py にそのまま渡す（BRIEF の BPM ±10 程度に絞ると速く確実）。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 02_tempo.sh <song_dir> [estimate options]}")"; shift
TITLE="$(song_title "$SONG")"
AUDIO=""
for c in "$SONG/$TITLE.wav" "$SONG/audio.wav"; do [ -s "$c" ] && { AUDIO="$c"; break; }; done
[ -n "$AUDIO" ] || { echo "[NG] 音源が無い: $SONG/$TITLE.wav も $SONG/audio.wav も無い" >&2; exit 1; }

FPS="$(node -e 'console.log(require(process.argv[1]).meta.fps||30)' "$PROJ/input/lyrics.json")"
python3 "$PROJ/tools/02_energy.py" "$AUDIO" "$PROJ/input/energy.json" --fps "$FPS"
python3 "$PROJ/tools/02_estimate_tempo.py" "$AUDIO" --out "$PROJ/input/tempo.json" --beats "$PROJ/input/beats.json" "$@"
[ -s "$PROJ/input/beats.json" ] || { echo "[NG] input/beats.json が出来ていない" >&2; exit 4; }
echo "[done] input/energy.json / tempo.json / beats.json（区間で BPM が変わる曲は tempo.json を見て演出の秒を決める）"
