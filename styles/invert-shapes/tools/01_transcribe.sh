#!/bin/zsh
# 歌詞タイミング取得: 音源 → 16k mono wav → whisper(ja, word timestamps)
# Usage: tools/01_transcribe.sh <song_audio(mp3/wav)> <out_dir>
# 依存: ffmpeg, whisper (openai-whisper CLI)。モデル置き場を変えるなら WHISPER_MODEL_DIR。
set -eu
AUDIO="${1:?song audio path}"; OUT="${2:?out dir}"
mkdir -p "$OUT"
ffmpeg -y -i "$AUDIO" -ar 16000 -ac 1 "$OUT/audio_16k.wav" -loglevel error
echo "[whisper] transcribing (medium, ja)…"
whisper "$OUT/audio_16k.wav" --language ja --model medium --word_timestamps True \
  --output_format json --output_dir "$OUT" ${WHISPER_MODEL_DIR:+--model_dir "$WHISPER_MODEL_DIR"} --fp16 False
echo "[done] segments JSON in $OUT (use segment start/end to author input/lyrics.json)"
