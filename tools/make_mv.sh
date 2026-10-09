#!/usr/bin/env bash
# 曲フォルダから MV 一式（本編・ショート・サムネ）を1本で作る。
#   01 転写 → 02 テンポ/energy → 03 素材 → 04 歌詞同期 → 05 レンダー → 06 検査（→ providers.notify が slack なら Slack）
#   曲フォルダに bg_loop.mp4（任意・bg_loop_vertical.mp4 も可）があれば、背景を静止画の代わりにループ動画にする
#   曲フォルダに scenes.json（任意）があれば、背景の画像を秒ごとに切り替える（templates/mv/README.md「シーンの切り替え」）
# Usage: tools/make_mv.sh "<曲フォルダ>" [--allow-unaligned] [--bpm MIN MAX]
#   --allow-unaligned  whisper が拾えない行を前後から割り振って進める（04 にそのまま渡す）
#   --bpm MIN MAX      テンポ推定の範囲を絞る（02 にそのまま渡す）
# MV プロジェクトは projects/<slug>/（無ければ templates/mv から作る）。各段は成果物を確かめてから次へ進む。
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ARG="${1:?usage: tools/make_mv.sh \"<曲フォルダ>\" [--allow-unaligned] [--bpm MIN MAX]}"; shift
ALIGN=(); TEMPO=()
while [ $# -gt 0 ]; do
  case "$1" in
    --allow-unaligned) ALIGN=(--allow-unaligned); shift;;
    --bpm) TEMPO=(--bpm "${2:?}" "${3:?}"); shift 3;;
    *) echo "[NG] 不明な引数: $1" >&2; exit 2;;
  esac
done

if [ -d "$ARG" ]; then SONG="$(cd "$ARG" && pwd)"
elif [ -d "$REPO/songs/$ARG" ]; then SONG="$REPO/songs/$ARG"
else echo "[NG] 曲フォルダが無い: $ARG" >&2; exit 1; fi
TITLE="$(node -e 'const p=require("path");let t;try{t=require(process.argv[1]).title}catch{}console.log(t||p.basename(p.dirname(process.argv[1])).replace(/^\d{6}_/,""))' "$SONG/song.json")"
for f in "$TITLE.wav" LYRICS.md cover.png; do
  [ -s "$SONG/$f" ] || { echo "[NG] $SONG/$f が無い（マスタリング・作詞・カバーを先に）" >&2; exit 1; }
done
need() { for f in "$@"; do [ -s "$f" ] || { echo "[NG] 出来ていない: $f" >&2; exit 4; }; done; }

# ---- MV プロジェクト（曲ごとに1つ。slug は song.json の mv_project に記録） ----
SLUG="$(node - "$SONG/song.json" "$TITLE" "$(basename "$SONG")" <<'JS'
const fs = require('fs');
const [p, title, folder] = process.argv.slice(2);
const sj = JSON.parse(fs.readFileSync(p, 'utf8'));
if (!sj.mv_project) {
  const ascii = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  sj.mv_project = ascii ? `${ascii}-mv` : `mv-${folder.slice(0, 6)}`; // 英数字の無いタイトルは日付で
  fs.writeFileSync(p, JSON.stringify(sj, null, 2) + '\n');
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(sj.mv_project)) { console.error(`[NG] song.json の mv_project が不正: ${sj.mv_project}`); process.exit(2); }
console.log(sj.mv_project);
JS
)"
PROJ="$REPO/projects/$SLUG"
if [ ! -d "$PROJ" ]; then
  cp -R "$REPO/templates/mv" "$PROJ"
  rm -rf "$PROJ/node_modules" "$PROJ/public" "$PROJ/out" "$PROJ/tools/__pycache__"
  mkdir -p "$PROJ/public"
  echo "[OK] 作成: projects/${SLUG}（← templates/mv）"
fi
if [ ! -d "$PROJ/node_modules" ]; then
  echo "=== npm install（初回のみ） ==="
  (cd "$PROJ" && npm install --no-audit --no-fund)
fi
T="$PROJ/tools"

echo "=== 01 転写 ==="
"$T/01_transcribe.sh" "$SONG"
need "$SONG/transcribe/audio_16k.json"

