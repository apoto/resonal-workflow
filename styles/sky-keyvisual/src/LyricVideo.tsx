import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { SkyKeyvisualStage } from './SkyKeyvisualStage';
import type { LyricData } from './types';

export const LyricVideo: React.FC<{ data: LyricData }> = ({ data }) => (
  <AbsoluteFill>
    {data.meta.audio && <Audio src={staticFile(data.meta.audio)} />}
    <SkyKeyvisualStage data={data} />
  </AbsoluteFill>
);
