// ビート（フレーム番号配列）に対するパルス強度ヘルパ。
// あるフレームが直近ビートからどれだけ近いかを 0..1 で返す（ビート直後=1、decay 後=0）。
export const beatPulse = (frame: number, beats: number[], decay = 8): number => {
  let best = 0;
  for (const b of beats) {
    if (frame >= b) {
      const v = 1 - (frame - b) / decay;
      if (v > best) best = v;
    }
  }
  return Math.max(0, Math.min(1, best));
};

// フレームが「ビートの瞬間」かどうか（±window フレーム）。huge-flash のストロボ用。
export const onBeat = (frame: number, beats: number[], window = 1): boolean =>
  beats.some((b) => Math.abs(frame - b) <= window);
