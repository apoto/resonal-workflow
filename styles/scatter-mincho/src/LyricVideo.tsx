import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BeatBackground } from './BeatBackground';
import { Credits } from './Credits';
import { LyricWord } from './LyricWord';
import { LyricData, RuntimeLyric } from './types';

// 出現を拍に合わせるための先行フレーム（spring立ち上がり分を前倒し）。
const LEAD = 3;
const DEFAULT_HOLD = 1.4; // 秒

export const LyricVideo: React.FC<{ data: LyricData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = data.meta.timingOffsetSec ?? 0;

  // 秒 → フレームへ変換（手調整は input/lyrics.json の t / hold をいじる）
  const lyrics: RuntimeLyric[] = data.lyrics.map((l) => {
    const startFrame = Math.round((l.t + offset) * fps) - LEAD;
    const endFrame = startFrame + Math.round((l.hold ?? DEFAULT_HOLD) * fps);
    return { ...l, startFrame, endFrame };
  });

  return (
    <AbsoluteFill>
      {data.meta.audio ? <Audio src={staticFile(data.meta.audio)} /> : null}
      <BeatBackground
        beats={data.beats}
        background={data.meta.background}
        backgroundVideo={data.meta.backgroundVideo}
        backgroundVideoDuration={data.meta.backgroundVideoDuration}
        scenes={data.meta.scenes}
      />
      {(() => {
        // ステッガーはオプトイン：stagger:true の行が同時刻に複数あるときだけ縦バンドに振り分ける。
        // それ以外はデフォルト位置で静止（＝常時動かないのでサビ等を読みやすい）。
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
              beats={data.beats}
              stackIndex={order.get(lyric) ?? 0}
              stackCount={order.has(lyric) ? stackCount : 1}
            />
          ) : null
        );
      })()}
      {/* 冒頭クレジット（文言は input/project.json） */}
      <Credits cards={data.meta.credits} sec={frame / fps} />
    </AbsoluteFill>
  );
};
