import { CreditTiming } from './Credits';

// input/lyrics.json のスキーマ（white-cut）。
// タイミングは「秒」で持つ（t=開始秒, hold=表示秒）。frameへの変換はコード側で行う。
// white-cutはハードカット＝LEAD/springを使わず [startFrame, endFrame) でパッと出してパッと消す。

export interface SnapLine {
  text: string;
  /** 表示開始（秒）。拍に合わせて置く。手調整はここをいじる。 */
  t: number;
  /** 表示時間（秒）。省略時は既定値。次の行と重ねない（消えると同時に次が出る）。 */
  hold?: number;
  /** 縦書き（日本語）。既定 true。英語キメ等は false で横書き。 */
  vertical?: boolean;
  /** 「」で囲む（歌詞フレーズ）。タイトルや英語キメは付けない。 */
  quote?: boolean;
  /** この行の出現時に画面全体へ横波の液状グリッチを一瞬走らせる（キメ）。 */
  glitch?: boolean;
  /** フォントサイズ上書き（px）。省略時は縦/横の既定。 */
  size?: number;
}

export interface SnapData {
  meta: {
    duration: number; // 秒
    fps: number;
    width?: number; // 既定 1920
    height?: number; // 既定 1080
    audio?: string; // public/ 内の音源ファイル名
    /** public/ 内の中央キャラ画像（任意）。本物の手の中心に歌詞が重なる構図を再現したい時に置く。 */
    character?: string;
    /** 背景色（既定 #fafafa の白）。 */
    background?: string;
    /** 文字色（既定 #121212 の黒）。背景を暗くするなら白に。 */
    ink?: string;
    /** 全体の出現タイミング微調整（秒）。+で遅く、-で早く。 */
    timingOffsetSec?: number;
    /** 冒頭クレジットの秒（任意・文言は input/project.json）。項目順に [{from,to}]。 */
    credits?: CreditTiming[];
  };
  lyrics: SnapLine[];
}

/** 実行時に t/hold から算出する内部型 */
export interface RuntimeSnap extends SnapLine {
  startFrame: number;
  endFrame: number;
}
