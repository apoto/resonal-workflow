import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Credits } from './Credits';
import { CrimsonGothicStage } from './CrimsonGothicStage';
import { CrimsonGothicData, RuntimeCrimsonGothic } from './types';

const DEFAULT_HOLD = 1.0; // 秒

// 本編 16:9。歌詞は pattern 別にハードカット（重なり無し）。
export const LyricVideo: React.FC<{ data: CrimsonGothicData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;

  const lyrics: RuntimeCrimsonGothic[] = data.lyrics.map((l) => {
    const startFrame = Math.round((l.t + offset) * fps);
    const endFrame = startFrame + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame, endFrame };
  });

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} /> : null}
      <CrimsonGothicStage
        lyrics={lyrics}
        background={data.meta.background}
        backgroundImage={data.meta.backgroundImage}
        ink={data.meta.ink}
      />
      {/* 冒頭クレジット（文言は input/project.json） */}
      <Credits cards={data.meta.credits} sec={frame / fps} />
    </AbsoluteFill>
  );
};