echo "=== 02 テンポ / energy ==="
"$T/02_tempo.sh" "$SONG" ${TEMPO[@]+"${TEMPO[@]}"}
need "$PROJ/input/energy.json" "$PROJ/input/beats.json"
# 実測 BPM を profile/ledger.md のこの曲の行に書く（企画で書いた BPM は発注値）
node - "$REPO/profile/ledger.md" "$TITLE" "$PROJ/input/beats.json" <<'JS'
const fs = require('fs'); const [ledger, title, beats] = process.argv.slice(2);
if (!fs.existsSync(ledger)) process.exit(0);
const bpm = Math.round(JSON.parse(fs.readFileSync(beats, 'utf8')).bpm);
const lines = fs.readFileSync(ledger, 'utf8').split('\n'); let hit = false;
const out = lines.map((l) => { const c = l.split('|'); if (c.length > 3 && c[1].trim() === title) { hit = true; c[2] = ` ${bpm}（実測） `; return c.join('|'); } return l; });
if (hit) { fs.writeFileSync(ledger, out.join('\n')); console.log(`[ledger] ${title} の BPM を実測 ${bpm} に書き換えた`); }
else console.log(`[ledger] profile/ledger.md に「${title}」の行が無い（企画の工程で足す）`);
JS

echo "=== 03 素材 ==="
"$T/03a_prep_cover.sh" "$SONG/cover.png"
rm -f "$PROJ"/public/scene_*.png
if [ -s "$SONG/scenes.json" ]; then
  i=0
  while IFS= read -r img; do
    i=$((i + 1)); [ -s "$SONG/$img" ] || { echo "[NG] scenes.json の画像が無い: $SONG/$img" >&2; exit 1; }
    "$T/03a_prep_cover.sh" "$SONG/$img" "$PROJ/public" "$(printf 'scene_%02d' "$i")" < /dev/null  # ffmpeg に一覧の行を読ませない
  done < <(node -e 'for (const s of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))) console.log(s.image)' "$SONG/scenes.json")
fi
CHAR="$REPO/profile/images/character.png"
# 立ち絵があればキャラを前景に、無ければカバーから被写体を切り抜く
if [ -s "$CHAR" ]; then "$T/03b_cutout_fg.sh" "$CHAR" --place
else
  # キャラがいない: カバーから被写体を切り抜く。切り抜ける被写体が無ければ（exit 3）前景なしで作る
  rc=0; "$T/03b_cutout_fg.sh" "$SONG/cover.png" || rc=$?
  if [ "$rc" = 3 ]; then "$T/03b_cutout_fg.sh" --none
  elif [ "$rc" != 0 ]; then exit "$rc"; fi
fi
need "$PROJ/public/bg.png" "$PROJ/public/bg_vertical.png" "$PROJ/public/fg.png" "$PROJ/public/fg_vertical.png"
"$T/03c_prep_loop.sh" "$SONG"
[ ! -s "$SONG/bg_loop.mp4" ] || need "$PROJ/public/bg_loop.mp4" "$PROJ/public/bg_loop_vertical.mp4"

echo "=== 04 歌詞同期 ==="
python3 "$T/04_build_lyrics.py" "$SONG" ${ALIGN[@]+"${ALIGN[@]}"}
need "$PROJ/input/lyrics.json"

echo "=== 05 レンダー ==="
"$T/05_render.sh" "$SONG"

echo "=== 06 検査 ==="
"$T/06_verify.sh" "$SONG"

FILES=("$SONG/$TITLE.mp4" "$SONG/$TITLE (Short).mp4" "$SONG/thumbnail.jpg")
if [ "$(node "$REPO/engine/config.js" providers.notify.use)" = "slack" ]; then
  echo "=== 07 Slack ==="
  "$REPO/tools/deliver_slack.sh" "$TITLE — MV" - "${FILES[@]}"
fi
echo ""
echo "[done] ${FILES[*]}"
echo "       人に見てもらい、OK なら song.json の approved_at に日付を入れる。直すなら projects/$SLUG/input/song.config.ts を編集して再実行。"
