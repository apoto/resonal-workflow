/**
 * 点滅（フリッカー）が **1秒3回以下**か機械で検証する。
 *
 * 判定は **画面の平均輝度の急変回数**で見る。輝度が上下に振れる回数が 1秒3回を超えたら NG。
 * 連続的な色相回転や持続反転は輝度の急変を伴わないので、ここは通る＝
 * 「点滅させずに激しく見せる」設計になっているかの検査になる。
 */
import { execFileSync } from 'child_process';
import path from 'path';

const MP4 = path.resolve(__dirname, '../out/main.mp4');
const FPS = 15;              // 1/15秒刻みで輝度を追う（3Hz の検出には十分）
const THRESHOLD = 12;        // 平均輝度(0-255)の変化量。これ以上を「急変」とみなす
const LIMIT = 3;             // 1秒あたりの許容回数

const raw = execFileSync('ffmpeg', [
  '-v', 'error', '-i', MP4,
  '-vf', `fps=${FPS},scale=160:90,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`,
  '-f', 'null', '-',
], { encoding: 'utf8', maxBuffer: 1 << 28 });

const y = raw.split('\n').filter((l) => l.includes('YAVG=')).map((l) => parseFloat(l.split('=')[1]));
if (y.length < FPS) { console.log('motion: フレームが取れない（先に render してから実行する）'); process.exit(0); }

/** 各1秒窓での急変回数 */
let worst = { t: 0, n: 0 };
const spans: { t: number; n: number }[] = [];
for (let i = 0; i + FPS < y.length; i += 1) {
  let n = 0;
  for (let k = i; k < i + FPS - 1; k += 1) if (Math.abs(y[k + 1] - y[k]) >= THRESHOLD) n += 1;
  const t = i / FPS;
  if (n > LIMIT) spans.push({ t, n });
  if (n > worst.n) worst = { t, n };
}

console.log(`flicker-verify: ${y.length} サンプル（${FPS}fps） / 閾値 輝度差${THRESHOLD} / 上限 ${LIMIT}回/秒`);
console.log(`  最大の急変: ${worst.t.toFixed(1)}s で ${worst.n} 回/秒`);
if (spans.length) {
  // 連続する窓はまとめて報告
  const runs: [number, number, number][] = [];
  let st = spans[0].t, last = spans[0].t, mx = spans[0].n;
  for (const s of spans.slice(1)) {
    if (s.t - last > 1 / FPS + 1e-6) { runs.push([st, last, mx]); st = s.t; mx = 0; }
    last = s.t; mx = Math.max(mx, s.n);
  }
  runs.push([st, last, mx]);
  console.log(`flicker-verify: NG（${runs.length} 区間で上限超過）`);
  runs.forEach(([a, b, n]) => console.log(`  [E] ${a.toFixed(1)}s〜${b.toFixed(1)}s で最大 ${n} 回/秒＝点滅が速すぎる（光過敏対策違反）`));
  process.exit(1);
}
console.log('flicker-verify: OK（全区間で 1秒3回以下＝光過敏対策の基準内）');
