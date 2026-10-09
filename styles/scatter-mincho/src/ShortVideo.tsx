import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BeatBackground } from './BeatBackground';
import { Credits } from './Credits';
import { LyricWord } from './LyricWord';
import { LyricData, RuntimeLyric } from './types';

// 本編と同じ秒→フレーム変換（手調整は input/lyrics.json を共有）
const LEAD = 3;
const DEFAULT_HOLD = 1.4;

// 縦型ショート：本編の lyrics.json をそのまま使い、[startSec, endSec) の区間だけを
// 先頭0秒にシフトして描画する。音源・拍・シーンも同じだけずらす。
export const ShortVideo: React.FC<{ data: LyricData; startSec: number; endSec: number }> = ({
  data,
  startSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;
  const startFrame = Math.round(startSec * fps);

  const lyrics: RuntimeLyric[] = data.lyrics.map((l) => {
    const sf = Math.round((l.t + offset - startSec) * fps) - LEAD;
    const ef = sf + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame: sf, endFrame: ef };
  });

  const beats = data.beats.map((b) => b - startFrame);
  const scenes = (data.meta.scenes ?? []).map((s) => ({
    ...s,
    start: s.start - startSec,
    end: s.end - startSec,
    hits: s.hits ? s.hits.map((h) => h - startSec) : undefined,
  }));

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} startFrom={startFrame} /> : null}
      <BeatBackground
        beats={beats}
        background={data.meta.background}
        backgroundVideo={data.meta.backgroundVideo}
        backgroundVideoDuration={data.meta.backgroundVideoDuration}
        scenes={scenes}
      />
      {(() => {
        const activeStack = lyrics.filter(
          (l) =>
            l.stagger === true &&
            l.pin !== 'center' &&
            frame >= l.startFrame &&
            frame < l.endFrame
        );
        const stackCount = activeStack.length;
        const order = new Map(activeStack.map((l, k) => [l, k] as const));
        return lyrics.map((lyric, i) =>
          frame >= lyric.startFrame && frame < lyric.endFrame ? (
            <LyricWord
              key={i}
              lyric={lyric}
              index={i}
              frame={frame}
              beats={beats}
              stackIndex={order.get(lyric) ?? 0}
              stackCount={order.has(lyric) ? stackCount : 1}
            />
          ) : null
        );
      })()}
      {/* クレジットは絶対秒。切り出し区間が冒頭を含むときだけ自然に出る（ショートは必須ではない） */}
      <Credits cards={data.meta.credits} sec={startSec + frame / fps} scale={0.85} />
    </AbsoluteFill>
  );
};
