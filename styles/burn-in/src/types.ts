// burn-in スタイルの入力スキーマ（input/lyrics.json）
// タイミングは秒（t=表示開始, hold=表示秒）。frame への変換はコード側。

export type LineKind =
  | 'normal' // 通常歌詞（白・ハードカット→補色ゴースト化）
  | 'chorus' // サビ（ゴースト濃いめ）
  | 'slam' // タイトル特大スラム（Drop頭）
  | 'whisper' // 囁き（視認ぎりぎりの明度・ゴースト無し。暗転中も表示）
  | 'echo'; // ゴーストのみの残響（間奏の間持たせ。live表示なし）

export interface GLine {
  text: string;
  t: number; // 表示開始（秒）
  hold: number; // 表示時間（秒）
  kind?: LineKind; // 既定 normal
  size?: number; // フォントpx（1920幅基準・既定72）
  x?: number; // 横位置%（既定50）
  y?: number; // 縦位置%（既定50）
}

/** 囁きギミック: ネガ反転→完全暗転（暗転中はゴーストだけが浮かぶ）→Drop */
export interface Gimmick {
  invert: number; // ネガ反転フラッシュ開始（秒・~0.25s）
  blackoutStart: number;
  blackoutEnd: number; // ここで Drop（白フラッシュ＋それ以前のゴースト一掃）
}

export interface BurnInData {
  meta: {
    duration: number; // 秒
    fps: number;
    width?: number;
    height?: number;
    audio?: string; // public/ 内
    timingOffsetSec?: number;
    gimmicks: Gimmick[];
    finalInvert?: number; // 終端「最後の一発」のネガ反転（秒）
    /** 背景に沈めるキャラ画像の焼きつき（public/ 内の画像）。無ければ純黒。 */
    backgroundImage?: string;
    /** サビ/Drop 等、背景の焼きつきが少し浮かぶ区間（秒） */
    energyZones?: [number, number][];
    /** クレジット（input/project.json の credits）を出し始める秒。1枚 creditStep 秒（既定1.6）。省略で出さない */
    creditsAt?: number;
    creditStep?: number;
    /** 残像実験シーケンス（インストDrop用）: 引きで明るく注視→ネガ反転→暗転で疑似残像が消えていく */
    stare?: {
      start: number; // 明るい引き表示の開始（秒）
      invertAt: number; // ネガ反転に切り替え（焼き付けフラッシュ）
      cutAt: number; // 暗転（以降 ghostUntil まで疑似残像がフェード）
      ghostUntil: number;
    };
  };
  lyrics: GLine[];
}
