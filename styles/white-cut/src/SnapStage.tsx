import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { SnapWord } from './SnapWord';
import { RuntimeSnap } from './types';

/**
 * white-cut の絵作り（本編・ショート共通）。
 * 白背景＋（任意の）中央キャラ画像＋中央のハードカット歌詞。
 * キメ行の出現時、画面全体に横波の液状グリッチ（SVG乱流フィルタ）を一瞬かける。
 */
export const SnapStage: React.FC<{
  lyrics: RuntimeSnap[];
  fps: number;
  background?: string;
  ink?: string;
  character?: string;
}> = ({ lyrics, fps, background, ink, character }) => {
  const frame = useCurrentFrame();
  const bg = background ?? '#fafafa';
  const inkColor = ink ?? '#121212';

  // 画面全体グリッチ強度（キメ行の出現直後に立ち、~0.2秒で収束）
  const glitchFrames = Math.max(4, Math.round(0.22 * fps));
  const gNow = lyrics.reduce((m, l) => {
    if (!l.glitch) return m;
    const local = frame - l.startFrame;
    if (local < 0 || local > glitchFrames) return m;
    return Math.max(m, 1 - local / glitchFrames);
  }, 0);
  const waveScale = gNow * 90;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* 横波グリッチ用 SVGフィルタ */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="liquidGlitch">
            <feTurbulence type="fractalNoise" baseFrequency="0.001 0.06" numOctaves={2} seed={Math.floor(frame)} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={waveScale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* グリッチ時だけ全体に液状フィルタを適用（キャラ＋歌詞ごと歪む） */}
      <AbsoluteFill style={{ filter: gNow > 0 ? 'url(#liquidGlitch)' : 'none' }}>
        {/* 任意：中央キャラ画像（手の中心に歌詞が重なる構図） */}
        {character ? (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Img src={staticFile(character)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </AbsoluteFill>
        ) : null}

        {/* 中央のハードカット歌詞（[start,end) で重なり無し） */}
        {lyrics.map((lyric, i) =>
          frame >= lyric.startFrame && frame < lyric.endFrame ? (
            <SnapWord key={i} lyric={lyric} frame={frame} fps={fps} ink={inkColor} />
          ) : null
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
