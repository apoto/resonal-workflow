import React from 'react';
import { AbsoluteFill } from 'remotion';
import project from '../input/project.json';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';

/**
 * 冒頭クレジット。文言は input/project.json の credits（workflow.config.json の credits と同じ形）から読む。
 * "Vocal: NAME" のように「: 」を含む項目は、前をラベル・後ろを名前として2段で出す。
 * 秒は input/lyrics.json の meta.credits（[{from,to}] を項目順に）で上書きできる。無ければ 0.8 秒から 3.4 秒刻み。
 * スクリムはクレジット全区間で出しっぱなしにする（名前の切替ごとに出し入れすると点滅して見える）。
 */

const { fontFamily: MINCHO } = loadFont('normal', { weights: ['700'] });

export interface CreditCard {
  /** 大きく出す名前 */
  text: string;
  /** 名前の上に小さく出すラベル（"Vocal: NAME" の Vocal） */
  subtitle?: string;
  /** 表示開始（曲の絶対秒） */
  from: number;
  /** 表示終了（曲の絶対秒） */
  to: number;
}

/** meta.credits の1件（project.json の credits と同じ順） */
export interface CreditTiming {
  from: number;
  to: number;
}

const toCard = (s: string): Pick<CreditCard, 'text' | 'subtitle'> => {
  const m = s.match(/^(.+?):\s*(.+)$/);
  return m ? { subtitle: m[1], text: m[2] } : { text: s };
};

export const buildCards = (timing?: CreditTiming[]): CreditCard[] =>
  ((project as { credits?: string[] }).credits ?? []).map((s, i) => ({
    ...toCard(s),
    from: timing?.[i]?.from ?? 0.8 + i * 3.4,
    to: timing?.[i]?.to ?? 0.8 + i * 3.4 + 3.2,
  }));

export interface CreditTheme {
  /** 書体（既定 NotoSerifJP 700。スタイル側の書体を渡してよい） */
  fontFamily: string;
  /** 名前の色 */
  color: string;
  /** ラベルの色 */
  subColor: string;
  /** 名前の text-shadow（グロー/縁取り。'none' で無し） */
  glow: string;
  /** ラベルの text-shadow */
  subGlow: string;
  /** フェード秒。0 でハードカット（white-cut 等） */
  fade: number;
  /** 画面下からの位置（%） */
  bottom: number;
  /** 名前のフォントサイズ（1080p基準・9:16は scale で縮む） */
  nameSize: number;
  /** ラベルのフォントサイズ */
  subSize: number;
  letterSpacing: string;
  subLetterSpacing: string;
  /** 下スクリムの色（"R,G,B"）。null で無し＝白背景スタイル（white-cut 等）向け */
  scrimRgb: string | null;
}

const DEFAULT_THEME: CreditTheme = {
  fontFamily: MINCHO,
  color: '#f6fbfc',
  subColor: '#7be6f2',
  glow: '0 0 18px rgba(87,228,242,0.75), 0 0 4px rgba(0,0,0,0.9)',
  subGlow: '0 0 8px rgba(0,0,0,0.85)',
  fade: 0.4,
  bottom: 7,
  nameSize: 40,
  subSize: 19,
  letterSpacing: '0.32em',
  subLetterSpacing: '0.42em',
  scrimRgb: '0,4,7',
};

export const Credits: React.FC<{
  /** 秒の上書き（input/lyrics.json の meta.credits） */
  cards?: CreditTiming[];
  /** 曲の絶対秒（ショートは startSec + frame/fps を渡す） */
  sec: number;
  /** 9:16 で詰めるときの倍率（既定1） */
  scale?: number;
  theme?: Partial<CreditTheme>;
}> = ({ cards: timing, sec, scale = 1, theme }) => {
  const cards = buildCards(timing);
  if (cards.length === 0) return null;
  const th = { ...DEFAULT_THEME, ...theme };

  const active = cards.find((c) => sec >= c.from && sec < c.to);
  const fade = Math.max(th.fade, 0.0001);

  // 区間全体（最初のfrom〜最後のto）でスクリムを維持＝名前ごとに点滅させない
  const span = {
    start: Math.min(...cards.map((c) => c.from)),
    end: Math.max(...cards.map((c) => c.to)),
  };
  const scrimAlpha = Math.max(
    0,
    Math.min((sec - span.start) / fade, (span.end - sec) / fade, 1)
  );

  const alpha = active
    ? Math.max(0, Math.min((sec - active.from) / fade, (active.to - sec) / fade, 1))
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {th.scrimRgb && scrimAlpha > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(0deg, rgba(${th.scrimRgb},${0.7 * scrimAlpha}) 0%, rgba(${
              th.scrimRgb
            },${0.32 * scrimAlpha}) 45%, transparent 78%)`,
          }}
        />
      )}
      {active && alpha > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${th.bottom}%`,
            transform: 'translateX(-50%)',
            textAlign: 'center',
            opacity: alpha,
          }}
        >
          {active.subtitle && (
            <div
              style={{
                fontFamily: th.fontFamily,
                fontWeight: 600,
                fontSize: th.subSize * scale,
                letterSpacing: th.subLetterSpacing,
                color: th.subColor,
                textShadow: th.subGlow,
                whiteSpace: 'nowrap',
                marginBottom: 8 * scale,
              }}
            >
              {active.subtitle}
            </div>
          )}
          <div
            style={{
              fontFamily: th.fontFamily,
              fontWeight: 700,
              fontSize: th.nameSize * scale,
              letterSpacing: th.letterSpacing,
              color: th.color,
              textShadow: th.glow,
              whiteSpace: 'nowrap',
            }}
          >
            {active.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

