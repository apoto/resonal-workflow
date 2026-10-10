# 番号スクリプト共通の解決処理（source して使う）。
#   PROJ  = この MV プロジェクト（tools/ の親）
#   REPO  = リポジトリ直下（engine/config.js がある場所）
# shellcheck shell=bash
PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$PROJ" rev-parse --show-toplevel 2>/dev/null || true)"
# git 管理外で使われても動くよう、projects/<slug>（templates/mv）の2階層上にフォールバック
[ -n "$REPO" ] && [ -f "$REPO/engine/config.js" ] || REPO="$(cd "$PROJ/../.." && pwd)"

# 端末ごとの置き場（任意）: リポジトリ直下の .env（git 管理外）を環境変数として読む。書ける項目は .env.example。
#   無ければ何もしない＝既定の置き場（~/.cache/whisper・~/.venvs/rembg・OS の一時フォルダ）のまま。
# ★読むのは置き場の5項目だけ（.env には Slack のトークン等もある＝MV の道具に秘密を渡さない）
if [ -f "$REPO/.env" ]; then
  while IFS='=' read -r k v; do
    case "$k" in WHISPER_MODEL_DIR|REMBG_VENV|U2NET_HOME|TMPDIR|WORKFLOW_VENV)
      v="${v%\"}"; v="${v#\"}"; [ -n "$v" ] && export "$k=$v";; esac
  done < "$REPO/.env"
fi
[ -z "${TMPDIR:-}" ] || mkdir -p "$TMPDIR"
# whisper と numpy は専用の箱（tools/setup_venv.sh が作る）にある。あればその python3 / whisper を使う
WORKFLOW_VENV="${WORKFLOW_VENV:-$HOME/.venvs/resonal-workflow}"
[ -x "$WORKFLOW_VENV/bin/python" ] && export PATH="$WORKFLOW_VENV/bin:$PATH"

# 設定値を1つ取る（無ければ第2引数）。config.js の「example で動いている」警告は各スクリプトで繰り返さない
cfg() { node "$REPO/engine/config.js" "$1" 2>/dev/null || printf '%s\n' "${2:-}"; }

# 曲フォルダの絶対パス（songs/<name> の name だけ渡されても解決する）
song_dir() {
  local s="$1"
  if [ -d "$s" ]; then (cd "$s" && pwd)
  elif [ -d "$REPO/songs/$s" ]; then (cd "$REPO/songs/$s" && pwd)
  else echo "[NG] 曲フォルダが無い: $s" >&2; return 1; fi
}

# 曲タイトル＝song.json の title、無ければフォルダ名から日付を外したもの（engine/ctx.js と同じ規則）
song_title() {
  node -e 'const fs=require("fs"),p=require("path");const d=process.argv[1];let t;try{t=JSON.parse(fs.readFileSync(p.join(d,"song.json"),"utf8")).title}catch{}console.log(t||p.basename(d).replace(/^\d{6}_/,""))' "$1"
}

# 尺（秒）。読めなければ 0
media_dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null || echo 0; }
