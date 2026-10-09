import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo, ShortVideo } from './LyricVideo';
import { Thumbnail } from './Thumbnail';
import { LyricData } from './types';
import data from '../input/lyrics.json';

const d = data as LyricData;

// 縦ショート切り出し区間（秒）— サビ入り直前〜サビ歌い切り＋余韻（音楽的な切れ目優先）。
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
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        durationInFrames={1}
        fps={d.meta.fps}
        width={1920}
        height={1080}
      />
    </>
  );
};
