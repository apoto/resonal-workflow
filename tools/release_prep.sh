#!/usr/bin/env bash
# リリース準備: アップロードに使うファイルを <曲>/release/ に揃える（アップロードは人が手で行う）。
#   作るのは workflow.config.json の release.targets で選んだ先の分だけ（none なら何も作らない）。
#   jacket_3000.jpg      dsp / other: ジャケット（cover.png の中央を 3000×3000 の正方形に）
#   thumbnail.jpg        youtube: サムネ（MV のサムネ、無ければ本編から1枚）
#   youtube.txt / dsp.txt youtube / dsp: 説明文・配信情報の下書き（タイトル・クレジット・歌詞を埋める。文面は AI が整える）
#   UPLOAD-CHECKLIST.md  人がアップロードする手順のチェックリスト
# Usage: tools/release_prep.sh "<曲フォルダ>"
# 文面ファイルは既にあれば上書きしない（整えた文面を消さない）。画像は元が新しければ作り直す。
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ARG="${1:?usage: tools/release_prep.sh \"<曲フォルダ>\"}"
if [ -d "$ARG" ]; then SONG="$(cd "$ARG" && pwd)"
elif [ -d "$REPO/songs/$ARG" ]; then SONG="$REPO/songs/$ARG"
else echo "[NG] 曲フォルダが無い: $ARG" >&2; exit 1; fi
TITLE="$(node -e 'const p=require("path");let t;try{t=require(process.argv[1]).title}catch{}console.log(t||p.basename(p.dirname(process.argv[1])).replace(/^\d{6}_/,""))' "$SONG/song.json")"
TARGETS="$(node "$REPO/engine/config.js" release.targets)"
has() { case "$TARGETS" in *"\"$1\""*) return 0;; *) return 1;; esac; }
if has none; then echo "[OK] release.targets=none（リリースしない）＝作るものは無い"; exit 0; fi
OUT="$SONG/release"; mkdir -p "$OUT"
[ -s "$SONG/cover.png" ] || { echo "[NG] cover.png が無い" >&2; exit 1; }

# ---- ジャケット（dsp / other） ----
J="$OUT/jacket_3000.jpg"
if ! has dsp && ! has other; then :
elif [ ! -s "$J" ] || [ "$SONG/cover.png" -nt "$J" ]; then
  ffmpeg -v error -y -i "$SONG/cover.png" -vf "crop='min(iw,ih)':'min(iw,ih)',scale=3000:3000:flags=lanczos" -q:v 2 "$J"
  SHORT_SIDE="$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$SONG/cover.png" | awk -F, '{print ($1<$2)?$1:$2}')"
  [ "${SHORT_SIDE:-0}" -ge 1500 ] || echo "[!!] cover.png の短辺が ${SHORT_SIDE}px＝3000px へ大きく拡大した（粗ければ大きい画像で作り直す）"
fi
if has dsp || has other; then
  [ "$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$J")" = "3000,3000" ] || { echo "[NG] $J が 3000×3000 でない" >&2; exit 4; }
  echo "[OK] release/jacket_3000.jpg"
fi

# ---- サムネ（youtube） ----
TH="$OUT/thumbnail.jpg"
if ! has youtube; then :
elif [ -s "$SONG/thumbnail.jpg" ]; then
  cmp -s "$SONG/thumbnail.jpg" "$TH" || cp "$SONG/thumbnail.jpg" "$TH"
elif [ ! -s "$TH" ]; then
  MAIN="$SONG/$TITLE.mp4"
  [ -s "$MAIN" ] || { echo "[NG] thumbnail.jpg も本編 $TITLE.mp4 も無い（先に MV）" >&2; exit 1; }
  DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MAIN")"
  ffmpeg -v error -y -ss "$(awk -v d="$DUR" 'BEGIN{print d/3}')" -i "$MAIN" -frames:v 1 -q:v 2 "$TH"
fi
if has youtube; then
  [ -s "$TH" ] || { echo "[NG] $TH が出来ていない" >&2; exit 4; }
  echo "[OK] release/thumbnail.jpg"
fi

