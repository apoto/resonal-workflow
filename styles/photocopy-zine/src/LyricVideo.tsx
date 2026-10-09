import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Stage, StageData } from './Stage';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadCourier } from '@remotion/google-fonts/CourierPrime';
import { loadFont as loadNotoJP } from '@remotion/google-fonts/NotoSansJP';

loadAnton();
loadCourier('normal', { weights: ['400', '700'] });
loadNotoJP('normal', { weights: ['900'], subsets: ['japanese', 'latin'] });

export const LyricVideo: React.FC<{ data: StageData }> = ({ data }) => (
  <AbsoluteFill>
    <Stage data={data} />
    <Audio src={staticFile(data.meta.audio ?? 'audio.wav')} />
  </AbsoluteFill>
);
