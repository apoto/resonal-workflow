import React from 'react';
import { loadFont as loadNotoJP } from '@remotion/google-fonts/NotoSansJP';

/**
 * burn-in スタイルの描画部品。
 * treatment（見せ方）から共有される「文字1個をどう塗るか」だけを持つ。
 * 配置・タイミング・動きは treatments.tsx 側。
 *
 * 参照MVの実測（文字の塗り）:
 *
 *   色     単色ベタ #F3CE10（実測 #F4CE0D / #F2CE14）
 *   縁     なし
 *   落ち影 なし
 *   グロー なし
 *   書体   終端が平らな重い角ゴシック（丸ポップ体ではない）
 *
 * 極彩色ネオン背景では白は原理的に沈むので縁が要る→縁を足すとカラオケになる、
 * という悪循環に入っていた。単色ベタ（背景と色で分離する）が解。
 */

export const GFONT = loadNotoJP('normal', {
  subsets: ['japanese', 'latin'],
  weights: ['700', '900'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

/** 参考にした MV で実測した黄。 */
export const HENCE_YELLOW = '#F3CE10';
export const HENCE_WHITE = '#F0F2F1';

/**
 * 素材（マテリアル）。
 * - henceforth : 黄の単色ベタ。装飾ゼロ。サビの既定
 * - white      : 白の単色ベタ。装飾ゼロ。Aメロ縦書き / タメ
 * - prism      : ラスサビ昇格。**動きは同じまま**素材だけ白発光へ
 */
export type Material = 'henceforth' | 'white' | 'prism';

export const paintFor = (material: Material, sizePx: number): React.CSSProperties => {
  if (material === 'prism') {
    // ラスサビ: 白に発光と虹縁。ここだけは装飾を許す（＝昇格の合図）
    return {
      color: '#ffffff',
      textShadow: [
        `0 0 ${sizePx * 0.1}px rgba(255,255,255,0.95)`,
        `0 0 ${sizePx * 0.26}px rgba(190,150,255,0.8)`,
        `${sizePx * 0.014}px 0 0 rgba(255,79,216,0.85)`,
        `-${sizePx * 0.014}px 0 0 rgba(34,224,255,0.85)`,
      ].join(', '),
    };
  }
  // ★装飾は一切足さない。stroke も textShadow も付けない。
  return { color: material === 'white' ? HENCE_WHITE : HENCE_YELLOW };
};

/** 決定論的な擬似乱数（フレーム毎に揺れないよう Math.random は使わない） */
export const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 空白区切りの意味単位に割る。lyrics 側がスペースで切れ目を持っている前提。 */
export const phrases = (text: string) => text.split(/\s+/).filter(Boolean);

/**
 * 階段の単位に割る。1文字=1単位だが、**ラテンの連続は1塊**にまとめる。
 * 日本語主体の歌詞なら1文字=1単位で成立するが、そのまま "Ghosting" に
 * 適用すると語が文字ごとにバラけて崩れる（実際に崩れた）。
 */
export const unitsOf = (w: string) => {
  const out: string[] = [];
  for (const ch of Array.from(w)) {
    const ascii = /[\x00-\x7F]/.test(ch);
    const prevAscii = out.length > 0 && /[\x00-\x7F]$/.test(out[out.length - 1]);
    if (ascii && prevAscii) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
};

// 出入りアニメーション辞書はキット本体（src/anim.ts）へ移動した。
// スタイルを跨いで使い回す／増やすのが1エントリで済むようにするため。
export { INS, OUTS, IN_KEYS, OUT_KEYS } from '../../src/anim';
export type { AnimState, AnimFn } from '../../src/anim';
