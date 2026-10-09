import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo } from './LyricVideo';
import { ShortVideo } from './ShortVideo';
import { BurnInData } from './types';
import { withCredits } from './credits';
import data from '../input/lyrics.json';

const d = withCredits(data as unknown as BurnInData);

// ショート切り出し区間（秒）。囁きギミック（ネガ反転）→Drop を歌い切るまでを推奨。
const SHORT_START = 16.0;
const SHORT_END = 40.0;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LyricVideo"
        component={LyricVideo}
        durationInFrames={Math.ceil(d.meta.duration * d.meta.fps)}
        fps={d.meta.fps}
        width={d.meta.width ?? 1920}
        height={d.meta.height ?? 1080}
        defaultProps={{ data: d }}
      />
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        durationInFrames={Math.ceil((SHORT_END - SHORT_START) * d.meta.fps)}
        fps={d.meta.fps}
        width={1080}
        height={1920}
        defaultProps={{ data: d, startSec: SHORT_START, endSec: SHORT_END }}
      />
    </>
  );
};
