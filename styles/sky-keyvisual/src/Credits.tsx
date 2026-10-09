import React from 'react';
import { AbsoluteFill } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';

/**
 * クレジット（下部に1枚ずつ）。文言は input/project.json の credits から SkyKeyvisualStage.tsx が組む。
 * タイミングと意匠だけをスタイル/曲ごとに theme で振る。
 * スクリムはクレジット全区間で出しっぱなしにする（名前ごとに出し入れすると点滅してうるさい）。
 */

const { fontFamily: MINCHO } = loadFont('normal', { weights: ['700'] });

export interface CreditCard {
  /** 大きく出す名前 */
  text: string;
  /** 名前の上に小さく出すラベル（任意） */
  subtitle?: string;
  /** 表示開始（曲の絶対秒） */
  from: number;
  /** 表示終了（曲の絶対秒） */
  to: number;
}

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
  color: '#ffffff',
  subColor: '#ffd0d0',
  glow: '0 0 22px rgba(255,60,60,0.65), 0 0 4px rgba(0,0,0,0.9)',
  subGlow: '0 0 8px rgba(0,0,0,0.9)',
  fade: 0.3,
  bottom: 7,
  nameSize: 44,
  subSize: 20,
  letterSpacing: '0.3em',
  subLetterSpacing: '0.42em',
  scrimRgb: '0,0,0',
};

export const Credits: React.FC<{
  cards?: CreditCard[];
  /** 曲の絶対秒（ショートは startSec + frame/fps を渡す） */
  sec: number;
  /** 9:16 で詰めるときの倍率（既定1） */
  scale?: number;
  theme?: Partial<CreditTheme>;
}> = ({ cards, sec, scale = 1, theme }) => {
  if (!cards || cards.length === 0) return null;
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
