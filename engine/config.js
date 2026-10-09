/**
 * config.js — workflow.config.json の唯一の読み口。
 *   node engine/config.js <key.path>  … 値を1つ標準出力（オブジェクトは JSON）
 *   node engine/config.js             … JSON 全体
 * workflow.config.json が無ければ example で動く（初回でも止まらないように）。
 * mastering は preset（streaming / loud）から数値と音色（profile）を埋め、利用者が書いた値があればそちらを優先する。
 * providers は用途ごとの外部サービス（use と note）。旧形式の tools（true / false）だけの設定も providers に読み替える。
 * release.targets はリリース先（youtube / dsp / other / none）。リリース準備はここで選んだ先の分だけ作る。
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const USER_PATH = path.join(REPO, 'workflow.config.json');
const EXAMPLE_PATH = path.join(REPO, 'workflow.config.example.json');

// profile は音色（mastering/auto_master.py）。streaming＝一般的な曲（EQ なし）、loud＝EDM・音ゲー向け（低域と高域を持ち上げるカーブ）
const PRESETS = {
  streaming: { integratedLufs: -14, truePeakCeiling: -1.0, profile: 'flat' },
  loud: { integratedLufs: -9.5, truePeakCeiling: -1.5, profile: 'neutral' },
};

// 用途ごとに選べるサービス。other は note に利用者が使い方を書き、AI はそれに従う
const PROVIDERS = {
  music: ['suno', 'other', 'manual'],
  image: ['codex', 'other', 'manual'],
  video: ['kling-mcp', 'other', 'none'],
  notify: ['slack', 'none'],
};
// リリース先。dsp＝配信サービス（ディストリビューター経由）、other＝note に書いた先、none＝リリースしない（単独で使う）
const RELEASE_TARGETS = ['youtube', 'dsp', 'other', 'none'];

// 旧形式 tools.<名前> が true のときの読み替え（false は各用途の最後の値＝manual / none）
const LEGACY = { music: ['suno', 'suno'], image: ['codex', 'codex'], video: ['kling', 'kling-mcp'], notify: ['slack', 'slack'] };

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 利用者の設定に無いキーは example の値で埋める（新しいキーを足しても既存の設定が壊れない）
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

// example の数値が利用者の preset を上書きしないよう、preset の値は example を飛ばして当てる
function resolveMastering(example, user) {
  const ex = example.mastering || {};
  const us = (user && user.mastering) || {};
  const preset = us.preset || ex.preset || 'streaming';
  if (!PRESETS[preset]) {
    console.error(`[config] mastering.preset が不明: ${preset}（${Object.keys(PRESETS).join(' / ')}）`);
    process.exit(2);
  }
  return { ...ex, ...PRESETS[preset], ...us, preset };
}

function resolveProviders(example, user) {
  const ex = example.providers || {};
  let us = user && user.providers;
  if (!us && user && isObj(user.tools)) {
    us = {};
    for (const [k, [legacy, use]] of Object.entries(LEGACY)) {
      if (legacy in user.tools) us[k] = { use: user.tools[legacy] === true ? use : PROVIDERS[k][PROVIDERS[k].length - 1] };
    }
  }
  const out = {};
  for (const k of Object.keys(PROVIDERS)) {
    const v = (us || {})[k];
    out[k] = { use: PROVIDERS[k][PROVIDERS[k].length - 1], note: '', ...ex[k], ...(typeof v === 'string' ? { use: v } : v) };
    if (!PROVIDERS[k].includes(out[k].use)) {
      console.error(`[config] providers.${k}.use が不明: ${out[k].use}（${PROVIDERS[k].join(' / ')}）`);
      process.exit(2);
    }
  }
  return out;
}

function resolveRelease(example, user) {
  const r = { targets: ['youtube', 'dsp'], note: '', ...(example.release || {}), ...((user && user.release) || {}) };
  const t = r.targets;
  if (!Array.isArray(t) || !t.length || t.some((v) => !RELEASE_TARGETS.includes(v)) || (t.includes('none') && t.length > 1)) {
    console.error(`[config] release.targets が不正: ${JSON.stringify(t)}（${RELEASE_TARGETS.join(' / ')} から選ぶ。none は単独）`);
    process.exit(2);
  }
  return r;
}

let _cfg = null;
function load() {
  if (_cfg) return _cfg;
  const example = fs.existsSync(EXAMPLE_PATH) ? readJson(EXAMPLE_PATH) : {};
  let user = null;
  if (fs.existsSync(USER_PATH)) {
    try { user = readJson(USER_PATH); }
    catch (e) { console.error(`[config] workflow.config.json が JSON として読めない: ${e.message}`); process.exit(2); }
  }
  _cfg = merge(example, user || {});
  _cfg.mastering = resolveMastering(example, user);
  _cfg.providers = resolveProviders(example, user);
  _cfg.release = resolveRelease(example, user);
  delete _cfg.tools; // 読み口は providers だけ

  return _cfg;
}

/** key.path で値を取る。無ければ fallback。 */
function get(key, fallback = undefined) {
  let v = load();
  for (const k of String(key).split('.')) {
    if (!isObj(v) || !(k in v)) return fallback;
    v = v[k];
  }
  return v;
}

module.exports = { load, get, REPO, PRESETS, PROVIDERS, RELEASE_TARGETS };

if (require.main === module) {
  const key = process.argv[2];
  if (!key) { process.stdout.write(JSON.stringify(load(), null, 2) + '\n'); process.exit(0); }
  const v = get(key);
  if (v === undefined) { console.error(`[config] キーが無い: ${key}`); process.exit(1); }
  process.stdout.write((typeof v === 'object' ? JSON.stringify(v) : String(v)) + '\n');
}
