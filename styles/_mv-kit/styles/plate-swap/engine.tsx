import React from 'react';
import { loadFont as loadDela } from '@remotion/google-fonts/DelaGothicOne';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadMochiy } from '@remotion/google-fonts/MochiyPopOne';
import { loadFont as loadZen } from '@remotion/google-fonts/ZenKakuGothicNew';
import { loadFont as loadSerif } from '@remotion/google-fonts/NotoSerifJP';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';

/**
 * plate-swap スタイルの描画部品。
 *
 *   参照は筆文字だが、ゴシック体／ポップ体に差し替えている。
 *   筆文字（Yuji Syuku）は線が細すぎる（同じ級数でのインク占有率）:
 *
 *     書体               暗地/明字  ベタ地/黒字  白地/明字
 *     Yuji Syuku            13.9%     9.1%     8.3%   ← 明るい地で負ける
 *     Dela Gothic One       31.8%    19.2%    21.4%   ← 最重量
 *     Noto Sans JP 900      26.6%    16.4%    19.2%
 *     Mochiy Pop One        27.1%    16.4%    21.0%
 *
 *   → **役割で2書体**。極大の短い語は Dela（最重量）、長い行は Noto 900（字間が詰まらず読める）。
 *
 * ★★色は**このファイルに書かない**。曲ごとに変わるので `spec.stage.palette` から取る。
 *   ここに焼き込むと再着色でスタイルパックを編集することになり、他の曲まで巻き込む。
 *   （定数として置いてあるのは「palette 未指定時の既定」だけ）
 *
 * ★装飾を足した瞬間にカラオケ字幕になる（RESONAL で3回やった失敗）。
 *   stroke / textShadow をこのファイルに書き足さないこと。
 *   細く見えるときの解は「級数を上げる」「地を締める」「書体を替える」で、装飾ではない。
 */

// as const は readonly になり各ローダの subsets(mutable array) に代入できない
const opt = { subsets: ['japanese', 'latin'] as ('japanese' | 'latin')[], ignoreTooManyRequestsWarning: true };

const DELA = loadDela('normal', { ...opt }).fontFamily;
const NOTO = loadNoto('normal', { ...opt, weights: ['900'] }).fontFamily;
const MOCHIY = loadMochiy('normal', { ...opt }).fontFamily;
const ZEN = loadZen('normal', { ...opt, weights: ['400', '500'] }).fontFamily;
const SERIF = loadSerif('normal', { ...opt, weights: ['500', '900'] }).fontFamily;
const PLAYFAIR = loadPlayfair('normal', { subsets: ['latin'], ignoreTooManyRequestsWarning: true }).fontFamily;

/**
 * 書体セット。
 * - gothic : 極太角ゴ（Dela ＋ Noto 900）。**決め字＝1語だけ大きく出す**用
 * - pop    : 丸ポップ全振り（Mochiy Pop One）。明るい曲・かわいい曲
 * - thin   : 細めの角ゴ（Zen Kaku Gothic New）。**本文＝余白に小さく置く行**用
 * - serif  : 明朝（Noto Serif JP）。決め字を重くせず品を出したいとき
 * - latin  : 英字だけ細いセリフ（Playfair Display）
 *
 *   参照の雰囲気＝**細い書体・小さい級数・左に短く縦積み**で、極太は決め字1語に限る。
 */
export type Face = 'gothic' | 'pop' | 'thin' | 'serif' | 'latin';
export type Role = 'display' | 'read';

