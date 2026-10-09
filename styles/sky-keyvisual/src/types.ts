/** ===== sky-keyvisual スキーマ =====
 *  3層構造: ①面(field) ②キャラ(透過WebM / 静止画) ③オーバーレイ(タイポ。Overlay.tsx の部品は任意)
 *  秒で持つ（frame 変換はコード側）。 */

/** 面（背景）の種類 */
export type FieldKind =
  | 'venue'       // 全灯した会場（正面・既定）
  | 'venue-wide'  // 会場の引き（全景・一点透視）
  | 'venue-close' // 会場の寄り（ローアングル・手前にケーブル/スタンド）
  | 'sunset'     // 夕焼けオレンジの面（落ちサビの反転先）
  | 'dim'        // 消灯が進んだ薄暗い会場（Breakdown）
  | 'white';     // 白へ収束（Outro）

/** キャラのクリップ（public/character/*.webm・public/still/*.png。対応表は Character.tsx） */
export type ClipId =
  | 'A-standing' | 'B-beckon' | 'C-para-A' | 'C-para-B'
  | 'D-armsup' | 'E-closeup' | 'F-shrug' | 'G-still'
  | 'none';

/** カメラのギア（3段ギア） */
export type Gear = 'drift' | 'build' | 'beat';

/** タイポの出し方 */
export type TypoMode =
  | 'swap'    // 語単位の逐次入れ替え（kinetic-swap）
  | 'stack'   // 1拍1ワードで積む（beat-word-stack・掛け合いの応酬）
  | 'bomb'    // タイポグラフィ・ボム（画面いっぱいのタイトル語）
  | 'small'   // 小さく下寄せ（会話行）
  | 'none';

export interface Section {
  /** カット番号 */
  no: number;
  start: number;
  end: number;
  label: string;
  field: FieldKind;
  clip: ClipId;
  /** サビ用: 複数クリップを小節単位で切り替えて「いろんな踊り」に見せる。 */
  clips?: ClipId[];
  /** 何小節ごとに切り替えるか（既定2小節） */
  switchBars?: number;
  /** フレーミング（全身はサビだけ・それ以外はバストアップか足元、が既定の考え方）
   *  full=全身 / bust=バストアップ / feet=足元だけ */
  framing?: 'full' | 'bust' | 'feet';
  /** 静側: 動画を使わず静止画（透過PNG）で持たせる。カメラワークとエフェクトで見せる。 */
  still?: boolean;
  gear: Gear;
  /** キャラを黒シルエットにする（落ちサビ） */
  silhouette?: boolean;
  /** オーバーレイの密度 0..1（サビ=1 / Verse=0.35 / Breakdown=0.1） */
  density?: number;
  /** 時計サークルを逆回転させる（Overlay.tsx 用） */
  clockReverse?: boolean;
  /** カメラ高さ（構図ジャンプ用・-1..1／同型セクションで必ず変える） */
  camY?: number;
  /** 寄り（1=標準・1.15=寄り） */
  zoom?: number;
}

export interface LyricLine {
  text: string;
  t: number;
  hold?: number;
  mode: TypoMode;
  /** stack 用：積む位置のインデックス（0..n） */
  slot?: number;
  scale?: number;
}

export interface LyricData {
  meta: {
    duration: number;
    fps: number;
    width?: number;
    height?: number;
    audio?: string;
    /** 全体のタイミング微調整（秒） */
    timingOffsetSec?: number;
    bpm: number;
    /** キャラクリップの実尺（秒）。小節長へリタイムするのに使う */
    clipDuration: number;
    /** クリップごとの位置/大きさ補正（枠正規化） */
    clipAdjust?: Record<string, { scale?: number; x?: number; y?: number }>;
    /** クレジット（input/project.json の credits）を出し始める秒と1枚の秒。省略で出さない */
    creditsFrom?: number;
    creditsStep?: number;
    sections: Section[];
    /** 打点（秒）。zoom-punch / shake / rgb-split をここで打つ。drop/サビ限定。 */
    hits?: number[];
    /** エンドカード（public/ の画像）の表示区間 */
    endcard?: { start: number; end: number; src: string };
  };
  lyrics: LyricLine[];
}

export interface RuntimeLyric extends LyricLine {
  startFrame: number;
  endFrame: number;
}
