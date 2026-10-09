import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Credits } from './Credits';
import { CrimsonGothicStage } from './CrimsonGothicStage';
import { CrimsonGothicData, RuntimeCrimsonGothic } from './types';

const DEFAULT_HOLD = 1.0;

// 縦型ショート 9:16：本編と同じ lyrics.json を [startSec, endSec) で区間シフト。
export const ShortVideo: React.FC<{ data: CrimsonGothicData; startSec: number; endSec: number }> = ({
  data,
  startSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;
  const startFrame = Math.round(startSec * fps);

  const lyrics: RuntimeCrimsonGothic[] = data.lyrics.map((l) => {
    const sf = Math.round((l.t + offset - startSec) * fps);
    const ef = sf + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame: sf, endFrame: ef };
  });

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} startFrom={startFrame} /> : null}
      <CrimsonGothicStage
        lyrics={lyrics}
        background={data.meta.background}
        backgroundImage={data.meta.backgroundImage}
        ink={data.meta.ink}
      />
      {/* クレジットは絶対秒。切り出し区間が冒頭を含むときだけ自然に出る（ショートは必須ではない） */}
      <Credits cards={data.meta.credits} sec={startSec + frame / fps} scale={0.85} />
    </AbsoluteFill>
  );
};
