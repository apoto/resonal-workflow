#!/usr/bin/env bash
# 歌詞タイミング取得: 音源 → 16k mono wav → whisper（word timestamps）→ <曲>/transcribe/audio_16k.json
# Usage: tools/01_transcribe.sh <song_dir> [ja|en|auto]
#   既に audio_16k.json があればスキップ（whisper は重い。やり直すときは transcribe/ を消す）。
#   音源は <Title>.wav（マスター）→ audio.wav の順に探す。尺は同じなので語の秒はどちらでも使える。
#   言語は song.json の lyrics_lang → config の lyricsLang（第2引数で上書き）。英語詞を ja で転写すると語の秒が崩れる。
#   モデルは WHISPER_MODEL（既定 medium）。置き場を変えるなら WHISPER_MODEL_DIR。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 01_transcribe.sh <song_dir> [lang]}")"
TITLE="$(song_title "$SONG")"
OUT="$SONG/transcribe"
if [ -s "$OUT/audio_16k.json" ]; then echo "[skip] 転写済み: $OUT/audio_16k.json"; exit 0; fi
command -v whisper >/dev/null || { echo "[NG] whisper が無い（pip install openai-whisper）" >&2; exit 2; }

AUDIO=""
for c in "$SONG/$TITLE.wav" "$SONG/audio.wav"; do [ -s "$c" ] && { AUDIO="$c"; break; }; done
[ -n "$AUDIO" ] || { echo "[NG] 音源が無い: $SONG/$TITLE.wav も $SONG/audio.wav も無い" >&2; exit 1; }

LANG_CODE="${2:-}"
if [ -z "$LANG_CODE" ]; then
  LANG_CODE="$(node -e 'try{const j=require(process.argv[1]);console.log(j.lyrics_lang||"")}catch{console.log("")}' "$SONG/song.json")"
  [ -n "$LANG_CODE" ] || LANG_CODE="$(cfg lyricsLang ja)"
fi
ARGS=(--model "${WHISPER_MODEL:-medium}" --word_timestamps True --output_format json --output_dir "$OUT" --fp16 False)
[ "$LANG_CODE" = "auto" ] || ARGS+=(--language "$LANG_CODE")
[ -z "${WHISPER_MODEL_DIR:-}" ] || ARGS+=(--model_dir "$WHISPER_MODEL_DIR")

mkdir -p "$OUT"
ffmpeg -v error -y -i "$AUDIO" -ar 16000 -ac 1 "$OUT/audio_16k.wav"
echo "[whisper] $(basename "$AUDIO") (model=${WHISPER_MODEL:-medium}, language=$LANG_CODE)…"
whisper "$OUT/audio_16k.wav" "${ARGS[@]}"
# whisper はモデル取得に失敗しても 0 を返すことがある＝成果物を見てから成功とする
[ -s "$OUT/audio_16k.json" ] || { echo "[NG] $OUT/audio_16k.json が出来ていない" >&2; exit 4; }
echo "[done] $OUT/audio_16k.json"
