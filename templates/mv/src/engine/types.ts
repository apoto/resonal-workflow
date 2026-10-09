// 歌詞MV — 3層アーキテクチャの型。
//  engine  … カメラ/合成/同期/レンダ（共通・曲ごとに触らない）
//  style   … 見た目のスキン（フォント/パレット/字幕/デコ）＝差し替え可能
//  config  … 曲ごとの振り付け（ショット割・演出の秒）＝input/song.config.ts に毎回書く
import type React from 'react';

export type Pattern =
  | 'title' | 'verse' | 'whisper' | 'drop' | 'hud' | 'break' | 'slam' | 'cut' | 'end';

export type Line = {
  t: number; hold: number; pattern: Pattern; text: string;
  sub?: string; size?: number; y?: number;
  maxSize?: number; // 04_build_lyrics.py が行幅から計算した上限 px（はみ出し防止。style は size をこれで頭打ちにする）
};

export type KF = { t: number; px: number; py: number; s: number };

export type Shot = {
  start: number; end: number; kf: KF[];
  intensity?: number; shake?: number; vertical?: boolean;
  tilt?: number; sway?: boolean; bounce?: number; fx?: string; hype?: boolean;
  useWide?: boolean; // 縦compでも横版(16:9)素材を使う＝端の要素に寄れる
};

// レイヤー間の光（style.DecoBehind=放射 / style.DecoFront=吸い込みトンネル）
export type Light = { rainbow: number; tunnelP: number };

// 全画面の決め（engine が描く）
export type Cut = { at: number; rise?: number; hold?: number; fall?: number; hard?: boolean };

// クレジット（文言は workflow.config.json の credits → input/project.json。秒は song.config.ts）
export type Credit = { text: string; subtitle?: string; from: number; to: number };

// style.Overlay に渡す色付きグローバルFXの窓
export type OverlayFX = {
  breathes?: { from: number; to: number }[];
  blooms?: { from: number; to: number; base?: number; amp?: number }[];
  strobes?: { from: number; to: number }[];
  lensHits?: number[];
};

export type SongConfig = {
  meta: { duration: number; fps: number; width?: number; height?: number; audio: string; bpm?: number; shortScale?: number };
  lines: Line[];                          // 歌詞（input/lyrics.json 由来）
  style: string;                          // styles/registry のキー
  shots16: Shot[];
  shotsShort: Shot[];
  short: { start: number; end: number };
  dropHits: number[];                     // ズームパンチの強打秒
  lightAt: (sec: number) => Light;        // 放射/トンネルの時間割
  moodBright: [number, number, number?][];// [from,to,weight?] 明るくする窓
  whiteouts?: Cut[];
  blackouts?: Cut[];
  credits?: Credit[];                     // engine/Credits.tsx が描く（06_verify が検査）
  fx?: OverlayFX;
  eye?: { wide: [number, number]; vert: [number, number] }; // トンネル収束点の画像座標(%)。wide=16:9素材 / vert=9:16素材
  thumbnail?: { title: string; sub: string };
  bgLoop?: { wide: number | null; vert: number | null }; // 背景ループ動画の尺（秒）。null は静止画 bg*.png
  scenes?: Scene[];                       // 背景の画像を秒で切り替える（曲フォルダの scenes.json → input/project.json）
};

// シーン: from 秒から次のシーンまで、この画像を背景にする（wide=16:9 / vert=9:16）
export type Scene = { from: number; wide: string; vert: string };

// ---- Style インターフェース（各スタイルが実装する契約）----
export type PhraseProps = { line: Line; idx: number; scale?: number };
export type DecoProps = { light: Light; vx?: number; vy?: number };
export type OverlayProps = { fx: OverlayFX; offset?: number };

export type Style = {
  name: string;
  Phrase: React.FC<PhraseProps>;      // 字幕（pattern別の見せ方）
  Grade: React.FC;                    // 画面グレード
  Hud: React.FC<{ scale?: number; hideDuring?: [number, number][] }>;  // HUD。hideDuring=停電窓で非表示
  DecoBehind: React.FC<DecoProps>;    // 被写体の"後ろ"に挟む装飾
  DecoFront: React.FC<DecoProps>;     // 被写体の"前"に挟む装飾
  Overlay: React.FC<OverlayProps>;    // 最前面の色付きグローバルFX
  ThumbTitle: React.FC<{ title: string; sub: string }>; // サムネのタイトル表現
};
