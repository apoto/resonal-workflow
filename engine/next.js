/**
 * next.js — 「この曲、いま何をすべきか」を1つだけ返す。
 *   ./next.sh --new               … 企画の入口（直近3曲を出す）
 *   ./next.sh --new "<Title>"     … songs/YYMMDD_<Title>/song.json を作り、次の1手を出す
 *   ./next.sh "<曲フォルダ or タイトル>"
 *   ./next.sh --list              … songs/ の全曲の現在地
 * exit: 0=全部完了 / 1=AI の作業あり / 2=引数エラー / 3=人の番
 */
const fs = require('fs');
const path = require('path');
const { STEPS, evaluate } = require('./steps.js');
const { makeCtx, read, readJson, REPO, SONGS } = require('./ctx.js');
const config = require('./config.js');

const argv = process.argv.slice(2);
const pad2 = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const songDirs = () => (fs.existsSync(SONGS) ? fs.readdirSync(SONGS) : [])
  .filter((d) => /^\d{6}_/.test(d) && fs.statSync(path.join(SONGS, d)).isDirectory()).sort();

// ledger.md の1曲1行（箇条書き or 表の行）。見出し・区切り・表のヘッダは除く
function ledgerRows() {
  const md = read(path.join(REPO, 'profile', 'ledger.md')) || '';
  return md.split('\n').map((l) => l.trim())
    .filter((l) => /^([-*]\s+\S|\|)/.test(l))
    .map((l) => l.startsWith('|') ? l.split('|').slice(1, -1).map((c) => c.trim()).join(' / ') : l.replace(/^[-*]\s+/, ''))
    .filter((l) => l && !/^[\s/:-]+$/.test(l) && !/^(タイトル|曲名|Title)(\s|\/|$)/i.test(l));
}

function findSong(arg) {
  const songs = songDirs();
  if (songs.includes(arg)) return arg;
  const base = path.basename(arg);
  if (songs.includes(base)) return base;
  const hits = songs.filter((s) => s.replace(/^\d{6}_/, '') === arg || (readJson(path.join(SONGS, s, 'song.json')) || {}).title === arg);
  if (hits.length > 1) { console.error(`[ERR] 同じタイトルの曲が複数ある: ${hits.join(', ')}（フォルダ名で指定する）`); process.exit(2); }
  if (!hits.length) { console.error(`[ERR] 曲が見つからない: ${arg}（./next.sh --list で確認）`); process.exit(2); }
  return hits[0];
}

let target = null;

// ---- --new ----
if (argv.includes('--new')) {
  const title = argv[argv.indexOf('--new') + 1];
  if (!title || title.startsWith('--')) {
    console.log('\n━━━ 新曲の企画 ━━━\n');
    const rows = ledgerRows();
    console.log('【直近3曲（似た曲を続けない材料）】');
    if (rows.length) rows.slice(-3).reverse().forEach((r) => console.log(`  ・${r}`));
    else console.log('  （profile/ledger.md が空＝初めての曲）');
    console.log('\n次: skill `planning` で案を2〜3出す → 人が選ぶ → ./next.sh --new "<Title>" → BRIEF.md に案と選んだ案を書く\n');
    process.exit(3);
  }
  if (/[\/\\:]/.test(title) || title.trim() !== title) { console.error('[ERR] タイトルに / \\ : や前後の空白は使えない'); process.exit(2); }
  const d = today();
  const folder = `${d.slice(2).replace(/-/g, '')}_${title}`;
  const existing = songDirs().find((s) => s.replace(/^\d{6}_/, '') === title);
  target = existing || folder;
  const sj = path.join(SONGS, target, 'song.json');
  if (fs.existsSync(sj)) {
    console.log(`\n（既にある: songs/${target}/ ＝作り直さない）`);
  } else {
    fs.mkdirSync(path.dirname(sj), { recursive: true });
    fs.writeFileSync(sj, JSON.stringify({
      title, created: d, lyrics_lang: config.get('lyricsLang', 'ja'), mv_project: null, approved_at: null,
    }, null, 2) + '\n');
    console.log(`\n作成: songs/${target}/song.json`);
  }
}

// ---- --list ----
if (argv.includes('--list')) {
  const songs = songDirs();
  if (!songs.length) { console.log('\n（songs/ に曲が無い＝./next.sh --new から始める）\n'); process.exit(0); }
  console.log('');
  for (const s of songs) {
    const next = evaluate(makeCtx(s)).find((r) => r.result);
    const at = next ? `${next.step.label}${next.result.who === 'human' ? '（人の番）' : ''}` : '完了';
    console.log(`  ${s.padEnd(34)} ${at}`);
  }
  console.log('');
  process.exit(0);
}

if (!target) {
  const arg = argv.find((a) => !a.startsWith('--'));
  if (!arg) { console.error('Usage: ./next.sh "<曲フォルダ or タイトル>" | --list | --new ["<Title>"]'); process.exit(2); }
  target = findSong(arg);
}

const rows = evaluate(makeCtx(target));
const idx = rows.findIndex((r) => r.result);
console.log(`\n━━━ ${target} ━━━`);
rows.forEach((r, i) => {
  const mark = idx < 0 || i < idx ? '✓' : i === idx ? '→' : '・';
  console.log(`  ${mark} ${i + 1}. ${r.step.label}`);
});

if (idx < 0) {
  const none = config.get('release').targets.includes('none');
  console.log(none ? '\n全工程が完了（リリースしない設定）。' : '\n全工程が完了。あとは release/UPLOAD-CHECKLIST.md に沿って人がアップロードする。');
  console.log('profile/ledger.md にこの曲の1行が無ければ足す。\n');
  process.exit(0);
}

const { step, result } = rows[idx];
const isHuman = result.who === 'human';
console.log(`\n次の1手（${idx + 1}/${STEPS.length} ${step.label}・skill \`${step.skill}\`）: ${isHuman ? '★人の番' : 'AI がやる'}`);
console.log(`  現状: ${result.why}`);
console.log(`  やること: ${result.todo}`);
console.log(isHuman ? '\n  人が終えたら、もう一度 ./next.sh で確かめる。\n' : `\n  終わったらもう一度: ./next.sh '${String(target).replace(/'/g, "'\\''")}'\n`);
process.exit(isHuman ? 3 : 1);
