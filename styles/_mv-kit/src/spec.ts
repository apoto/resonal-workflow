/**
 * 設計上の一番大事な決定:
 *   **treatment（見せ方）は Section が持ち、Line は持たない。**
 *
 * 行ごとに変えられるのは params（どの語を立てるか・大きさ・位置・アクセント）だけ。
 * 見せ方を変えたければセクションを切る＝「なぜここで変えるのか」を明示させる。
 */

export type SectionKind =
  | 'intro'
  | 'verse'
  | 'pre'
  | 'chorus'
  | 'bridge'
  | 'drop'
  | 'inst'
  | 'outro';

/** 1行 = 歌詞1行が画面に出る単位。**見せ方は持てない。** */
export type Line = {
  /** 開始秒（曲頭からの絶対秒） */
  t: number;
  /** 表示秒 */
  hold: number;
  text: string;
  /**
   * その行だけのパラメータ上書き。treatment が解釈する。
   * 見せ方そのものを差し替える用途に使わないこと（型では防げないのでlintで見る）。
   */
  params?: LineParams;
};

export type LineParams = {
  /** 基準サイズに対する倍率。1 = セクション既定 */
  scale?: number;
  /** 縦位置(%)。省略時は treatment の既定 */
  y?: number;
  /** アクセント強調（サビのキメ等）。treatment 側で解釈 */
  accent?: boolean;
  /** 語り口調・セリフ感 */
  soft?: boolean;
  /** 意味同期のノイズ（"バグ"等）。常時掛けない */
  glitch?: boolean;
  /** 縦ショートには出さない */
  wideOnly?: boolean;
  /** treatment 固有の追加パラメータ */
  [k: string]: unknown;
};

/**
 * 被写体プレート（静止画1枚）。セクションごとに寄り/表情を差し替える。
 * キャラを動かすのではなく**プレートを差し替える**のが RESONAL の作り方
 * （参考MVの実測でもキャラ区間は相関1.000＝完全に静止していた）。
 */
export type Figure = {
  /** public/ 配下のパス。`seq` を渡すときは省略できる */
  src?: string;
  /**
   * 動画生成した微動ループを**透過連番PNG**で再生する。
   */
  seq?: { dir: string; len: number; fps?: number };
  /** 画面幅に対する倍率 */
  scale?: number;
  /** 中心位置(%) */
  x?: number;
  y?: number;
  /** 左右反転 */
  flip?: boolean;
};

/**
 * セクションごとの「面」と被写体。
 *
 * ★これが無いと spec 全体で背景1つしか持てず、
 *   「曲の中で面（都市／ベタ色／白）を切り替える」型が組めない（flat-field-swap）。
 *   曲ごとに変わるのは field の params（画像パス・色）と figure の src なので、
 *   **スタイルパック側に画像名や色を焼き込まない。**
 */
export type SectionStage = {
  /** registry の field id。省略時は spec.stage の背景がそのまま出る */
  field?: string;
  /** field へのパラメータ（画像パス・色・パン量など曲ごとの可変分） */
  fieldParams?: Record<string, unknown>;
  /** 被写体プレート。複数置ける（前後の重なりは配列順） */
  figures?: Figure[];
};

/** セクション = 見せ方が一定な区間。ここが組み立ての単位。 */
export type Section = {
  id: string;
  kind: SectionKind;
  /** 区間（秒）。lines はこの中に収まっていること（lint が見る） */
  from: number;
  to: number;
  /** このセクション全体の見せ方。registry の treatment id */
  treatment: string;
  /** treatment へのセクション既定パラメータ */
  params?: Record<string, unknown>;
  /** 隣接セクションと同じ treatment を意図的に使う場合に立てる */
  allowRepeat?: boolean;
  lines: Line[];
  /** このセクションだけに掛けるオーバーレイ（合いの手・FX）。treatment とは別レイヤー */
  overlays?: Overlay[];
  /** この区間の面と被写体。省略すると spec.stage の背景のまま */
  stage?: SectionStage;
};

export type StageFx = {
  id: string;
  from: number;
  to: number;
  params?: Record<string, unknown>;
};

/** オーバーレイ = 主役の見せ方を変えずに足す装飾。合いの手・画面FX。 */
export type Overlay = {
  /** registry の overlay id */
  id: string;
  t: number;
  hold: number;
  params?: Record<string, unknown>;
};

export type SceneMeta = {
  title: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  /** public/ 配下の音源 */
  audio: string;
  bpm?: number;
  /** 全セクション共通の時間オフセット（音源差し替え時の微調整用） */
  timingOffsetSec?: number;
};

export type SceneSpec = {
  meta: SceneMeta;
  /** スタイルパック id（registry のどの treatment 群を使うか） */
  style: string;
  /** 曲全体の背景・常時レイヤー */
  stage: {
    background?: string;
    backgroundVideo?: string;
    /** **stage.fx の外**に出す最後の層（セクションid の配列） */
    afterFx?: string[];
    backgroundVideoSec?: number;
    /** ベタ色（画像が無い/透ける時の下地） */
    fill?: string;
    /**
     * 曲ごとの配色。treatment / field / overlay に渡る。
     * キー名はスタイルパックが決める（キットは中身を知らない）。
     * ★スタイルパックのソースに色を焼き込まないための口。ここを差し替えれば再着色が終わる。
     */
    palette?: Record<string, string>;
    /** 常時掛けるアンビエント（デコ/グレイン等）。registry の overlay id。**被写体より後ろ**に出る */
    ambient?: Overlay[];
    /**
     * `ambient` と同じだが **被写体（figures）より前・歌詞より後ろ**に出る層。
     */
    ambientFront?: Overlay[];
    /** 画面全体を変形する効果。registry の stageFx id */
    fx?: StageFx[];
  };
  sections: Section[];
};

/** 全行をフラットに取り出す（レンダラ/lint 用） */
export const allLines = (spec: SceneSpec): { line: Line; section: Section; index: number }[] =>
  spec.sections.flatMap((section) =>
    section.lines.map((line, index) => ({ line, section, index }))
  );

/** 使われている treatment の集合 */
export const treatmentsUsed = (spec: SceneSpec): string[] =>
  Array.from(new Set(spec.sections.map((s) => s.treatment)));
