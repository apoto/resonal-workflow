/**
 * ctx.js — steps.js の判定が受け取る ctx の唯一の生成元（読み取り専用）。
 *   ファイル … read / readJson / exists
 *   実測     … probe(デコード検査) / loudness(LUFS,TP) / duration / imageSize
 *   基準値   … masterSpec()（workflow.config.json の mastering）
 * 実測は ffmpeg を叩くので mtime+size をキーに .cache/ へキャッシュする（--list が全曲フルデコードして遅くなるため）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('./config.js');

const REPO = config.REPO;
const SONGS = path.join(REPO, 'songs');
const CACHE_PATH = path.join(REPO, '.cache', 'media-probe.json');

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

// ---- 実測キャッシュ ----
let cache = readJson(CACHE_PATH) || {};
let cacheDirty = false;
const stampOf = (p) => { try { const s = fs.statSync(p); return `${s.mtimeMs}:${s.size}`; } catch { return null; } };

function cached(kind, p, compute) {
  const stamp = stampOf(p);
  if (stamp === null) return null;
  const key = `${kind}:${path.relative(REPO, p)}`;
  if (cache[key] && cache[key].stamp === stamp) return cache[key].v;
  const v = compute();
  cache[key] = { stamp, v };
  cacheDirty = true;
  return v;
}
function flushCache() {
  if (!cacheDirty) return;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  } catch { /* キャッシュは無くても正しく動く */ }
}
process.on('exit', flushCache);

// ---- ffmpeg / ffprobe ----
// ffmpeg は計測値を stderr に出すので spawnSync で両方拾う
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error) return { ok: false, out: '', err: String(r.error.message) };
  return { ok: r.status === 0, out: r.stdout || '', err: r.stderr || '' };
};

/** デコード検査。errors>0 なら壊れている（レンダラは容量不足で無言に壊れたファイルを吐くことがある）。 */
const probe = (p) => cached('probe', p, () => {
  const r = sh('ffmpeg', ['-v', 'error', '-i', p, '-f', 'null', '-']);
  const lines = (r.err || '').split('\n').filter((l) => l.trim());
  return { errors: r.ok && !lines.length ? 0 : (lines.length || 1) };
});

/** 尺（秒）。読めなければ null。 */
const duration = (p) => cached('dur', p, () => {
  const r = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p]);
  const v = parseFloat((r.out || '').trim());
  return Number.isFinite(v) ? v : null;
});

/** Integrated LUFS / True Peak / LRA / SR / bit深度。音声が読めなければ null。 */
const loudness = (p) => cached('loud', p, () => {
  const r = sh('ffmpeg', ['-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const out = r.out + r.err;
  // 途中経過にも同じ書式が出るので最後のマッチ（=Summary）を取る
  const grab = (re) => { const m = [...out.matchAll(new RegExp(re.source, 'g'))].pop(); return m ? parseFloat(m[1]) : null; };
  const lufs = grab(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
  if (lufs === null) return null;
  const st = sh('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=sample_rate,bits_per_raw_sample,bits_per_sample,channels', '-of', 'default=nw=1', p]).out;
  const num = (k) => { const m = new RegExp(`${k}=(\\d+)`).exec(st); return m && Number(m[1]) ? Number(m[1]) : null; };
  return {
    lufs,
    tp: grab(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/),
    lra: grab(/LRA:\s*(-?\d+(?:\.\d+)?)\s*LU/),
    sampleRate: num('sample_rate'),
    bits: num('bits_per_raw_sample') || num('bits_per_sample'),
    channels: num('channels'),
  };
});

/** 画像/動画の解像度。 */
const imageSize = (p) => cached('size', p, () => {
  const r = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'default=nw=1', p]);
  const w = /width=(\d+)/.exec(r.out); const h = /height=(\d+)/.exec(r.out);
  return (w && h) ? { w: Number(w[1]), h: Number(h[1]) } : null;
});

/** マスタリング目標（正本は workflow.config.json）。 */
function masterSpec() {
  const m = config.get('mastering', {});
  const spec = {
    lufs: m.integratedLufs, lufsTol: m.lufsTolerance, tpCeil: m.truePeakCeiling,
    sampleRate: m.sampleRate, bits: m.bitDepth,
  };
  spec.ok = Object.values(spec).every((v) => typeof v === 'number');
  return spec;
}

/** @param {string} name 曲フォルダ名（songs/ 直下） */
function makeCtx(name) {
  const dir = path.join(SONGS, name);
  const sj = readJson(path.join(dir, 'song.json')) || {};
  const title = sj.title || name.replace(/^\d{6}_/, '');
  return {
    name, dir, title, sj, repo: REPO, config,
    file: (rel) => path.join(dir, rel),
    read, readJson,
    exists: (p) => fs.existsSync(p) && fs.statSync(p).size > 0,
    probe, duration, loudness, imageSize, masterSpec,
  };
}

module.exports = { makeCtx, REPO, SONGS, read, readJson, probe, duration, loudness, imageSize, masterSpec, flushCache };
