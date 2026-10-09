import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CrimsonGothicWord } from './CrimsonGothicWord';
import { RuntimeCrimsonGothic } from './types';

/**
 * crimson-gothic の絵作り（本編・ショート共通）。
 * 背景＝曲ごとの画像（meta.backgroundImage）を cover で敷く。無ければ暗色（meta.background, 既定 #0b0809）。
 * キメ行（glitch）の出現時、画面全体に横波の液状グリッチ（SVG乱流）を一瞬かける。
 */
export const CrimsonGothicStage: React.FC<{
  lyrics: RuntimeCrimsonGothic[];
  background?: string;
  backgroundImage?: string;
  ink?: string;
}> = ({ lyrics, background, backgroundImage, ink }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = background ?? '#0b0809';
  const inkColor = ink ?? '#f2efe9';

  // 画面全体グリッチ強度（キメ行の出現直後に立ち ~0.27秒で収束）
  const glitchFrames = Math.max(5, Math.round(0.27 * fps));
  const gNow = lyrics.reduce((m, l) => {
    if (!l.glitch) return m;
    const local = frame - l.startFrame;
    if (local < 0 || local > glitchFrames) return m;
    return Math.max(m, 1 - local / glitchFrames);
  }, 0);
  const waveScale = gNow * 80;

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* 横波グリッチ用フィルタ */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="eyeGlitch">
            <feTurbulence type="fractalNoise" baseFrequency="0.001 0.06" numOctaves={2} seed={Math.floor(frame)} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={waveScale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <AbsoluteFill style={{ filter: gNow > 0 ? 'url(#eyeGlitch)' : 'none' }}>
        {/* 背景画像（キャラ/カバー絵） */}
        {backgroundImage ? (
          <Img src={staticFile(backgroundImage)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}

        {/* 歌詞（pattern別・ハードカット [start,end)） */}
        {lyrics.map((lyric, i) =>
          frame >= lyric.startFrame && frame < lyric.endFrame ? (
            <CrimsonGothicWord key={i} lyric={lyric} frame={frame} ink={inkColor} />
          ) : null
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
