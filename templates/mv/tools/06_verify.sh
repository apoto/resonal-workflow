#!/usr/bin/env bash
# 書き出した動画の機械検査: デコード全走査 / クレジット（config の credits が画面に出る配線か）。
# Usage: tools/06_verify.sh <song_dir>
# レンダラは容量不足などで一部だけ壊れた mp4 を無言で吐くことがあり、サムネや数枚の still では気づけない。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 06_verify.sh <song_dir>}")"
TITLE="$(song_title "$SONG")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail=0

for f in "$SONG/$TITLE.mp4" "$SONG/$TITLE (Short).mp4" "$SONG/thumbnail.jpg"; do
  [ -s "$f" ] || { echo "[NG] 無い: $f" >&2; fail=1; continue; }
  ffmpeg -v error -i "$f" -f null - 2>"$TMP/dec.txt" || true
  if [ -s "$TMP/dec.txt" ]; then echo "[NG] デコードエラー $(grep -c . "$TMP/dec.txt")行: $f" >&2; fail=1
  else echo "[OK] デコード: $(basename "$f")"; fi
done

# project.json が config と一致し、song.config.ts がそれを import している＝クレジットが画面に出る
node - "$REPO/engine/config.js" "$PROJ" <<'JS' || fail=1
const [cfgPath, proj] = process.argv.slice(2);
const fs = require('fs'), path = require('path');
const want = require(cfgPath).get('credits');
let got;
try { got = JSON.parse(fs.readFileSync(path.join(proj, 'input/project.json'), 'utf8')).credits; } catch { got = null; }
if (JSON.stringify(got) !== JSON.stringify(want)) { console.error(`[NG] input/project.json の credits が config と違う（tools/00_project.sh）`); process.exit(1); }
const sc = fs.readFileSync(path.join(proj, 'input/song.config.ts'), 'utf8');
if (!/^import .*project\.json['"]/m.test(sc) || !/^\s*credits:/m.test(sc)) { console.error('[NG] song.config.ts が project.json の credits を使っていない＝画面に出ない'); process.exit(1); }
console.log(`[OK] クレジット: ${want.join(' / ')}`);
JS

[ "$fail" = "0" ] || { echo "[NG] 検査に落ちた" >&2; exit 1; }
echo "[done] 検査すべて通過"
