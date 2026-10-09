#!/usr/bin/env bash
# 画像を1枚作る窓口。どのサービスで作るかは workflow.config.json の providers.image に従う。
# Usage: tools/gen_image.sh [--dry-run] "<英語プロンプト>" <出力パス（カレントからの相対）> [参照画...]
#   codex  … codex CLI の image_generation（codex login 済みが前提）。GEN_IMAGE_TIMEOUT（秒・既定 1200）で打ち切る
#   other  … note が「cmd: <コマンド>」ならそのテンプレートを展開して実行（{prompt} {out} {refs}）。
#             それ以外の note は AI への指示＝表示して exit 3（AI が note に従って作り、<出力パス> に置く）
#   manual … 何もせず、人に置いてもらう案内を出して exit 3
#   --dry-run … 実行するコマンドを表示するだけ（外部サービスに触らない）
# exit: 0=画像ができた / 1=失敗 / 2=道具・設定が無い / 3=自動では作らない（note に従う・人が置く）
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DRY=0; ARGS=()
for a in "$@"; do if [ "$a" = "--dry-run" ]; then DRY=1; else ARGS+=("$a"); fi; done
set -- ${ARGS[@]+"${ARGS[@]}"}
PROMPT="${1:?usage: gen_image.sh [--dry-run] \"<prompt>\" <out path> [ref images...]}"; OUT="${2:?out path}"; shift 2
USE="$(node "$REPO/engine/config.js" providers.image.use)"
NOTE="$(node "$REPO/engine/config.js" providers.image.note)"

# 「保存した」という報告ではなく、読める画像があることを確かめる
verify_out() {
  if [ ! -s "$OUT" ]; then
    echo "[NG] $OUT が空 or 無い" >&2
    # 別名で保存していることがある＝直近に増えた画像を候補として出す（中身が良ければ mv して使う）
    local stray; stray="$(find "$(dirname "$OUT")" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' \) -mmin -3 -size +10k 2>/dev/null || true)"
    [ -z "$stray" ] || { echo "[!!] 別名で保存された可能性:" >&2; echo "$stray" | sed 's/^/     /' >&2; }
    exit 1
  fi
  local dim; dim="$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$OUT" 2>/dev/null || true)"
  [ -n "$dim" ] || { echo "[NG] $OUT が画像として読めない" >&2; exit 1; }
  echo "[OK] $OUT ($dim)"
}

case "$USE" in
manual)
  echo "[人の番] providers.image=manual: 次のプロンプトで画像を用意し、$OUT に置いてください"
  echo "  $PROMPT"
  exit 3;;
other)
  if [[ "$NOTE" != cmd:* ]]; then
    echo "[AI の番] providers.image=other: note の指示に従って画像を作り、$OUT に置く（置いたら Read と ffprobe で確かめる）"
    echo "  note: ${NOTE:-（未記入＝利用者に使い方を聞く）}"
    echo "  prompt: $PROMPT"
    exit 3
  fi
  shopt -u patsub_replacement 2>/dev/null || true # bash 5.2+ は置換先の & を「一致した文字列」と読む＝%q の \& が壊れる
  q() { printf '%q' "$1"; }
  REFQ=""; for r in "$@"; do REFQ+="$(q "$r") "; done
  CMD="${NOTE#cmd:}"; CMD="${CMD# }"
  CMD="${CMD//\{prompt\}/$(q "$PROMPT")}"; CMD="${CMD//\{out\}/$(q "$OUT")}"; CMD="${CMD//\{refs\}/${REFQ% }}"
  if [ "$DRY" = 1 ]; then echo "[dry-run] $CMD"; exit 0; fi
  mkdir -p "$(dirname "$OUT")"
  bash -c "$CMD" </dev/null || { echo "[NG] note のコマンドが失敗: $CMD" >&2; exit 1; }
  verify_out;;
codex)
  REFS=(); for r in "$@"; do REFS+=(-i "$r"); done
  # 1枚だけ・指定パスに保存・他は何もしない、を明示しないと余計な編集をすることがある
  case "$OUT" in /*) OUTP="$OUT";; *) OUTP="./$OUT";; esac  # 絶対パスに ./ を付けない
  FULL="Use the image_generation tool to create EXACTLY ONE image and save it to ${OUTP}. Do nothing else: no other file edits, no git, no installs. ${PROMPT}"
  # 参照画は -i で末尾に渡す（codex の -i は可変長でプロンプトを飲むため、プロンプトは必ず先頭）
  CODEX=(codex exec --sandbox workspace-write --cd "$PWD" "$FULL" ${REFS[@]+"${REFS[@]}"})
  if [ "$DRY" = 1 ]; then printf '[dry-run]'; printf ' %q' "${CODEX[@]}"; echo; exit 0; fi
  command -v codex >/dev/null || { echo "[NG] codex CLI が無い（npm install -g @openai/codex → codex login）" >&2; exit 2; }
  mkdir -p "$(dirname "$OUT")"
  TMO="${GEN_IMAGE_TIMEOUT:-1200}"
  LOG="$(mktemp)"
  # stdin を閉じる（開いたままだと codex exec が追加入力を待って止まる）
  "${CODEX[@]}" </dev/null >"$LOG" 2>&1 &
  CPID=$!
  # 別プロセスの見張りで確実に殺す（codex は子プロセスを持つので子ごと）
  ( sleep "$TMO"; pkill -9 -P "$CPID" 2>/dev/null; kill -9 "$CPID" 2>/dev/null ) &
  WPID=$!
  RC=0; wait "$CPID" 2>/dev/null || RC=$?
  { kill "$WPID" && wait "$WPID"; } 2>/dev/null || true  # 見張りの後始末（"Terminated" を出さない）
  tail -4 "$LOG"; rm -f "$LOG"
  [ "$RC" -lt 128 ] || { echo "[NG] codex が ${TMO}s で応答せず強制終了: $OUT" >&2; exit 1; }
  verify_out;;
esac
