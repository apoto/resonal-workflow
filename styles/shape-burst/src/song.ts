/**
 * song.ts — 曲ごとに書き換える秒（値はダミー）。
 * セクション境界はマスター音源の実測（whisper の word オンセット等）で置き換える。
 * Stage.tsx の構図・表情・雲のキュー表はこの SEC を参照する。
 */

export const DUR = 60;

export const SEC = {
  VERSE1B: 6.0,
  PRE1: 10.0,
  CHORUS1: 14.0,
  INTERLUDE1: 22.0, // ← クレジット枠
  VERSE2: 26.0,
  PRE2: 30.0,
  INTERLUDE2: 34.0,
  POST: 36.0,
  BRIDGE: 38.0, // 落ちサビ（halftime）
  FINAL: 44.0,
  OUTRO: 52.0,
  GAP: 56.0,
  REPRISE: 58.0,
};

/** 縦ショートの切り出し区間（秒）。サビの途中で切らない */
export const SHORT_START = 10.0;
export const SHORT_END = 26.0;

/** クレジット（input/project.json の credits）を出す区間。器楽の隙間に置き、1枚ずつ step 秒 */
export const CREDITS_FROM = 22.2;
export const CREDITS_STEP = 1.2;
