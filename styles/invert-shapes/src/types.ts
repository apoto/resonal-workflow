// invert-shapes 歌詞MVスキーマ。タイミングは秒ベース（t=開始秒, hold=表示秒）。
// spectrum-still テンプレの pattern ベースとは別物：invert-shapes は「1フレーズ＝1画面のハードカット」で、
// 見せ方は reveal（flow / swap）＋ソリッド白図形＋ネガポジ反転で作る。

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
  reveal: 'flow' | 'swap' | 'block'; // flow=左→右に高速1文字ずつ / swap=中央で1文字ずつ上書き / block=全文字を同時に出す（塊）
  tilt?: number;          // フレーズ全体の傾き（度）。省略時 0
  shapes?: ShapeSpec[];   // ソリッド白図形。空/省略＝図形なし（極大文字だけ）
};

export type InvertShapesMeta = {
  duration: number;           // 全体尺（秒）
  fps: number;                // 30
  width?: number;             // 1920
  height?: number;            // 1080
  audio: string;              // public/ 配下の音源（例 audio.mp3）
  bg?: string;                // 16:9 静止画フォールバック（無ければ単色BG）
  bgVertical?: string;        // 9:16 静止画フォールバック
  bgVideo?: string;           // 16:9 ループ動画背景（あれば静止画より優先）
  bgVideoVertical?: string;   // 9:16 ループ動画背景
  bgVideoSec?: number;        // ループ動画1本の秒数
  timingOffsetSec?: number;   // 全フレーズのt一括補正
  bpm?: number;               // 参考（figureの脈動などに使用可）
  bgColor?: string;           // 背景ベース色。省略時 #1b0a2e（ディープパープル）
  thumbTitle?: string;        // サムネの極太タイトル（★英語のみ・日本語訳/コピーは入れない）

  // ---- 拡張フィールド（曲ごとに使う/使わないを選ぶ）----
  // クレジットの秒（任意）。文言は input/project.json の credits。項目順に [{from,to}]。
  credits?: { from: number; to: number }[];
  // 画面全体のネガ反転（records/negative-invert）。打点だけ＝1秒3回以下を守る。
  // invert-shapes core の「白図形×文字の difference」とは別レイヤ（あちらは全編）。
  // t=秒 / f=フレーム数 / kind: 'big'=画面全体を白黒反転(+電光2本)・**ここぞだけ** / 'small'=反転せず電光1本だけ
  // 大小に分けた理由: 全画面反転が多すぎると目がチカチカする
  invertHits?: { t: number; f: number; kind?: 'big' | 'small' }[];
  // 反転はせず紫スパークだけ走らせる秒（静を守りたい打点）
  sparkHits?: number[];
  // 静区間＝反転ゼロ・スクリム濃め・段階的に暗くする（records/progressive-blackout）
  calmRegions?: { a: number; b: number }[];
  // スクリムを外して被写体の顔を見せる区間（常時全開にすると顔が消える）
  faceRegions?: { a: number; b: number }[];
  // カメラワーク。
  //   微ドリフトだけでは器楽区間が死ぬ。区間ごとに動きの型を割り当てる。
  //   kind: 'pan-up'=下→上へゆっくりパン / 'push-in'=p³カーブで加速して寄る(ビルドアップ) /
  //         'pull-out'=Drop頭でドンと引いてからゆっくり寄る / 'drift'=既定の微ドリフト
  //   'pan-focus'  = 被写体の一点(fromY)から別の一点(toY)へ寄りながら移動（例: 足元→顔）
  //   'pull-focus' = Drop頭でドンと引いてから toY へ寄る（例: 引き→バストアップ）
  //   fromY/toY は画像の縦位置 0=上端 1=下端（全身立ち絵なら 顔≈0.13 / 胸≈0.20 / 腰≈0.45 / 足元≈0.90）
  cameraMoves?: {
    a: number;
    b: number;
    kind: 'pan-up' | 'push-in' | 'pull-out' | 'drift' | 'pan-focus' | 'pull-focus';
    amount?: number;
    fromY?: number;
    toY?: number;
    fromScale?: number;
    toScale?: number;
  }[];
  // ★ビルドアップ区間＝明るさ・HUD・電光の頻度が「徐々に上がる」（calmRegionsの逆）
  buildRegions?: { a: number; b: number }[];
  // ★動画背景(bgVideo)を出す区間。ここ以外は静止画(bg)のまま＝全編を動画にすると
  //   Breakdown / Bridge の「静」が消えて静↔動の振り子が死ぬ（間奏だけに効かせる）。
  videoRegions?: { a: number; b: number }[];
  // HUDオーバーレイ（records/hud-overlay）を出す区間。intensity=1.0 で全開、小さくすると骨組みだけ
  hudRegions?: { a: number; b: number; intensity?: number }[];
  // 冒頭の曲名カード: クレジットの後に曲名を出してから歌い出しへ繋ぐ
  titleCard?: { from: number; to: number };
  // エンドカード: 器楽アウトロを「動画素材→電気がバチッ→暗転→タイトル」で締める
  endCard?: { boltAt: number; blackFrom: number; titleFrom: number; title: string };
  // 縦ショートの切り出し区間
  shortRange?: { a: number; b: number };
};

export type InvertShapesData = {
  meta: InvertShapesMeta;
  phrases: Phrase[];
};