/** 役割 × 書体セット から実際のフォント指定を返す */
export const fontFor = (face: Face, role: Role): React.CSSProperties => {
  // letterSpacing は**最後の字の後ろにも入る**ので、中央寄せすると同じ幅だけ左にズレる。
  // 実測で 1920px 中 40px 左に寄っていた。marginRight で打ち消す。
  if (face === 'pop') {
    const ls = role === 'display' ? '0.01em' : '0em';
    return { fontFamily: MOCHIY, fontWeight: 400, letterSpacing: ls, marginRight: `-${ls}` };
  }
  if (face === 'thin') {
    // 本文用。小さく置くので字間を少し開ける（詰めると団子になる）
    const ls = '0.10em';
    return { fontFamily: ZEN, fontWeight: role === 'display' ? 500 : 400, letterSpacing: ls, marginRight: `-${ls}` };
  }
  if (face === 'serif') {
    const ls = '0.06em';
    return { fontFamily: SERIF, fontWeight: role === 'display' ? 900 : 500, letterSpacing: ls, marginRight: `-${ls}` };
  }
  if (face === 'latin') {
    const ls = '0.08em';
    return { fontFamily: PLAYFAIR, fontWeight: role === 'display' ? 700 : 400, letterSpacing: ls, marginRight: `-${ls}` };
  }
  return role === 'display'
    ? // Dela は CJK のサイドベアリングが狭く、字間を足さないと「夜を渡る」が接触する
      { fontFamily: DELA, fontWeight: 400, letterSpacing: '0.03em', marginRight: '-0.03em' }
    : { fontFamily: NOTO, fontWeight: 900, letterSpacing: '0.01em', marginRight: '-0.01em' };
};

/**
 * palette のキー。曲ごとに `spec.stage.palette` で差し替える。
 *
 *   bright     暗い面に置く明るい文字（参照実測はゴールデンイエロー）
 *   ink        明るい面に置く暗い文字／シルエット
 *   muted      高キー面に置く小さい副次の文字
 *   field      単色ベタ面の地
 *   paper      高キー面の地
 *   sky        写真的な地の下敷き（画像の隙間を埋める）
 *   glow       窓明かり・点光源
 */
export type NcPaletteKey = 'bright' | 'ink' | 'muted' | 'field' | 'paper' | 'sky' | 'glow';

/** palette 未指定時の既定（参照MVの実測値）。曲では上書きする前提。 */
export const NC_DEFAULT_PALETTE: Record<NcPaletteKey, string> = {
  bright: '#E9C93E',
  ink: '#141014',
  muted: '#6E6E72',
  field: '#F2C61F',
  paper: '#FBFAF7',
  sky: '#080A0E',
  glow: 'rgba(226,238,255,0.85)',
};

export const pal = (palette: Record<string, string>, key: NcPaletteKey) =>
  palette[key] ?? NC_DEFAULT_PALETTE[key];

/** 文字の塗り。★セクションではなく「地」で決める（明るい地に明るい文字を置くと必ず負ける） */
export type NcMaterial = 'bright' | 'ink' | 'muted';

export const paintFor = (m: NcMaterial, palette: Record<string, string>): React.CSSProperties => ({
  // 単色ベタのみ。縁・影・グローは足さない
  color: pal(palette, m),
});

/** 決定論的な擬似乱数（Math.random はフレーム毎に再評価されて画がちらつく） */
export const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 1行を em 単位の見かけ幅で見積もる。
 */
export const emWidthOf = (text: string, spaceEm = 0.32) =>
  Array.from(text).reduce((w, ch) => {
    if (/^\s$/.test(ch)) return w + spaceEm;
    // 全角（CJK・かな・全角記号）は 1em、それ以外（ラテン・数字）は 0.55em
    if (/[　-ヿ㐀-鿿豈-﫿＀-｠￠-￦]/.test(ch)) return w + 1;
    return w + 0.55;
  }, 0);

/**
 * 行が使える幅に収まるフォントサイズを返す（**縮める方向にだけ**効く）。
 * 収まっていれば要求サイズをそのまま返す＝既存の短い行の見た目は変わらない。
 */
export const fitSize = (requested: number, text: string, availablePx: number, spaceEm = 0.32) => {
  const em = emWidthOf(text, spaceEm);
  if (em <= 0) return requested;
  return Math.min(requested, availablePx / em);
};
