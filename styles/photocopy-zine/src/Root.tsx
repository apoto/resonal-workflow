import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo } from './LyricVideo';
import { ShortVideo } from './ShortVideo';
import { Thumbnail } from './Thumbnail';
import { StageData } from './Stage';
import { SHORT_START, SHORT_END } from './scenes';
import data from '../input/lyrics.json';

const d = data as unknown as StageData;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LyricVideo"
      component={LyricVideo}
      durationInFrames={Math.ceil(d.meta.duration * d.meta.fps)}
      fps={d.meta.fps}
      width={1920}
      height={1080}
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
    <Composition
      id="Thumbnail"
      component={Thumbnail}
      durationInFrames={1}
      fps={d.meta.fps}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  </>
);
