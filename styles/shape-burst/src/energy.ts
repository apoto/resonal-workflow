import energy from '../input/energy.json';

/**
 * VJ 駆動信号（tools/02_energy.py 生成）の共有アクセサ。
 *
 * ShapeBurst.tsx（オーバーレイ）と Stage.tsx（背景）の両方が使うので、循環 import を避けてここに置く。
 *
 *   sec = セクション強度 0..1（ゆっくり）→ 明るさ/彩度・白ウォッシュ・スクリム
 *   hit = 打点 0..1（速い）            → ズームパンチ・綿バースト
 */
type E = { fps: number; frames: number; sec: number[]; hit: number[] };
export const ENERGY = energy as E;

export function sampleEnergy(frame: number, offset = 0) {
  const i = Math.max(0, Math.min(ENERGY.frames - 1, frame + offset));
  return { sec: ENERGY.sec[i] ?? 0, hit: ENERGY.hit[i] ?? 0 };
}
