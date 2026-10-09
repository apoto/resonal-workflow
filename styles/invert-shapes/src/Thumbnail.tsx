import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { DELA } from './fonts';
import { InvertShapesData } from './types';

const WHITE = '#ffffff';

// invert-shapes サムネ。ルール:
//  ① 被写体（キャラの顔など）を隠さない＝タイトルは下部に置く。
//  ② タイトルは英語のみ（日本語訳・日本語コピーはサムネに入れない）。
//  ③ invert-shapes の様式＝白図形＋ネガポジ反転をタイトルに効かせる。
export const Thumbnail: React.FC<{ data: InvertShapesData }> = ({ data }) => {
  const m = data.meta;
  const title = (m.thumbTitle ?? 'TITLE').replace(/\n/g, ' '); // 1行・英語のみ
  const base = m.bgColor ?? '#1b0a2e';
  // タイトル長に応じて自動縮小（下部1行で収める）
  const size = title.length > 12 ? 150 : title.length > 9 ? 185 : 230;

  return (
    <AbsoluteFill style={{ backgroundColor: base }}>
      {/* 背景（キービジュ等。顔を明るく見せる） */}
      {m.bg ? (
        <Img src={staticFile(m.bg)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.06) contrast(1.05) brightness(0.98)' }} />
      ) : null}

      {/* 下部をタイトル可読性のため暗く、上は軽く締める */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${base}55 0%, transparent 22%, transparent 55%, ${base}CC 82%, ${base}F2 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(130% 90% at 50% 32%, transparent 46%, ${base}66 100%)` }} />

      {/* タイトル（下部・invert-shapes：白図形＋ネガポジ反転） */}
      <AbsoluteFill style={{ isolation: 'isolate' }}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 110 }}>
          <svg width={300} height={300} viewBox="0 0 100 100" style={{ position: 'absolute', bottom: 40, transform: 'translateX(-320px) rotate(-3deg)' }}>
            <circle cx={50} cy={50} r={50} fill={WHITE} />
          </svg>
          <svg width={150} height={150} viewBox="0 0 100 100" style={{ position: 'absolute', bottom: 70, transform: 'translateX(360px) rotate(6deg)' }}>
            <polygon points="50,0 100,100 0,100" fill={WHITE} />
          </svg>
        </AbsoluteFill>
        <AbsoluteFill style={{ mixBlendMode: 'difference', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 }}>
          <div style={{ fontFamily: DELA, fontSize: size, lineHeight: 1.0, color: WHITE, textAlign: 'center', transform: 'rotate(-2deg)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
