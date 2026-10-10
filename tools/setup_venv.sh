#!/usr/bin/env bash
# whisper（歌詞の時刻取り）・numpy（テンポの推定）・Pillow（画像の加工）を、このワークフロー専用の箱（Python の venv）に入れる。
# パソコン全体の Python には入れない（ほかの道具とぶつからない・消すときはフォルダごと消せる）。
# 置き場: .env の WORKFLOW_VENV（既定 ~/.venvs/resonal-workflow）。容量は約1〜2GB（whisper が使う torch を含む）。
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${WORKFLOW_VENV:-$(sed -n 's/^WORKFLOW_VENV=//p' "$REPO/.env" 2>/dev/null | tr -d '"' | tail -1)}"
VENV="${VENV:-$HOME/.venvs/resonal-workflow}"
PY=""
for c in python3.12 python3.11 python3.10 python3; do command -v "$c" >/dev/null && { PY="$c"; break; }; done
[ -n "$PY" ] || { echo "[NG] python3 が無い（brew install python@3.12）" >&2; exit 2; }
if [ ! -x "$VENV/bin/python" ]; then
  echo "[venv] 作成: ${VENV}（$("$PY" --version)）"
  mkdir -p "$(dirname "$VENV")"
  "$PY" -m venv "$VENV"
fi
"$VENV/bin/python" -m pip install --quiet --upgrade pip
"$VENV/bin/python" -m pip install --quiet numpy pillow openai-whisper
"$VENV/bin/python" -c 'import numpy, whisper; print("[OK] numpy", numpy.__version__, "/ whisper", whisper.__version__)'
[ -x "$VENV/bin/whisper" ] || { echo "[NG] whisper コマンドが入っていない: $VENV/bin/whisper" >&2; exit 1; }
du -sh "$VENV" | awk '{print "[OK] 置き場の容量: " $1}'
