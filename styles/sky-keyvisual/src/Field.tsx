import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { FieldKind } from './types';

/** ===== ①面（背景）=====
 *  背景は2Dイラスト（public/bg_*.png）。図形描画より描き込まれたイラストの方がリッチに見える。
 *  同じ場所を複数アングル持って画変わりを作る（single-set-multicam）。
 *  既定の FieldKind は「終演後・全灯した会場」を想定した名前。曲に合わせて SRC と FieldKind を差し替える。
 */

export const PAL = { ink: '#151821', exit: '#19c37d', sunsetMid: '#ff7a2f' };

const SRC: Record<FieldKind, string | null> = {
  venue: 'bg_front.png',
  'venue-wide': 'bg_wide.png',
  'venue-close': 'bg_close.png',
  sunset: 'bg_window.png',
  dim: 'bg_front.png',
  white: null,
};

export const Field: React.FC<{
  kind: FieldKind;
  t: number;
  /** セクション内進行 0..1（微速のパン/ズーム） */
  p: number;
  lit: number;
  warm: number;
  /** 静止画セクションでは大きめに動かして「動いている」を作る */
  drift?: number;
  /** 寄りカット（bust/feet）のときは背景も寄せて被写界深度を浅く見せる */
  tight?: boolean;
}> = ({ kind, t, p, lit, warm, drift = 1, tight }) => {
  const src = SRC[kind];
  if (!src) return <AbsoluteFill style={{ background: '#ffffff' }} />;

  // 静側は背景のゆっくりしたパン/ズームで持たせる
  const zoom = (tight ? 1.45 : 1.1) + p * 0.05 * drift;
  const panX = Math.sin(t * 0.13) * 22 * drift + (p - 0.5) * 26 * drift;
  const panY = Math.cos(t * 0.1) * 12 * drift;

  const dim = kind === 'dim';
  const sunset = kind === 'sunset';

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: dim ? '#14161c' : '#ffffff' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          filter: dim
            ? `brightness(${0.22 + lit * 0.5}) saturate(0.55) contrast(1.05)`
            : sunset
            ? 'saturate(1.35) contrast(1.06) brightness(1.02)'
            : `brightness(${1.0 + warm * 0.03})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            // 寄りカットでは背景を軽くぼかして被写体を立てる（奥行き）
            filter: tight ? 'blur(3px)' : undefined,
          }}
        />
      </AbsoluteFill>

      {sunset && (
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(178deg, rgba(255,179,71,0.55) 0%, rgba(255,122,47,0.62) 52%, rgba(255,93,59,0.7) 100%)',
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {!dim && !sunset && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(100deg, rgba(255,140,60,${warm * 0.2}) 0%, rgba(255,160,80,${
              warm * 0.07
            }) 45%, transparent 72%)`,
            mixBlendMode: 'multiply',
          }}
        />
      )}

      <AbsoluteFill
        style={{
          background: dim
            ? 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%)'
            : 'radial-gradient(ellipse at 50% 52%, rgba(255,255,255,0) 58%, rgba(255,255,255,0.42) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
