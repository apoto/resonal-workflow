import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Credits } from './Credits';
import { SnapStage } from './SnapStage';
import { SnapData, RuntimeSnap } from './types';

const DEFAULT_HOLD = 1.2;

// 縦型ショート 9:16：本編と同じ lyrics.json を使い、[startSec, endSec) の区間だけを
// 先頭0秒にシフトして描画する。音源も同じだけずらす。
export const ShortVideo: React.FC<{ data: SnapData; startSec: number; endSec: number }> = ({
  data,
  startSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;
  const startFrame = Math.round(startSec * fps);

  const lyrics: RuntimeSnap[] = data.lyrics.map((l) => {
    const sf = Math.round((l.t + offset - startSec) * fps);
    const ef = sf + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame: sf, endFrame: ef };
  });

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} startFrom={startFrame} /> : null}
      <SnapStage
        lyrics={lyrics}
        fps={fps}
        background={data.meta.background}
        ink={data.meta.ink}
        character={data.meta.character}
      />
      {/* クレジットは絶対秒。切り出し区間が冒頭を含むときだけ自然に出る（ショートは必須ではない） */}
      <Credits cards={data.meta.credits} sec={startSec + frame / fps} scale={0.85} />
    </AbsoluteFill>
  );
};
