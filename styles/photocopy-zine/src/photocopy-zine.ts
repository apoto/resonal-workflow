/**
 * photocopy-zine — スタイルの共有定数とヘルパ（再着色はここの PAL だけ）
 *
 * スタイルの核:
 *  ①ジン/コピー機のザラつき（紙グレイン＋ハーフトーン網点＋ゼロックス劣化）
 *  ②限定パレット（黒インク × 生成りの紙地 ＋ 差し色1点）
 *  ③コラージュの切り貼り
 *  ④高速カット＋キネティックタイポ
 *
 *  「コピーのコピー」＝回を追うごとに版が劣化する。degrade(0→1) が全部を駆動する。
 */

/** パレット（黒インク × 生成りの紙地 ＋ アンバー1点） */
export const PAL = {
  paper: '#EDE7DA', // 生成りオフホワイト（紙地）
  paperDark: '#DED6C4', // 影・2枚目の紙
  ink: '#141210', // 黒インク（純黒にしない＝印刷の黒）
  inkSoft: '#4A443C', // 薄い版・ゴースト
  amber: '#E08A12', // 唯一の差し色＝回転警告灯／朱肉
  amberSoft: '#F0B24A', // アンバーの薄い版（スイープの裾）
} as const;

/** 秒 → フレーム */
export const sec2f = (sec: number, fps: number) => Math.round(sec * fps);

/**
 * 決定的な擬似乱数（Math.random は使わない＝フレームごとに再評価されてチラつくため）。
 * seed から 0..1 を返す。
 */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** seed から -1..1 */
export const rand2 = (seed: number) => rand(seed) * 2 - 1;

/**
 * 劣化カーブ。曲の進行 0..1 → 版の劣化 0..1。
 * 単調増加だが、Breakdown で「新しい紙に差し替わる」ためリセット区間を持てる。
 */
export const degradeAt = (
  sec: number,
  duration: number,
  resets: { at: number; to: number }[] = []
) => {
  let base = Math.min(1, Math.max(0, sec / duration));
  // リセット点以降は、その点からの相対で再進行する
  for (const r of resets) {
    if (sec >= r.at) {
      const span = Math.max(0.001, duration - r.at);
      base = r.to + (1 - r.to) * ((sec - r.at) / span);
    }
  }
  return Math.min(1, Math.max(0, base));
};

/** 事前に焼いた網点プレートの劣化レベル（tools/07_halftone_plates.py と一致させる） */
export const HT_LEVELS = [0.10, 0.25, 0.40, 0.55, 0.70, 0.88];

/** 網点プレートのファイル名を引く。degrade は最も近いレベルへスナップする。 */
export const htPlate = (plate: string, degrade: number) => {
  const base = plate.replace(/\.png$/, '');
  let best = HT_LEVELS[0];
  for (const lv of HT_LEVELS) if (Math.abs(lv - degrade) < Math.abs(best - degrade)) best = lv;
  return `ht/${base}_${String(Math.round(best * 100)).padStart(2, '0')}.png`;
};
