// pink-bounce 歌詞MVのスキーマ正本。タイミングは秒ベース（t=開始秒, hold=表示秒）。
export type Pattern = 'center' | 'split' | 'scatter' | 'giant';

export type ScatterWord = {
  t: string;   // 表示テキスト
  size: number; // フォントサイズ(px, 1920幅基準)
  x: number;   // 左上基準の中心位置(%)
  y: number;
  rot: number; // 傾き(度)
};

export type Line = {
  t: number;    // 開始秒
  hold: number; // 表示秒
  pattern: Pattern;
  text?: string;              // center / giant
  left?: string;              // split 左カラム（縦書き）
  right?: string;             // split 右カラム（縦書き）
  words?: ScatterWord[];      // scatter
  size?: number;              // center / giant 基準サイズ(px, 1920幅基準)
  y?: number;                 // center の縦位置(%)。省略時74（顔を避けて下寄せ）
  neon?: boolean;             // 内フチをネオン（サビ/キメ）
  handwrite?: boolean;        // セリフ感（丸ゴシック・字間広め）
  deco?: boolean;             // ドット絵デコ（省略時true）
};

// 曲構成。カメラの動き（Camera.ts）とFXの配合（SectionFx.tsx）をここから引く。
export type SectionName =
  | 'intro'
  | 'verse'
  | 'prechorus'
  | 'build'
  | 'chorus'
  | 'post'
  | 'breakdown'
  | 'bridge'
  | 'outro';

export type Section = { name: SectionName; start: number; end: number };

// シーン（区間ごとの背景絵）。1枚の絵で全尺を持たせるとどうしてもマンネリるので、
// サビ以外は区間ごとに別の絵へハードカットする。サビは4ポーズ切替を維持する＝帰ってくる場所。
export type Scene = {
  start: number;
  end: number;
  src: string;           // 16:9 用
  vertical?: string;     // 9:16 用（無ければ src をクロップして使う）
  /** この区間はサビの4ポーズ切替を使う（背景絵ではなく poses を出す） */
  poses?: boolean;
  /** カット時の寄り方（1.0=そのまま）。絵ごとの「引き/寄り」を微調整する */
  zoom?: number;
};

/**
 * 区間ごとのカラーグレード。
 * 16:9 の元絵は 1672×941 で 1920 枠より小さい＝**寄りのクロップで場面差を作ると画が甘くなる**。
 * なので「同じ絵でも時間帯で光と色が変わる」方向で差を作る。新規シーン絵が入っても併用できる。
 */
export type Grade = {
  saturate?: number;   // 1.0=そのまま
  brightness?: number;
  contrast?: number;
  hueRotate?: number;  // deg
  /** 上に重ねる色かぶり（rgba）と強さ */
  tint?: string;
  tintOpacity?: number;
  /** 周辺減光の強さ 0..1 */
  vignette?: number;
};

// 冒頭クレジットのカード。lyrics.json には秒（t/hold）だけ書き、文言は input/project.json の credits から入る。
export type IntroCard = {
  t: number;
  hold: number;
  title?: string;
  sub?: string;
  big?: boolean;
};

export type LyricMeta = {
  duration: number;
  fps: number;
  width?: number;
  height?: number;
  audio: string;
  background: string;         // 16:9 背景（静止画）
  backgroundVertical: string; // 9:16 背景（静止画）
  backgroundPoses?: string[];         // 16:9 漫画モーション用ポーズ列
  backgroundVerticalPoses?: string[]; // 9:16 漫画モーション用ポーズ列
  timingOffsetSec?: number;
  bpm?: number;
  danceRegions?: [number, number][]; // サビ等（秒・絶対タイム）。背景キャラが腰グルーヴで踊る区間
  biteRegions?: [number, number][];  // 左右の食べポーズを切り替えるサビ区間
  sections?: Section[];              // 曲構成（カメラ/FXの配合を切り替える）
  intro?: IntroCard[];               // 冒頭クレジットのカード列
  scenes?: Scene[];                  // 区間ごとの背景絵（無ければ background 1枚で全尺）
};

export type LyricData = {
  meta: LyricMeta;
  lines: Line[];
};
