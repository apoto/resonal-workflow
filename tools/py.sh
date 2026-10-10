#!/usr/bin/env bash
# 専用の箱（tools/setup_venv.sh が作る venv）の python でスクリプトを動かす。numpy・Pillow・whisper を使うものはこれ経由で呼ぶ。
# 例: ./tools/py.sh templates/mv/tools/02_estimate_tempo.py "songs/<曲>/<Title>.wav"
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${WORKFLOW_VENV:-$(sed -n 's/^WORKFLOW_VENV=//p' "$REPO/.env" 2>/dev/null | tr -d '"' | tail -1)}"
VENV="${VENV:-$HOME/.venvs/resonal-workflow}"
[ -x "$VENV/bin/python" ] || { echo "[NG] 専用の箱が無い: ${VENV}（./tools/setup_venv.sh を先に）" >&2; exit 2; }
exec "$VENV/bin/python" "$@"
