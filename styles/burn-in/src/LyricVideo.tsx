import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BurnInStage } from './BurnIn';
import { BurnInData } from './types';

export const LyricVideo: React.FC<{ data: BurnInData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps - (data.meta.timingOffsetSec ?? 0);
  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} /> : null}
      <BurnInStage data={data} now={now} />
    </AbsoluteFill>
  );
};
