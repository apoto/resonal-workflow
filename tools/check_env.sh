#!/usr/bin/env bash
# 道具がそろっているかを一覧する（インストールはしない）。足りないものは入れ方を1行で出す。
# Usage: tools/check_env.sh
# exit: 0=必須がそろっている / 1=必須が足りない（任意の道具は数えない）
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
REMBG_VENV="${REMBG_VENV:-$(sed -n 's/^REMBG_VENV=//p' "$REPO/.env" 2>/dev/null | tr -d '"' | tail -1)}"   # 端末ごとの置き場（.env.example）
WORKFLOW_VENV="${WORKFLOW_VENV:-$(sed -n 's/^WORKFLOW_VENV=//p' "$REPO/.env" 2>/dev/null | tr -d '"' | tail -1)}"
WV="${WORKFLOW_VENV:-$HOME/.venvs/resonal-workflow}"
missing=0

row() { # <OK|NG|--> <名前> <説明 or 入れ方>
  printf '  %-3s %-16s %s\n' "$1" "$2" "$3"
}
need() { # <名前> <確認コマンド> <入れ方>（必須）
  if eval "$2" >/dev/null 2>&1; then row OK "$1" "$(eval "$2" 2>/dev/null | head -1)"
  else row NG "$1" "$3"; missing=1; fi
}
opt() { # <名前> <確認コマンド> <入れ方>（任意）
  if eval "$2" >/dev/null 2>&1; then row OK "$1" "$(eval "$2" 2>/dev/null | head -1)"
  else row -- "$1" "（任意）$3"; fi
}

echo "必須"
need node    'node -v'                                   'https://nodejs.org から LTS を入れる（brew install node）'
need python3 'python3 --version'                         'https://www.python.org から入れる（brew install python）'
need numpy   '"$WV/bin/python" -c "import numpy;print(\"numpy \"+numpy.__version__)"' './tools/setup_venv.sh（専用の箱に入れる。全体の Python には入れない）'
need ffmpeg  'ffmpeg -version | head -1 | cut -d" " -f1-3' 'brew install ffmpeg（Windows は winget install ffmpeg）'
need whisper '"$WV/bin/whisper" --help >/dev/null && echo "$WV/bin/whisper"' './tools/setup_venv.sh（同上）'

echo ""
echo "MV（Remotion / 切り抜き）"
REMBG_PY="${REMBG_VENV:-$HOME/.venvs/rembg}/bin/python"
if [ -x "$REMBG_PY" ] && "$REMBG_PY" -c 'import rembg' >/dev/null 2>&1; then row OK rembg "$REMBG_PY"
elif command -v python3.12 >/dev/null || command -v python3.11 >/dev/null || command -v python3.10 >/dev/null; then
  row -- rembg "初回の MV で自動で venv を作る（透過済みの立ち絵だけ使うなら不要）"
else
  row NG rembg "python 3.10〜3.12 を入れる（brew install python@3.12）。透過済みの立ち絵だけ使うなら不要"
fi
if ls -d "$REPO"/projects/*/node_modules/remotion >/dev/null 2>&1; then
  row OK Remotion "npm install 済み"
else
  row -- Remotion "準備は不要（初回の tools/make_mv.sh が曲のプロジェクトに npm install する）"
fi

echo ""
if [ ! -f "$REPO/workflow.config.json" ]; then
  echo "任意（外部サービスはセットアップで選ぶ。まだ workflow.config.json が無い＝未設定）"
  echo ""; [ "$missing" = 0 ] && echo "必須はそろっている" || echo "NG の行を入れてから、もう一度 tools/check_env.sh"; exit "$missing"
fi
echo "任意（workflow.config.json の providers で選んだものだけ要る）"
P="$(node "$REPO/engine/config.js" providers 2>/dev/null || echo '{}')"
use() { node -e 'const p=JSON.parse(process.argv[1]);process.stdout.write((p[process.argv[2]]||{}).use||"")' "$P" "$1"; }
row "  " music  "providers.music=$(use music)（音源は人が生成して audio.wav を置く）"
if [ "$(use image)" = codex ]; then opt codex 'command -v codex' 'npm install -g @openai/codex → codex login（カバー画像の生成）'
else row "  " image "providers.image=$(use image)"; fi
row "  " video  "providers.video=$(use video)（kling-mcp は AI のクライアントに Kling MCP をつなぐ）"
if [ "$(use notify)" = slack ]; then
  opt jq 'command -v jq' 'brew install jq（Slack 配信に使う）'
  if [ -s "$REPO/.env" ] && grep -q '^SLACK_BOT_TOKEN=.' "$REPO/.env"; then row OK Slack ".env に SLACK_BOT_TOKEN あり"
  else row -- Slack ".env.example を .env にコピーして SLACK_BOT_TOKEN / SLACK_CHANNEL_ID を書く"; fi
else row "  " notify "providers.notify=$(use notify)"; fi

echo ""
if [ "$missing" = 0 ]; then echo "必須はそろっている"; else echo "NG の行を入れてから、もう一度 tools/check_env.sh"; fi
exit "$missing"
