/**
 * scenes.ts — カット別演出表をそのままデータにしたもの（値はダミー）。
 * 秒はマスター音源の実測で置き換える。
 * ここを直せば演出が変わる＝Stage.tsx にマジックナンバーを置かない。
 */
import project from '../input/project.json';

export const DUR = 60;

/** プレート（構図）。public/ に置く画像名 */
export type Plate = 'plate_a.png' | 'plate_a2.png' | 'plate_b.png' | 'plate_c.png' | 'plate_d.png' | null;

export interface Cut {
  /** 開始秒 */
  t: number;
  plate: Plate;
  /** プレートの表示量 0..1 */
  op?: number;
  /** 紙の通し番号ベース。区間内で送る場合は feed で刻む */
  sheet: number;
  /** 紙送りの間隔（秒）。指定するとこの区間だけ sheet が刻まれる */
  feed?: number;
  /** アンバーのスイープ（サイレンの視覚版）を出すか */
  amber?: boolean;
  /** 拍で紙がガタッとズレる（registration slam）＝打点。drop/サビ限定 */
  slam?: boolean;
  /** プレートに緩い push-in をかける */
  pushIn?: boolean;
  /** 紙が縦にスライドして抜ける（0=無し / 1=下へ / -1=上から入る） */
  slide?: 0 | 1 | -1;
  /** メモ */
  note?: string;
}

export const CUTS: Cut[] = [
  { t: 0.0, plate: null, sheet: 1, note: '白紙＋クレジットが押される' },
  { t: 6.0, plate: null, sheet: 2, note: 'タイトルカード（紙が上→中央→下）' },
  { t: 11.0, plate: 'plate_a.png', sheet: 3, pushIn: true, note: '紙を引き抜くとキャラが出てくる' },
  { t: 14.0, plate: 'plate_a.png', sheet: 3, amber: true, note: 'アンバースイープ＋GEN 01' },
  { t: 18.0, plate: 'plate_a2.png', sheet: 4, note: "Verse（構図A'）" },
  { t: 26.0, plate: 'plate_b.png', sheet: 5, amber: true, slam: true, note: 'Chorus（構図B）' },
  { t: 34.0, plate: 'plate_c.png', sheet: 6, feed: 1.6, note: '紙送り' },
  { t: 40.0, plate: 'plate_d.png', sheet: 12, amber: true, slam: true, note: 'Final Chorus（構図D）' },
  { t: 50.0, plate: 'plate_d.png', sheet: 13, amber: true, note: 'アウトロのスタンプ' },
  { t: 54.0, plate: 'plate_d.png', sheet: 13, slide: 1, note: '紙が排出される' },
  { t: 57.5, plate: null, sheet: 14, slide: -1, note: '次の白紙' },
];

/** 劣化カーブ（秒 → 0..1）。折れ線で持つ */
export const DEGRADE: [number, number][] = [
  [0.0, 0.06],
  [11.0, 0.1],
  [26.0, 0.3],
  [34.0, 0.6],
  [39.99, 0.8],
  // ここで一度だけリセット＝刷り直す
  [40.0, 0.12],
  [54.0, 0.7],
  [DUR, 0.9],
];

/** コピー世代カウンタ（劣化がリセットされても戻らない） */
export const GENERATIONS: [number, string][] = [
  [14.0, 'GEN 01'],
  [26.0, 'GEN 02'],
  [34.0, 'GEN 03'],
  [40.0, 'GEN 04'],
];

/** クレジット＝input/project.json の credits を、この秒で順に押す（拍に乗せる） */
const CREDIT_TIMES = [0.8, 2.6, 4.4];
export const CREDITS: { t: number; text: string; jp?: boolean }[] = (project.credits as string[]).map(
  (text, i) => ({
    t: CREDIT_TIMES[i] ?? CREDIT_TIMES[CREDIT_TIMES.length - 1] + 1.8 * (i - CREDIT_TIMES.length + 1),
    text,
    jp: /[^\x00-\x7F]/.test(text),
  })
);
export const CREDIT_HOLD = 1.7;

/** タイトルカード: 上から流れて中央で止まる → 指紋スタンプ → 1拍で引き抜く → end でキャラ登場 */
export const TITLE = { in: 6.0, hold: 7.6, down: 9.8, stamp: 10.2, up: 10.5, out: 10.6, end: 11.0 };
export const TITLE_TEXT = project.title.toUpperCase();

/** アウトロのスタンプ */
export const OUTRO_STAMP = { t: 50.6, text: 'CASE CLOSED' };
/** この秒以降は版ズレゴーストを出さない（アウトロを白く保つ） */
export const GHOSTS_UNTIL = 50.0;
/** この秒以降は registration slam を毎拍にする（倍テンのラスサビ） */
export const DOUBLE_TIME_FROM = 40.0;

/** ショート切り出し */
export const SHORT_START = 18.0;
export const SHORT_END = 40.0;

/** 折れ線の線形補間 */
export const lerpAt = (table: [number, number][], t: number) => {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 0; i < table.length - 1; i += 1) {
    const [t0, v0] = table[i];
    const [t1, v1] = table[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k;
    }
  }
  return table[table.length - 1][1];
};

/** その秒のカットを引く */
export const cutAt = (t: number): Cut => {
  let cur = CUTS[0];
  for (const c of CUTS) if (t >= c.t) cur = c;
  return cur;
};

/** その秒の世代表記 */
export const genAt = (t: number): string | null => {
  let cur: string | null = null;
  for (const [s, g] of GENERATIONS) if (t >= s) cur = g;
  return cur;
};
