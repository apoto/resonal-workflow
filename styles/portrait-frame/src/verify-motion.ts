/**
 * 「背景が止まっていないか」をレンダー前に**still の連続フレーム差分**で検証する。
 *
 * フレーム間差分で止まって見えるカットを数値特定する考え方を、レンダー前の still に当てる版。
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { scene } from './scene';

const OUT = path.resolve(__dirname, '../out/motion');
fs.mkdirSync(OUT, { recursive: true });
const fps = scene.meta.fps;

/**
 * 各セクションの真ん中あたりで、0.2秒あけた2枚を撮って差分を測る。
 *
 * ★白飛び（portrait-frame.flood-white）が全白になっている区間は**意図的に静止している**ので除外する。
 *   ここを NG にすると「ホワイトアウトは画が真っ白＝止まって当然」を毎回誤検出する。
 *   代わりに、白飛びの前後（立ち上がり／引き）は測る＝白が動いていることは確認できる。
 */
const floodWindows = (scene.stage.ambientFront ?? []).concat(scene.sections.flatMap((s) => s.overlays ?? []))
  .filter((o) => o.id === 'portrait-frame.flood-white')
    .map((o) => {
      const peak = ((o.params?.peak as number) ?? 0.42);
      const hold = ((o.params?.hold as number) ?? 0.16);
      // 全白になっている帯（peak〜peak+hold）を少し広げて除外
      return { from: o.t + o.hold * (peak - 0.06), to: o.t + o.hold * (peak + hold + 0.10) };
    });
const inFlood = (t: number) => floodWindows.some((w) => t >= w.from && t <= w.to);

const targets = scene.sections.map((s) => {
  const mid = s.from + (s.to - s.from) * 0.55;
  if (!inFlood(mid)) return { id: s.id, t: mid };
  // 白飛びの帯に当たるセクションは、帯を外した位置で測る（末尾寄り＝白が引けたあと）
  const alt = [0.9, 0.15, 0.75, 0.3].map((r) => s.from + (s.to - s.from) * r).find((t) => !inFlood(t));
  return { id: s.id, t: alt ?? mid, skip: alt === undefined };
});
const GAP = 0.2;
const findings: string[] = [];
const rows: string[] = [];

for (const { id, t, skip } of targets as { id: string; t: number; skip?: boolean }[]) {
  if (skip) { rows.push(`  ${id.padEnd(9)} 全区間が白飛びの全白帯＝測定をスキップ`); continue; }
  const files = [t, t + GAP].map((tt, i) => {
    const f = path.join(OUT, `${id}_${i}.png`);
    execFileSync('npx', ['remotion', 'still', 'LyricVideo', f, `--frame=${Math.round(tt * fps)}`, '--log=error'],
      { stdio: 'pipe' });
    return f;
  });
  // ImageMagick に依存せず ffmpeg で平均絶対差を出す
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', files[0], '-i', files[1],
    '-filter_complex', 'blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-',
    '-f', 'null', '-'], { encoding: 'utf8' });
  const m = out.match(/YAVG=([0-9.]+)/);
  const diff = m ? parseFloat(m[1]) : -1;
  rows.push(`  ${id.padEnd(9)} t=${t.toFixed(1).padStart(6)}s  差分=${diff.toFixed(3)}`);
  // 0.2秒で平均差 0.25 未満＝ほぼ止まっている（雪と霧が常時動くので健全なら 0.5 以上出る）
  if (diff >= 0 && diff < 0.25) {
    findings.push(`[${id}] t=${t.toFixed(1)}s の 0.2秒間の平均フレーム差が ${diff.toFixed(3)}＝**ほぼ止まっている**`);
  }
}

console.log('motion-verify: 0.2秒あけた2フレームの平均差（大きいほど動いている）');
rows.forEach((r) => console.log(r));
if (findings.length) {
  console.log(`motion-verify: NG ${findings.length} 件`);
  findings.forEach((f) => console.log('  [E] ' + f));
  process.exit(1);
}
console.log('motion-verify: OK（全セクションで画が動いている＝完全静止フレーム禁止をクリア）');
