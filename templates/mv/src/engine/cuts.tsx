import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Cut } from './types';

// 全画面の白飛び/黒転（engine・普遍・色に依存しない）。hard=停電（ランプ無しでパッと）。
export const WhiteOut: React.FC<Cut & { offset?: number }> = ({ at, rise = 0.5, hold = 0.25, fall = 0.5, offset = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps + offset;
  const s0 = at - rise, s3 = at + hold + fall;
  if (sec < s0 || sec > s3) return null;
  const op = interpolate(sec, [s0, at, at + hold, s3], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#F2FBFF', opacity: op, pointerEvents: 'none' }} />;
};

export const BlackOut: React.FC<Cut & { offset?: number }> = ({ at, rise = 0.4, hold = 0.3, fall = 0.5, hard = false, offset = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps + offset;
  if (hard) {
    if (!(sec >= at && sec < at + hold)) return null;
    return <AbsoluteFill style={{ background: '#000', pointerEvents: 'none' }} />;
  }
  const s0 = at - rise, s3 = at + hold + fall;
  if (sec < s0 || sec > s3) return null;
  const op = interpolate(sec, [s0, at, at + hold, s3], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: '#000', opacity: op, pointerEvents: 'none' }} />;
};
