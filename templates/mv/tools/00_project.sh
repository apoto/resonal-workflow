#!/usr/bin/env bash
# workflow.config.json と song.json → input/project.json（タイトル・クレジット・見た目・背景ループの尺。src が import する）。
# Usage: tools/00_project.sh <song_dir>
# 文言の正本は config と song.json だけ＝src に名前を焼き込まない。04 もレンダー前に毎回これを呼ぶ。
set -euo pipefail
source "$(dirname "$0")/_lib.sh"
SONG="$(song_dir "${1:?usage: 00_project.sh <song_dir>}")"
node - "$REPO/engine/config.js" "$PROJ/input/project.json" "$(song_title "$SONG")" "$PROJ/public" "$SONG" <<'JS'
const [cfgPath, out, title, pub, song] = process.argv.slice(2);
const cfg = require(cfgPath);
const fs = require('fs');
const lines = cfg.get('credits');
if (!Array.isArray(lines) || !lines.length || !lines.every((l) => typeof l === 'string' && l.trim())) {
  console.error('[NG] workflow.config.json の credits は空でない文字列の配列にする'); process.exit(1);
}
// 背景ループ動画（03c が public/ に置く）の尺＝秒。無ければ null（背景は静止画）
const loopSec = (f) => {
  const p = require('path').join(pub, f);
  if (!fs.existsSync(p)) return null;
  const r = require('child_process').spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const v = parseFloat(r.stdout);
  return Number.isFinite(v) && v >= 1 ? v : null;
};
// シーンの切り替え（曲フォルダの scenes.json。画像は make_mv.sh が public/scene_NN*.png に置く）
const scenesPath = require('path').join(song, 'scenes.json');
const scenes = fs.existsSync(scenesPath)
  ? JSON.parse(fs.readFileSync(scenesPath, 'utf8')).map((s, i) => {
      const n = String(i + 1).padStart(2, '0');
      if (!(typeof s.from === 'number' && s.from >= 0) || !fs.existsSync(require('path').join(pub, `scene_${n}.png`))) {
        console.error(`[NG] scenes.json の ${i + 1} 件目（from は秒の数値・画像は make_mv.sh で用意する）`); process.exit(1);
      }
      return { from: s.from, wide: `scene_${n}.png`, vert: `scene_${n}_vertical.png` };
    }).sort((a, b) => a.from - b.from)
  : [];
const data = {
  _generated: 'tools/00_project.sh が workflow.config.json と song.json から生成する。手で編集しない',
  title, artist: cfg.get('artist', lines[0]), credits: lines, look: cfg.get('mv.look', 'spectrum-still'),
  bgLoop: { wide: loopSec('bg_loop.mp4'), vert: loopSec('bg_loop_vertical.mp4') },
  scenes,
};
const text = JSON.stringify(data, null, 1) + '\n';
if (fs.existsSync(out) && fs.readFileSync(out, 'utf8') === text) process.exit(0);
fs.writeFileSync(out, text);
console.log(`[OK] input/project.json: ${title} / ${lines.join(' / ')} / look=${data.look} / bgLoop=${data.bgLoop.wide ? 'あり' : 'なし'} / scenes=${scenes.length}`);
JS