# ---- 文面の下書きとチェックリスト ----
node - "$REPO/engine/config.js" "$SONG" "$TITLE" <<'JS'
const [cfgPath, song, title] = process.argv.slice(2);
const fs = require('fs'), path = require('path');
const cfg = require(cfgPath);
const out = (f) => path.join(song, 'release', f);
const md = fs.existsSync(path.join(song, 'LYRICS.md')) ? fs.readFileSync(path.join(song, 'LYRICS.md'), 'utf8') : '';
// 表示用の歌詞（行末の {pattern} と見出し・注記は除く）
const lines = md.split('\n'); const i = lines.findIndex((l) => /^##\s/.test(l) && l.includes('表示用'));
const lyrics = [];
if (i >= 0) for (const l of lines.slice(i + 1)) {
  if (/^##\s/.test(l)) break;
  const t = l.trim();
  if (/^([#>\[（(]|```|[-*] |\|)/.test(t)) continue;
  lyrics.push(t.replace(/\s*\{\w+\}\s*$/, ''));
}
const lyr = lyrics.join('\n').replace(/\n{3,}/g, '\n\n').trim();
const artist = cfg.get('artist', ''); const credits = cfg.get('credits', []);
const lang = cfg.get('lyricsLang', 'ja');
const { targets, note } = cfg.get('release');
const has = (t) => targets.includes(t);
const producer = cfg.get('producerName', '');
const files = {
  'youtube.txt': [
    '[下書き] 文面を整えたらこの行を消す',
    `タイトル: ${title} / ${artist}`,
    '',
    '（曲の紹介を1〜3行）',
    '',
    ...credits,
    '',
    '― Lyrics ―',
    lyr,
    '',
    '（ハッシュタグ）',
  ].join('\n'),
  'dsp.txt': [
    '[下書き] 文面を整えたらこの行を消す',
    `曲名: ${title}`,
    `アーティスト: ${artist}`,
    `ボーカル: ${cfg.get('vocalName', '')}`,
    `プロデューサー / 作詞 / 作曲: ${producer && producer !== '未定' ? producer : '（未定＝利用者に聞く）'}`,
    `歌詞の言語: ${lang}`,
    'ジャンル: （BRIEF.md から）',
    'リリース日: （人が決める）',
    'AI 生成の開示: （配信サービスの規定に沿って記入）',
    `音源: ${title}.wav / ジャケット: release/jacket_3000.jpg`,
    '',
    '― 歌詞 ―',
    lyr,
  ].join('\n'),
  'UPLOAD-CHECKLIST.md': `# ${title} — アップロード手順（人が手で行う）
${has('youtube') ? `
## YouTube（本編）
- [ ] \`${title}.mp4\` をアップロード
- [ ] タイトル・説明文に \`release/youtube.txt\` を貼る
- [ ] サムネに \`release/thumbnail.jpg\` を設定
- [ ] 「改変または合成されたコンテンツ」等の AI 開示項目を確認
- [ ] 公開日時を決めて予約（または公開）

## YouTube（ショート）
- [ ] \`${title} (Short).mp4\` をアップロード（本編の公開後がおすすめ）
- [ ] 説明文に本編へのリンクを入れる
` : ''}${has('dsp') ? `
## 配信サービス（音楽ストリーミング）
- [ ] ディストリビューターに \`${title}.wav\` と \`release/jacket_3000.jpg\` をアップロード
- [ ] 曲情報・歌詞を \`release/dsp.txt\` から入力
- [ ] AI 利用の開示・権利情報を規定どおりに入力
- [ ] リリース日を決めて申請
` : ''}${has('other') ? `
## その他のリリース先
- [ ] ${note || '（release.note に書いた先）'}：\`${title}.wav\`・\`release/jacket_3000.jpg\` を使って公開
` : ''}
## SNS
- [ ] 告知文を書いて投稿（YouTube のリンク・サムネ画像）
- [ ] 公開後、\`profile/ledger.md\` にこの曲の1行があるか確認
`,
};
if (!has('youtube')) delete files['youtube.txt'];
if (!has('dsp')) delete files['dsp.txt'];
for (const [f, body] of Object.entries(files)) {
  if (fs.existsSync(out(f))) { console.log(`[OK] release/${f}（既にある＝上書きしない）`); continue; }
  fs.writeFileSync(out(f), body.replace(/\n*$/, '\n'));
  console.log(`[OK] release/${f}${f.endsWith('.txt') ? '（下書き）' : ''}`);
}
if (!lyr) console.log('[!!] LYRICS.md の「## 歌詞（表示用）」が空＝歌詞欄を手で埋める');
JS
echo "[done] $OUT"
