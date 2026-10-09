import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Stage, StageData } from './Stage';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadCourier } from '@remotion/google-fonts/CourierPrime';
import { loadFont as loadNotoJP } from '@remotion/google-fonts/NotoSansJP';

loadAnton();
loadCourier('normal', { weights: ['400', '700'] });
loadNotoJP('normal', { weights: ['900'], subsets: ['japanese', 'latin'] });

/** 本編と同じ lyrics.json を区間シフトして 9:16 で再利用する */
export const ShortVideo: React.FC<{ data: StageData; startSec: number; endSec: number }> = ({
  data,
  startSec,
}) => {
  const fps = data.meta.fps;
  const shifted: StageData = {
    ...data,
    meta: { ...data.meta, timingOffsetSec: (data.meta.timingOffsetSec ?? 0) + startSec },
  };
  return (
    <AbsoluteFill>
      <Stage data={shifted} scale={0.78} vertical />
      <Sequence from={0}>
        <Audio src={staticFile(data.meta.audio ?? 'audio.wav')} startFrom={Math.round(startSec * fps)} />
      </Sequence>
    </AbsoluteFill>
  );
};
