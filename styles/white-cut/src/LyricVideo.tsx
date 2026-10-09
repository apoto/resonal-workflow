import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Credits } from './Credits';
import { SnapStage } from './SnapStage';
import { SnapData, RuntimeSnap } from './types';

const DEFAULT_HOLD = 1.2; // 秒

// 本編 16:9。歌詞は中央でハードカット（重なり無し）。
export const LyricVideo: React.FC<{ data: SnapData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;

  // 秒 → フレーム（white-cutはLEAD無し＝ハードカット）。
  const lyrics: RuntimeSnap[] = data.lyrics.map((l) => {
    const startFrame = Math.round((l.t + offset) * fps);
    const endFrame = startFrame + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame, endFrame };
  });

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} /> : null}
      <SnapStage
        lyrics={lyrics}
        fps={fps}
        background={data.meta.background}
        ink={data.meta.ink}
        character={data.meta.character}
      />
      {/* 冒頭クレジット（文言は input/project.json） */}
      <Credits cards={data.meta.credits} sec={frame / fps} />
    </AbsoluteFill>
  );
};
