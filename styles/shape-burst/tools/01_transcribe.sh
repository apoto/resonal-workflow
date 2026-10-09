#!/bin/zsh
# 歌詞タイミング取得: 音源 → 16k mono wav → whisper(word timestamps)
# Usage: tools/01_transcribe.sh <song_audio(mp3/wav)> <out_dir> [lang=ja]
#   出力: <out_dir>/audio_16k.json（06_build_lyrics.py --words に渡す）
# 依存: ffmpeg, whisper (openai-whisper CLI)。モデル置き場は WHISPER_MODEL_DIR（既定 ~/.cache/whisper）
set -eu
AUDIO="${1:?song audio path}"; OUT="${2:?out dir}"; LANG_="${3:-ja}"
mkdir -p "$OUT"
ffmpeg -y -i "$AUDIO" -ar 16000 -ac 1 "$OUT/audio_16k.wav" -loglevel error
echo "[whisper] transcribing (${WHISPER_MODEL:-medium}, $LANG_)…"
whisper "$OUT/audio_16k.wav" --language "$LANG_" --model "${WHISPER_MODEL:-medium}" --word_timestamps True \
  --output_format json --output_dir "$OUT" --model_dir "${WHISPER_MODEL_DIR:-$HOME/.cache/whisper}" --fp16 False
echo "[done] $OUT/audio_16k.json"
