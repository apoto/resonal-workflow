import { continueRender, delayRender, staticFile } from 'remotion';
import React from 'react';
import { loadFont as loadSerif } from '@remotion/google-fonts/NotoSerifJP';

/**
 * portrait-frame スタイルの描画部品。
 *
 * plate-swap（面の切替＋極太ゴシックを横に刷り出す）との差分:
 *   ・面が**動画**になる（静止画プレートは微速ズーム/パンで併用）
 *   ・文字は**縦書き明朝**で、右から左へ**積み上がって**ブロック単位で一掃される
 *   ・額縁装飾＋白フラッシュ／段階白飛びで章を切る
 *
 * ★色はこのファイルに書かない。曲ごとに変わるので `spec.stage.palette` から取る
 *   （ここに焼き込むと再着色でスタイルパックを編集することになり、他の曲を巻き込む）。
 * ★装飾（stroke / textShadow / glow）を足さない。字が細く見えるときの解は
 *   「級数を上げる」「地を締める」「ウェイトを上げる」で、装飾ではない
 *   （RESONAL で3回やった失敗＝装飾を足した瞬間にカラオケ字幕になる）。
 */

const opt = { subsets: ['japanese', 'latin'] as ('japanese' | 'latin')[], ignoreTooManyRequestsWarning: true };

/**
 * 書体は明朝1本（NotoSerifJP）。役割はウェイトで分ける。
 *   read    = w500。縦書きの本文（長い行でも字間が詰まらない）
 *   display = w900。キメの短い語・タイトル
 *
 * 白地に黒明朝＝可読性が最優先。portrait-frame は「面が主役で文字は面の上に積む層」なので、
 * 文字自体が暴れると面の絵が死ぬ。
 */
const SERIF = loadSerif('normal', { ...opt, weights: ['500', '900'] });
const SERIF_READ = SERIF.fontFamily;
const SERIF_DISPLAY = SERIF.fontFamily;

// ★public/fonts/ にローカルの明朝があれば**それを最優先**で使う。
//   Google の日本語サブセットは数百ファイルに分割され、並列レンダーのタブごとに読み込みが間に合う/間に合わないが
//   バラけて**フレームごとに字の太さが変わる（文字が震える）**。1ファイルのローカル体ならこの競合が起きない。
//   ファイルが無いプロジェクトでは読み込みに失敗して何もしない＝従来どおり Google フォントで描く。
if (typeof document !== 'undefined') {
  const h = delayRender('portrait-frame: ローカル明朝の読み込み');
  Promise.all(
    [['NotoSerifJP-Medium.otf', '500'], ['NotoSerifJP-Black.otf', '900']].map(([file, weight]) =>
      new FontFace(SERIF.fontFamily, `url(${staticFile(`fonts/${file}`)})`, { weight })
        .load()
        .then((face) => { (document.fonts as unknown as { add: (f: FontFace) => void }).add(face); })
        .catch(() => {}),
    ),
  ).finally(() => continueRender(h));
}

export const displayChars = (text: string) =>
  Array.from(text.replace(/\s+/g, (m, off: number, str: string) =>
    /[A-Za-z0-9,.!?']/.test(str[off - 1] ?? '') && /[A-Za-z0-9]/.test(str[off + m.length] ?? '') ? ' ' : ''));

/** 縦組みの行の長さ（和字=1）。英数字は横倒しで約半マス＝同じ1で数えると英語の行だけ縮みすぎる */
export const lineUnits = (text: string) =>
  displayChars(text).reduce((n, c) => n + (/[\x20-\x7E]/.test(c) ? 0.55 : 1), 0);

export type Role = 'display' | 'read';

export const fontFor = (role: Role) => ({
  fontFamily: role === 'display' ? SERIF_DISPLAY : SERIF_READ,
  fontWeight: role === 'display' ? 900 : 500,
});

/** palette からの取得（未指定時の既定つき）。**既定は白基調の想定だが曲ごとに差し替わる**。 */
const FALLBACK: Record<string, string> = {
  ground: '#f2f5f8',   // 地（白）
  pale: '#cfe3f2',     // 淡青
  shade: '#9aa8b4',    // 影のグレー
  accent: '#1d3f63',   // 差し色（1曲でここだけ）
  ink: '#1a2530',      // 文字
};

export const pal = (palette: Record<string, string>, key: string) =>
  palette[key] ?? FALLBACK[key] ?? '#000';

/** 決定的な擬似乱数（フレーム間で同じ配置を再現する＝チラつき防止） */
export const seeded = (n: number) => {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * 縦書きの1行を描く共通部品。
 * `writing-mode: vertical-rl` は Chromium で安定して効き、句読点も縦組みになる。
 * 空白は縦書きでは詰める（縦に空白が入ると行が途切れて見える）。
 */
export const VerticalLine: React.FC<{
  text: string;
  size: number;
  color: string;
  role?: Role;
  opacity?: number;
  /** 0〜1。1で全文字表示。文字単位のワイプに使う */
  reveal?: number;
  letterSpacing?: number;
}> = ({ text, size, color, role = 'read', opacity = 1, reveal = 1, letterSpacing = 0.12 }) => {
  const chars = displayChars(text);
  const shown = Math.ceil(chars.length * Math.max(0, Math.min(1, reveal)));
  const hasAscii = /[A-Za-z0-9]/.test(text);
  return (
    <div
      style={{
        writingMode: 'vertical-rl',
        textOrientation: hasAscii ? 'mixed' : 'upright',
        fontSize: size,
        lineHeight: 1.0,
        letterSpacing: size * letterSpacing,
        color,
        opacity,
        whiteSpace: 'nowrap',
        ...fontFor(role),
      }}
    >
      {chars.map((c, i) => (
        <span key={i} style={{ opacity: i < shown ? 1 : 0 }}>
          {c}
        </span>
      ))}
    </div>
  );
};

/**
 * 面（背景）にだけ掛けるトーンフィルタ。**立ち絵と歌詞には掛からない**（field の内側で使う）。
 *
 * ★パレット（白＋淡青＋深青1点）を壊さない範囲だけ用意する。
 *   暖色に振る・極彩色にする類は入れない＝曲の色設計が崩れる。
 */
export type Tone = 'none' | 'mono' | 'blue' | 'deep' | 'ice';

export const toneFilter = (t: Tone | undefined): string | undefined => {
  switch (t) {
    case 'mono': return 'saturate(0) contrast(1.08)';                       // 白い雪をモノクロに
    case 'blue': return 'saturate(1.45) hue-rotate(-8deg) brightness(0.97)';// 青みを足す
    case 'deep': return 'saturate(1.75) contrast(1.14) brightness(0.9)';    // 青い海をより濃く
    case 'ice':  return 'saturate(0.55) brightness(1.07) contrast(1.04)';   // 淡く白へ寄せる
    default: return undefined;
  }
};
