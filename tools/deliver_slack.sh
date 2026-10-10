#!/usr/bin/env bash
# 成果物を Slack のチャンネル（またはスレッド）へアップロードする。
# Usage: tools/deliver_slack.sh "<投稿テキスト>" <thread_ts|-> <file1> [file2 ...]
#   thread_ts に "-" でチャンネル直下。RAW=1 で動画を縮小せずに送る。
# 設定: リポジトリ直下 .env の SLACK_BOT_TOKEN / SLACK_CHANNEL_ID
#   Bot のスコープ: chat:write, files:write, channels:history（非公開チャンネルなら groups:history）
#   history は「API が ok を返したのに載っていない」を検出するための読み返しに使う。
# 依存: curl, jq, ffmpeg, python3
# 動画は長辺 720p に縮小して送る（原寸の数百MBは Slack がインライン再生できない）。
# ループの中から呼ぶときは < /dev/null を付ける（ffmpeg が標準入力を読んで次の行を食う）。
set -euo pipefail
TEXT="${1:?usage: deliver_slack.sh \"<text>\" <thread_ts|-> <files...>}"; THREAD="${2:?thread_ts or -}"; shift 2
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"
[ -f "$REPO/.env" ] || { echo "[NG] $REPO/.env が無い（.env.example をコピーして SLACK_BOT_TOKEN / SLACK_CHANNEL_ID を書く）" >&2; exit 2; }
# .env は実行せず、要る2項目だけを文字列として読む
SLACK_BOT_TOKEN="$(sed -n 's/^SLACK_BOT_TOKEN=//p' "$REPO/.env" | tail -1 | tr -d '"'"'"'\r')"
SLACK_CHANNEL_ID="$(sed -n 's/^SLACK_CHANNEL_ID=//p' "$REPO/.env" | tail -1 | tr -d '"'"'"'\r')"
: "${SLACK_BOT_TOKEN:?SLACK_BOT_TOKEN が .env に無い}"; : "${SLACK_CHANNEL_ID:?SLACK_CHANNEL_ID が .env に無い}"
for c in curl jq ffmpeg python3; do command -v "$c" >/dev/null || { echo "[NG] $c が無い" >&2; exit 2; }; done
TOK="$SLACK_BOT_TOKEN"; CH="$SLACK_CHANNEL_ID"
TH=""; [ "$THREAD" != "-" ] && TH="$THREAD"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/resonal-slack.XXXXXX")"; trap 'rm -rf "$WORK"' EXIT
AUTH="$WORK/auth"; (umask 077; printf 'Authorization: Bearer %s\n' "$TOK" > "$AUTH")  # トークンを curl の引数（ps で見える）に載せない
FAIL=0

api_post() { curl -s -X POST "https://slack.com/api/$1" -H @"$AUTH" -H "Content-Type: application/json; charset=utf-8" -d "$2"; }

r0="$(api_post chat.postMessage "$(jq -n --arg ch "$CH" --arg th "$TH" --arg tx "$TEXT" \
  'if $th=="" then {channel:$ch,text:$tx} else {channel:$ch,thread_ts:$th,text:$tx} end')")"
[ "$(printf '%s' "$r0" | jq -r .ok)" = "true" ] || { echo "[NG] chat.postMessage: $(printf '%s' "$r0" | jq -r .error)" >&2; exit 1; }

for f in "$@"; do
  [ -f "$f" ] || { echo "[NG] not found: $f"; FAIL=1; continue; }
  fname="$(basename "$f")"
  ext="$(printf '%s' "${fname##*.}" | tr '[:upper:]' '[:lower:]')"
  up="$f"
  if [ -z "${RAW:-}" ] && { [ "$ext" = "mp4" ] || [ "$ext" = "mov" ]; }; then
    up="$WORK/lite_$RANDOM.mp4"
    ffmpeg -v error -y -i "$f" -vf "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'" \
      -c:v libx264 -preset veryfast -crf 25 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$up" </dev/null \
      || { echo "[NG] 縮小に失敗: $fname"; FAIL=1; continue; }
  fi
  size="$(wc -c < "$up" | tr -d ' ')"
  q="$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$fname")"
  r1="$(curl -s -H @"$AUTH" "https://slack.com/api/files.getUploadURLExternal?filename=$q&length=$size")"
  [ "$(printf '%s' "$r1" | jq -r .ok)" = "true" ] || { echo "[NG getURL] $fname: $(printf '%s' "$r1" | jq -r .error)"; FAIL=1; continue; }
  url="$(printf '%s' "$r1" | jq -r .upload_url)"; fid="$(printf '%s' "$r1" | jq -r .file_id)"
  code="$(curl -s -o /dev/null -w '%{http_code}' -F file=@"$up" "$url")"
  [ "$code" = "200" ] || { echo "[NG upload] $fname: HTTP $code"; FAIL=1; continue; }
  r3="$(api_post files.completeUploadExternal "$(jq -n --arg id "$fid" --arg t "$fname" --arg ch "$CH" --arg th "$TH" \
    'if $th=="" then {files:[{id:$id,title:$t}],channel_id:$ch} else {files:[{id:$id,title:$t}],channel_id:$ch,thread_ts:$th} end')")"
  [ "$(printf '%s' "$r3" | jq -r .ok)" = "true" ] || { echo "[NG complete] $fname: $(printf '%s' "$r3" | jq -r .error)"; FAIL=1; continue; }

  # ok:true だけでは信じない＝実際にチャンネル/スレッドに載ったかを読み返す（反映に数秒〜1分かかる）
  if [ -n "$TH" ]; then hq="conversations.replies?channel=$CH&ts=$TH&limit=200"; else hq="conversations.history?channel=$CH&limit=30"; fi
  posted=0
  for _ in $(seq 1 45); do
    sleep 2
    rh="$(curl -s -H @"$AUTH" "https://slack.com/api/$hq")"
    if [ "$(printf '%s' "$rh" | jq -r .ok)" != "true" ]; then
      echo "[NG verify] $fname: 読み返しに失敗（$(printf '%s' "$rh" | jq -r .error)。history スコープを付ける）"; break
    fi
    if printf '%s' "$rh" | jq -e --arg id "$fid" '[.messages[]?.files[]?.id] | index($id) != null' >/dev/null; then posted=1; break; fi
  done
  if [ "$posted" = 1 ]; then echo "[OK] $fname ($((size/1024/1024))MB)"; else echo "[NG not-posted] $fname: 載ったことを確認できない"; FAIL=1; fi
done

# 1つでも確認できなければ非0＝呼び出し側が握りつぶせない
[ "$FAIL" = 0 ] || exit 1
