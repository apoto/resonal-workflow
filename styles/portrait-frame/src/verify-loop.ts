/**
 * 背景動画が **ループ／逆再生していないか**を静的に検証する。
 *
 * 1周（sec / rate）がセクション長を超えると継ぎ目が出る。レンダー結果からは測りにくいので
 * **spec の段階で機械的に落とす**（ピンポン素材は後半が逆再生になるので使わない）。
 */
import { scene } from './scene';
import { execFileSync } from 'child_process';
import path from 'path';

/** public に置いた素材の実尺（秒）を ffprobe で測る。fieldParams.sec と食い違っていたらそれ自体がバグ */
const realSec = (src: string): number | undefined => {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
      path.resolve(__dirname, '../public', src)], { encoding: 'utf8' });
    const v = parseFloat(out);
    return Number.isFinite(v) ? v : undefined;
  } catch { return undefined; }
};

const findings: string[] = [];
const rows: string[] = [];

for (const s of scene.sections) {
  const fp = (s.stage?.fieldParams ?? {}) as Record<string, unknown>;
  if (s.stage?.field !== 'portrait-frame.video') continue;
  const src = String(fp.src ?? '');
  const rate = Number(fp.rate ?? 1);
  const declared = Number(fp.sec ?? 0);
  const dur = s.to - s.from;

  const real = realSec(src);
  if (real === undefined) { findings.push(`[${s.id}] public/${src} の尺が測れない（置いてあるか確認する）`); continue; }
  if (Math.abs(real - declared) > 0.05) {
    findings.push(`[${s.id}] fieldParams.sec=${declared} が実尺 ${real} と違う（ループ長の計算がずれる）`);
  }
  const oneLoop = real / rate;
  const loops = dur / oneLoop;
  rows.push(`  ${s.id.padEnd(9)} ${dur.toFixed(2).padStart(6)}s / 1周 ${oneLoop.toFixed(2)}s (rate ${rate}) = ${loops.toFixed(2)}周`);
  if (loops > 1.0) {
    findings.push(
      `[${s.id}] ${dur.toFixed(2)}秒の区間で1周 ${oneLoop.toFixed(2)}秒＝**${loops.toFixed(2)}周してループの継ぎ目が出る**。`
      + ` rate を ${(real / (dur * 1.02)).toFixed(2)} 以下にするか、面を切り替えてセクションを分ける`
    );
  }
}

console.log('loop-verify: 背景動画が1周に収まっているか（ループ＝継ぎ目／逆再生の温床）');
rows.forEach((r) => console.log(r));
if (findings.length) {
  console.log(`loop-verify: NG ${findings.length} 件`);
  findings.forEach((f) => console.log('  [E] ' + f));
  process.exit(1);
}
console.log('loop-verify: OK（全区間が1周以内＝ループしない）');
