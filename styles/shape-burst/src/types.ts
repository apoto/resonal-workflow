// 歌詞MVスキーマ（invert-shapes と共通の形を shape-burst で拡張したもの。型名はそのまま）。
// タイミングは秒ベース（t=開始秒, hold=表示秒）。「1フレーズ＝1画面のハードカット」。
// shape-burst で使うのは t / hold / text / size / tilt / drop / english / cold。reveal・shapes は invert-shapes 由来で未使用。

// ソリッド白図形（丸/三角/四角）を文字に紐付けて置く指定。
export type ShapeSpec = {
  at: number;                          // どの文字index（Array.from基準）に紐付くか
  kind: number;                        // 0=丸 1=三角 2=四角
  mode: 'big' | 'cover' | 'point';     // big=文字を跨ぐ極大 / cover=1文字覆い / point=端にポツン
  corner?: 'tr' | 'br' | 'tl' | 'bl';  // point の寄せ方向
  dx?: number;                         // big の水平ずらし（em, size基準）
};

export type Phrase = {
  t: number;              // 開始秒
  hold: number;           // 表示秒（この間だけ画面に出る＝ハードカット）
  text: string;           // 表示テキスト（日本語/英語）
  size?: number;          // フォントサイズ(px, 1920幅基準)。省略時 380
  reveal?: 'flow' | 'swap';// flow=左→右に高速1文字ずつ / swap=中央で1文字ずつ上書き
  tilt?: number;          // フレーズ全体の傾き（度）。省略時 0
  shapes?: ShapeSpec[];   // ソリッド白図形。空/省略＝図形なし（極大文字だけ）
  // --- shape-burst 拡張 ---
  drop?: boolean;         // Drop/サビ＝特大＋色収差グリッチで殴る
  english?: boolean;      // 英語フック（字送り微調整）
  cold?: boolean;         // 低体温Verse＝色収差を意味同期で薄く（eyeの要素を盗む）
};

export type InvertShapesMeta = {
  duration: number;           // 全体尺（秒）
  fps: number;                // 30
  width?: number;             // 1920
  height?: number;            // 1080
  audio: string;              // public/ 配下の音源（例 audio.mp3）
  bg?: string;                // 16:9 静止画フォールバック（無ければ単色BG）
  bgVertical?: string;        // 9:16 静止画フォールバック
  bgVideo?: string;           // 16:9 ループ動画背景（shape-burst では未使用）
  bgVideoVertical?: string;   // 9:16 ループ動画背景
  bgVideoSec?: number;        // ループ動画1本の秒数
  timingOffsetSec?: number;   // 全フレーズのt一括補正
  bpm?: number;               // 参考（figureの脈動などに使用可）
  bgColor?: string;           // 背景ベース色。省略時 #1b0a2e（ディープパープル）
  thumbTitle?: string;        // サムネのタイトル（省略時 input/project.json の title）

  // --- 多層パララックス -------------------------------------------------------------
  // 遠景 / 雲エフェクト / キャラ / 前景の綿 を別レイヤーにして、1つのカメラを depth 係数で
  // 分配する＝視差で奥行きを出す。詳細は src/Stage.tsx。
  /** 遠景プレート（キャラなし）。フレーム幅より大きい画を入れる＝パンの余地になる。 */
  bgFar?: string;
  /** 9:16 用の遠景プレート（省略時は bgFar を流用）。 */
  bgFarVertical?: string;
  /** キャラの透過プレート。表情ごとに差分を持つ。key は Stage.tsx の ExprKey と対応。 */
  charPlates?: Record<string, string>;
  /**
   * キャラの微動ループ（透過 PNG 連番 001.png〜）を表情ごとに持つ。key は Stage.tsx の ExprKey。
   * その表情の連番があれば静止画より優先して再生する。
   * dir=public配下のディレクトリ, len=連番枚数, fps=連番の再生fps。
   */
  charSeqs?: Record<string, { dir: string; len: number; fps?: number }>;
  /**
   * 顔アップ専用の透過プレート（**頭上に余白のある別フレーミング**）。
   * 頭がプレート上端に接している立ち絵は拡大すると頭が切れるため、
   * 本物の顔アップはこの専用プレートに切り替えて出す（Stage.tsx の FACE_* 構図）。
   */
  charCloseup?: string;
};

export type InvertShapesData = {
  meta: InvertShapesMeta;
  phrases: Phrase[];
};
