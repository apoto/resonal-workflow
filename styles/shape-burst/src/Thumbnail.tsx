import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { DELA } from './fonts';
import { PAL } from './ShapeBurst';
import { InvertShapesData } from './types';
import project from '../input/project.json';

/**
 * サムネ（高明度パステル版）。
 *  - 被写体（顔）を隠さない＝タイトルは下部。クレジットは入れない。
 *  - 意匠は shape-burst ＝ 極太ゴシック × 幾何図形。
 *  - 高明度背景では白文字の difference 反転が成立しないので「濃いインク＋白縁」で置く。
 */
export const Thumbnail: React.FC<{ data: InvertShapesData }> = ({ data }) => {
  const m = data.meta;
  const title = (m.thumbTitle ?? project.title).replace(/\n/g, ' ');
  const size = title.length > 14 ? 150 : title.length > 10 ? 178 : 220;

  // 文字の白縁（本編 PhraseView と同じ極性＝濃いインクを白で浮かせる）
  const o = Math.max(2, size * 0.014);
  const outline = [`${o}px 0`, `-${o}px 0`, `0 ${o}px`, `0 -${o}px`, `${o}px ${o}px`, `-${o}px -${o}px`, `${o}px -${o}px`, `-${o}px ${o}px`]
    .map((d) => `${d} 0 ${PAL.STROKE}`)
    .join(', ');

  return (
    <AbsoluteFill style={{ backgroundColor: PAL.BG }}>
      {m.bg ? (
        <Img
          src={staticFile(m.bg)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.08) contrast(1.03) brightness(1.02)' }}
        />
      ) : null}

      {/* 下部だけ白く持ち上げてタイトルの可読性を作る（黒スクリムにしない＝高明度を保つ） */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 46%, ${PAL.BG}B8 70%, ${PAL.BG}F2 100%)`,
        }}
      />

      {/* shape-burst の幾何図形アクセント（マゼンタ／ピンクの線画。1点だけ高彩度） */}
      <svg width={300} height={300} viewBox="0 0 100 100" style={{ position: 'absolute', left: 150, bottom: 120, transform: 'rotate(-6deg)' }}>
        <circle cx={50} cy={50} r={44} fill="none" stroke={PAL.MAGENTA} strokeWidth={5} />
      </svg>
      <svg width={190} height={190} viewBox="0 0 100 100" style={{ position: 'absolute', right: 170, bottom: 190, transform: 'rotate(8deg)' }}>
        <polygon points="50,6 94,94 6,94" fill="none" stroke={PAL.PINK} strokeWidth={6} />
      </svg>
      <svg width={130} height={130} viewBox="0 0 100 100" style={{ position: 'absolute', right: 330, bottom: 96 }}>
        <path d="M50,8 L50,92 M8,50 L92,50" fill="none" stroke={PAL.MINT} strokeWidth={9} />
      </svg>

      {/* タイトル（下部） */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 86 }}>
        <div
          style={{
            fontFamily: DELA,
            fontSize: size,
            lineHeight: 1.0,
            color: PAL.INK,
            textAlign: 'center',
            transform: 'scaleX(0.92) rotate(-1.6deg)',
            letterSpacing: '-0.015em',
            whiteSpace: 'nowrap',
            textShadow: `${outline}, 0 6px 22px rgba(120,30,90,0.30)`,
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
