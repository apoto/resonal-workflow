/**
 * ホワイトアウトで**面の切り替えが隠れているか**を機械で検証する。
 *
 * 面の切替（セクション境界）を白飛びの**開始**と同じ時刻に置くと、立ち上がり中はまだ白くないので
 * 切り替わる瞬間が見える。切替は **全白帯の中**に入っていなければならない。それをここで落とす。
 */
import { scene } from './scene';

type Flood = { t: number; hold: number; peak: number; holdRatio: number };
const floods: Flood[] = (scene.stage.ambient ?? [])
  .concat(scene.stage.ambientFront ?? [])   // ★白飛びは ambientFront にある（被写体より前の層）
  .concat(scene.sections.flatMap((s) => s.overlays ?? []))
  .filter((o) => o.id === 'portrait-frame.flood-white')
  .map((o) => ({
    t: o.t, hold: o.hold,
    peak: (o.params?.peak as number) ?? 0.42,
    holdRatio: (o.params?.hold as number) ?? 0.16,
  }));

/** 全白になっている帯 */
const white = floods.map((f) => ({
  from: f.t + f.hold * f.peak,
  to: f.t + f.hold * (f.peak + f.holdRatio),
  src: f,
}));

/** 面（背景素材）が変わるセクション境界 */
const cuts: { t: number; from: string; to: string }[] = [];
for (let i = 1; i < scene.sections.length; i += 1) {
  const a = scene.sections[i - 1], b = scene.sections[i];
  const sa = String((a.stage?.fieldParams as Record<string, unknown> | undefined)?.src ?? a.stage?.field ?? '');
  const sb = String((b.stage?.fieldParams as Record<string, unknown> | undefined)?.src ?? b.stage?.field ?? '');
  if (sa !== sb && Math.abs(b.from - a.to) < 0.01) cuts.push({ t: b.from, from: sa, to: sb });
}

const findings: string[] = [];
console.log(`flood-verify: 白飛び ${floods.length} 回 / 面が変わる境界 ${cuts.length} 箇所`);
white.forEach((w, i) =>
  console.log(`  白飛び${i + 1}: ${w.src.t}s〜${(w.src.t + w.src.hold).toFixed(2)}s（全白 ${w.from.toFixed(2)}-${w.to.toFixed(2)}s）`));

// ★白飛びを置いた区間の中にある面の切替は、全白帯の中に入っていること
for (const c of cuts) {
  const inside = floods.find((f) => c.t >= f.t && c.t <= f.t + f.hold);
  if (!inside) continue;                       // 白飛びと無関係な切替＝意図的なハードカット
  const w = white.find((x) => x.src === inside)!;
  const ok = c.t >= w.from && c.t <= w.to;
  console.log(`  切替 ${c.t}s  ${c.from} → ${c.to}  ${ok ? '✓ 全白の中' : '✗ 白が薄い時刻'}`);
  if (!ok) {
    findings.push(
      `面の切替 ${c.t}s（${c.from} → ${c.to}）が全白帯 ${w.from.toFixed(2)}-${w.to.toFixed(2)}s の外にある`
      + `＝**切り替わる瞬間が見えてしまう**。白飛びの t を早めるか peak/hold を調整して全白帯に入れる`
    );
  }
}
// 1曲2〜3回まで（record: light-flood-wipe）
if (floods.length > 3) findings.push(`白飛びが ${floods.length} 回＝多用（light-flood-wipe は1曲2〜3回まで）`);

if (findings.length) {
  console.log(`flood-verify: NG ${findings.length} 件`);
  findings.forEach((f) => console.log('  [E] ' + f));
  process.exit(1);
}
console.log('flood-verify: OK（面の切替はすべて全白の中で起きている＝境界が見えない）');
