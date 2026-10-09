import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo } from './LyricVideo';
import { ShortVideo } from './ShortVideo';
import { CrimsonGothicData } from './types';
import data from '../input/lyrics.json';

const d = data as CrimsonGothicData;

// ショート切り出し区間（秒）：サビ/キメまわりの一番激しい ~25–35s。
const SHORT_START = 10; // ← 曲ごとに変更
const SHORT_END = 40; // ← 曲ごとに変更

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
