import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo, ShortVideo } from './LyricVideo';
import { Thumbnail } from './Thumbnail';
import { InvertShapesData } from './types';
import data from '../input/lyrics.json';

const d = data as InvertShapesData;

// 縦ショート切り出し区間（秒）＝ meta.shortRange から取る。
// ★歌ありは「サビに入る直前 → サビを歌い切るまで → 間奏の頭」まで（サビの途中で切らない）。
// 例: Pre末尾 → Chorus を歌い切り → 間奏の頭（サビの途中で切らない）
const SHORT_START = d.meta.shortRange?.a ?? 0;
const SHORT_END = d.meta.shortRange?.b ?? 26;

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
        defaultProps={{ data: d }}
      />
    </>
  );
};
