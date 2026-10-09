import { CreditTiming } from './Credits';

// input/lyrics.json のスキーマ（crimson-gothic）。
// タイミングは「秒」（t=開始秒, hold=表示秒）。ハードカット＝[startFrame, endFrame) でパッと出す。
// 4つの演出パターンを pattern で出し分ける。

export type CrimsonGothicPattern =
  | 'edge' // A: 左右端の縦書き明朝（静）。side で左右
  | 'centerChar' // B: 中央巨大1文字スイッチ
  | 'centerBig' // C: 中央巨大＋色収差/横波グリッチ（サビ）
  | 'build'; // D: ビルドアップ（外側文字→中央で単語完成。例 "WORD"）

export interface CrimsonGothicLine {
  text: string;
  /** 表示開始（秒）。拍に合わせて置く。 */
  t: number;
  /** 表示時間（秒）。省略時は既定値。次行と重ねない（ハードカット）。 */
  hold?: number;
  /** 演出パターン（既定 'centerBig'）。 */
  pattern?: CrimsonGothicPattern;
  /** pattern='edge' の左右。既定 'right'。 */
  side?: 'left' | 'right';
  /** 英字を高コントラストのセリフ（Playfair Display）で。和文明朝は false（既定）。 */
  serif?: boolean;
  /** フォントサイズ上書き（px）。 */
  size?: number;
  /** 横波の液状グリッチ＋強い色収差＋ビート振動（サビのキメ）。 */
  glitch?: boolean;
  /** 色収差だけ常時うっすら乗せる（glitch ほど激しくない）。 */
  chroma?: boolean;
  /** 文字色の上書き（既定は白 #f2efe9）。 */
  color?: string;
}

export interface CrimsonGothicData {
  meta: {
    duration: number; // 秒
    fps: number;
    width?: number; // 既定 1920
    height?: number; // 既定 1080
    audio?: string; // public/ 内の音源
    /** public/ 内の背景画像ファイル名（キャラ/カバー絵）。あれば cover で敷く。 */
    backgroundImage?: string;
    /** 背景色（画像が無いときの下地。既定 #0b0809 の暗色）。 */
    background?: string;
    /** 文字色の既定（既定 #f2efe9 白）。 */
    ink?: string;
    /** 全体の出現タイミング微調整（秒）。 */
    timingOffsetSec?: number;
    /** 冒頭クレジットの秒（任意・文言は input/project.json）。項目順に [{from,to}]。 */
    credits?: CreditTiming[];
  };
  lyrics: CrimsonGothicLine[];
}

/** 実行時に t/hold から算出する内部型 */
export interface RuntimeCrimsonGothic extends CrimsonGothicLine {
  startFrame: number;
  endFrame: number;
}
