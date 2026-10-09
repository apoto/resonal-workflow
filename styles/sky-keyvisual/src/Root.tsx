import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo } from './LyricVideo';
import { ShortVideo } from './ShortVideo';
import data from '../input/lyrics.json';
import type { LyricData } from './types';
import './style.css';

const D = data as unknown as LyricData;
const FPS = D.meta.fps;

// ショート区間（曲の絶対秒）。サビ頭から始めるのが既定
const SHORT_FROM = 14.0;
const SHORT_TO = 40.0;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LyricVideo"
      component={LyricVideo as any}
      durationInFrames={Math.round(D.meta.duration * FPS)}
      fps={FPS}
      width={D.meta.width ?? 1920}
      height={D.meta.height ?? 1080}
      defaultProps={{ data: D } as any}
    />
    <Composition
      id="ShortVideo"
      component={ShortVideo as any}
      durationInFrames={Math.round((SHORT_TO - SHORT_FROM) * FPS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ data: D, from: SHORT_FROM, to: SHORT_TO } as any}
    />
  </>
);
