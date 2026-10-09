import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BurnInStage } from './BurnIn';
import { BurnInData } from './types';

// 縦型ショート: 本編の lyrics.json をそのまま使い、[startSec, endSec) を先頭0秒に
// シフトして描画する。音源・ギミックも同じだけずらす。
export const ShortVideo: React.FC<{ data: BurnInData; startSec: number; endSec: number }> = ({
  data,
  startSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;
  const startFrame = Math.round(startSec * fps);
  const now = frame / fps - offset + startSec;
  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} startFrom={startFrame} /> : null}
      <BurnInStage data={data} now={now} />
    </AbsoluteFill>
  );
};
