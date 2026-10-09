/**
 * 出入りアニメーション辞書 — キネティックタイポグラフィの引き出し。
 *
 * 「画面上の文字は常にさまざまな種類のアニメーションで入れ替わる」を成立させるための本体。
 * treatment はブロックごとに in / out を1つずつ抽選して使う（seed 決定論＝レンダー再現性あり）。
 *
 * ## 増やし方（これだけ）
 * 1. INS か OUTS に1エントリ足す。キーが識別子、値が (p, size) => AnimState の関数
 * 2. `p` は 0→1 の進行度。IN は 0=出現直前/1=定位置、OUT は 0=定位置/1=消滅
 * 3. `size` はそのグリフの px サイズ。移動量を size 基準で書けば級数が変わっても崩れない
 * 4. 以上。IN_KEYS / OUT_KEYS は自動で拾うので抽選対象に入る
 *
 * ## 書くときの約束
 * - **不透明度のフェードに頼らない。** 参照実測でも出入りはフェードせず、動きと変形で見せている。
 *   opacity を下げるのは「突き抜けて消える」等、動きの意味づけがある時だけ
 * - 移動量は size の倍数で書く（px 直書きは禁止。9:16 や級数違いで破綻する）
 * - blur は入り/抜けの2〜3フレームぶんに留める。掛けすぎると滲んで文字が読めない
 * - transform は translate/scale/rotate/skew のみ。filter は blur と drop-shadow のみ
 *   （それ以外はレンダーが重くなるか、Chromium で層が分離して合成順が壊れる）
 */

export type AnimState = {
  /** transform に差し込む文字列（rotate は呼び出し側が後ろに足す） */
  tf: string;
  opacity: number;
  /** px */
  blur: number;
};

export type AnimFn = (p: number, size: number) => AnimState;

/** 入り: 0=出現直前 → 1=定位置 */
export const INS: Record<string, AnimFn> = {
  /** 画面手前（はみ出す大きさ）から奥へ退いて定位置に収まる */
  depth: (p) => ({ tf: `scale(${7 - 6 * p})`, opacity: 1, blur: (1 - p) * 3 }),
  /** 右外から滑り込む */
  slideR: (p, s) => ({ tf: `translateX(${(1 - p) * s * 6}px)`, opacity: 1, blur: (1 - p) * 5 }),
  /** 下から突き上げ */
  riseUp: (p, s) => ({
    tf: `translateY(${(1 - p) * s * 2.2}px) scale(${0.85 + 0.15 * p})`,
    opacity: 1,
    blur: 0,
  }),
  /** 上から落下 */
  dropDown: (p, s) => ({ tf: `translateY(${-(1 - p) * s * 2.2}px)`, opacity: 1, blur: (1 - p) * 2 }),
  /** 横に潰れた状態から開く */
  stretchX: (p) => ({ tf: `scaleX(${0.06 + 0.94 * p}) scaleY(${1.15 - 0.15 * p})`, opacity: 1, blur: 0 }),
  /** 回りながら着地 */
  spinIn: (p) => ({ tf: `rotate(${(1 - p) * -55}deg) scale(${0.4 + 0.6 * p})`, opacity: 1, blur: 0 }),
};

/** 抜け: 0=定位置 → 1=消滅。次の語が来たら前の語をこれで追い出す */
export const OUTS: Record<string, AnimFn> = {
  /** 左へ加速して画面外へ */
  pushL: (p, s) => ({ tf: `translateX(${-p * p * s * 9}px)`, opacity: 1, blur: p * 4 }),
  /** 右へ弾き出す */
  pushR: (p, s) => ({ tf: `translateX(${p * p * s * 9}px)`, opacity: 1, blur: p * 4 }),
  /** 上へ抜ける */
  pushU: (p, s) => ({ tf: `translateY(${-p * p * s * 6}px)`, opacity: 1, blur: p * 3 }),
  /** カメラ手前へ突き抜けて消える */
  zoomThrough: (p) => ({ tf: `scale(${1 + p * 5})`, opacity: 1 - p * 0.85, blur: p * 14 }),
  /** 奥へ吸い込まれて消える */
  zoomAway: (p) => ({ tf: `scale(${1 - p * 0.9})`, opacity: 1 - p * 0.6, blur: p * 2 }),
  /** 回転しながら弾ける */
  spinOut: (p, s) => ({
    tf: `rotate(${p * 42}deg) translate(${p * s * 3}px, ${p * p * s * 5}px)`,
    opacity: 1 - p * 0.5,
    blur: p * 5,
  }),
  /** 横に潰れて消える */
  squashX: (p) => ({ tf: `scaleX(${1 - p}) scaleY(${1 + p * 0.5})`, opacity: 1, blur: 0 }),
};

export const IN_KEYS = Object.keys(INS);
export const OUT_KEYS = Object.keys(OUTS);

/** seed から in/out を1組み抽選する。treatment 側から使う。 */
export const pickAnim = (r: (n: number) => number) => ({
  inKey: IN_KEYS[Math.floor(r(7) * IN_KEYS.length) % IN_KEYS.length],
  outKey: OUT_KEYS[Math.floor(r(8) * OUT_KEYS.length) % OUT_KEYS.length],
});
