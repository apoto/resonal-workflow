import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo } from './LyricVideo';
import { ShortVideo } from './ShortVideo';
import { LyricData } from './types';
import data from '../input/lyrics.json';

const d = data as LyricData;

// ショート切り出し区間（秒）。曲ごとに設定：Pre→Chorus1〜サビ最後＋drop後の余韻 が定番。
// 耳でサビ頭を見つけ、ここに START/END を入れる（同じ lyrics.json を区間シフトして再利用）。
const SHORT_START = 10; // ← 曲ごとに変更
const SHORT_END = 40;   // ← 曲ごとに変更

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
