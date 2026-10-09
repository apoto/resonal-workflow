import { CreditTiming } from './Credits';

// input/lyrics.json のスキーマ
// 編集しやすいよう「秒」で持つ（t=開始秒, hold=表示秒）。frameへの変換はコード側で行う。
export type LyricStyle = 'vertical' | 'center' | 'huge-flash';

export interface LyricLine {
  text: string;
  /** 表示開始（秒）。手調整はここをいじる。 */
  t: number;
  /** 表示時間（秒）。省略時は既定値。 */
  hold?: number;
  style: LyricStyle;
  /** 文字サイズ倍率（既定1）。「もう一本！」徐々拡大などに使用。 */
  scale?: number;
  /** 'center' で画面中央にピン留め（散らし配置を無効化）。 */
  pin?: 'center';
  /** true で画面内クランプを無効化＝意図的に画面からはみ出して特大表示（連呼の最後の一撃など）。
   *  省略時も huge-flash かつ scale>=1.5 なら自動ではみ出し。 */
  overflow?: boolean;
  /** true のときだけ、同時刻に表示される他の stagger 行と縦バンドに振り分けて重なりを避ける。
   *  省略（=false）ならデフォルト位置で静止＝動かない（サビ等はこちらで「ちゃんと読める」）。
   *  歌詞が重なって潰れる「ここぞ」の箇所にだけ付ける。 */
  stagger?: boolean;
  /** 任意：強調アクセント色の上書き */
  accent?: string;
}

/** 背景演出シーン（秒区間）。
 *  blackout=暗転 / bgGlitch=激しい背景グリッチ（スタッター＋データモッシュ） /
 *  bgChroma=軽い赤青の色ズレ（カクつき無し・サビ向け、歌詞は読める） */
export interface Scene {
  start: number; // 秒
  end: number; // 秒
  effect: 'blackout' | 'bgGlitch' | 'bgChroma';
  intensity?: number; // 0..1（既定1）
  /** bgChroma 用：この秒で「ドン！」と色ズレが跳ね、砂嵐ノイズ＋一瞬ブラーが乗る瞬間。
   *  省略時は start を1回だけ使う。 */
  hits?: number[];
}

export interface LyricData {
  meta: {
    duration: number; // 秒
    fps: number;
    width?: number; // 既定 1920
    height?: number; // 既定 1080
    background?: string; // public/ 内の画像ファイル名（静止画フォールバック背景）
    backgroundVideo?: string; // public/ 内のループ動画ファイル名（あれば優先して背景に流す）
    backgroundVideoDuration?: number; // ループ動画の尺（秒）
    audio?: string; // public/ 内の音源ファイル名
    /** 全体の出現タイミング微調整（秒）。+で遅く、-で早く。手調整の基準点。 */
    timingOffsetSec?: number;
    /** 背景演出シーン */
    scenes?: Scene[];
    /** 冒頭クレジットの秒（任意・文言は input/project.json）。項目順に [{from,to}]。 */
    credits?: CreditTiming[];
  };
  beats: number[]; // フレーム番号（このフレーム付近でフラッシュ/パルス）
  lyrics: LyricLine[];
}

/** 実行時に t/hold から算出する内部型 */
export interface RuntimeLyric extends LyricLine {
  startFrame: number;
  endFrame: number;
}
