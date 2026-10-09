import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { LyricData } from './types';
import { Background, StillBackground, VideoBackground, grooveAt, sceneAt } from './Background';
import { KawaiiBurst, PhraseLayer } from './PinkBounce';
import { sectionAt } from './Camera';
import { BackFx, FrontFx, fxMixAt } from './SectionFx';
import { IntroCredits, cardsFromProject } from './Credits';

// レイヤー順（後ろ→前）:
//   背景（キャラ＋カメラ）→ BackFx（サンバースト/ストライプ/ふわふわデコ/集中線）
//   → 歌詞 → FrontFx（キラキラ/ガバ/波紋/紙吹雪）→ 冒頭クレジット帯

// 本編 16:9
export const LyricVideo: React.FC<{ data: LyricData }> = ({ data }) => {
  const off = data.meta.timingOffsetSec ?? 0;
  const bpm = data.meta.bpm ?? 120;
  const frame = useCurrentFrame();
  const sec = frame / data.meta.fps;
  const section = sectionAt(sec, data.meta.sections);
  const scene = sceneAt(sec, data.meta.scenes);
  const mix = fxMixAt(sec, section, bpm);
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff4fa' }}>
      <Background
        src={data.meta.background}
        poses={data.meta.backgroundPoses}
        groove={grooveAt(sec, data.meta.danceRegions)}
        biteRegions={data.meta.biteRegions}
        bpm={bpm}
        songSec={sec}
        section={section}
        scene={scene}
      />
      <BackFx sec={sec} bpm={bpm} mix={mix} />
      {data.lines.map((line, i) => (
        <PhraseLayer key={i} line={{ ...line, t: line.t + off }} idx={i} scale={1} songSec={sec} bpm={bpm} />
      ))}
      <FrontFx sec={sec} frame={frame} bpm={bpm} mix={mix} />
      <IntroCredits cards={cardsFromProject(data.meta.intro)} sec={sec} />
      <Audio src={staticFile(data.meta.audio)} />
    </AbsoluteFill>
  );
};

// 縦ショート 9:16（区間切り出し・縦用背景）
export const ShortVideo: React.FC<{ data: LyricData; startSec: number; endSec: number }> = ({
  data,
  startSec,
  endSec,
}) => {
  const off = data.meta.timingOffsetSec ?? 0;
  const fps = data.meta.fps;
  const bpm = data.meta.bpm ?? 120;
  const frame = useCurrentFrame();
  const songSec = frame / fps + startSec; // 曲の絶対秒
  const scale = 0.8; // 縦は文字を大きく（1080幅に対して16:9比+α で読ませる）
  const section = sectionAt(songSec, data.meta.sections);
  const scene = sceneAt(songSec, data.meta.scenes);
  const mix = fxMixAt(songSec, section, bpm);
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff4fa' }}>
      <Background
        src={data.meta.backgroundVertical}
        poses={data.meta.backgroundVerticalPoses}
        groove={grooveAt(songSec, data.meta.danceRegions)}
        biteRegions={data.meta.biteRegions}
        bpm={bpm}
        songSec={songSec}
        section={section}
        scene={scene}
        vertical
      />
      <BackFx sec={songSec} bpm={bpm} mix={mix} scale={0.8} />
      {data.lines.map((line, i) => {
        const t = line.t + off - startSec;
        return <PhraseLayer key={i} line={{ ...line, t }} idx={i} scale={scale} songSec={songSec} bpm={bpm} />;
      })}
      <FrontFx sec={songSec} frame={frame} bpm={bpm} mix={mix} scale={0.8} />
      <Audio src={staticFile(data.meta.audio)} startFrom={Math.round(startSec * fps)} endAt={Math.round(endSec * fps)} />
    </AbsoluteFill>
  );
};

// 縦ショート別バージョン: ダンスのループ動画を背景に敷く（transformグルーヴなし）。
// サビ前（danceStartSec まで）は完全静止 → サビ頭でホワイトアウト＋kawaiiバースト → 踊ってる状態から開始。
// ループ素材は「手上げダンス中」区間のみのパリンドロームなので、ポーズジャンプは白フラッシュが完全に隠す。
export const ShortVideoDance: React.FC<{
  data: LyricData;
  startSec: number;
  endSec: number;
  bgVideo: string;
  bgVideoFrames: number;
  danceStartSec: number; // 絶対秒（サビ頭）
}> = ({ data, startSec, endSec, bgVideo, bgVideoFrames, danceStartSec }) => {
  const off = data.meta.timingOffsetSec ?? 0;
  const fps = data.meta.fps;
  const bpm = data.meta.bpm ?? 120;
  const frame = useCurrentFrame();
  const songSec = frame / fps + startSec;
  const scale = 0.8;
  const danceFrom = Math.round((danceStartSec - startSec) * fps);
  const section = sectionAt(songSec, data.meta.sections);
  const mix = fxMixAt(songSec, section, bpm);
  return (
    <AbsoluteFill style={{ backgroundColor: '#fff4fa' }}>
      <Sequence durationInFrames={danceFrom} layout="none">
        <StillBackground src={data.meta.backgroundVertical} />
      </Sequence>
      <Sequence from={danceFrom} layout="none">
        <VideoBackground src={bgVideo} loopFrames={bgVideoFrames} />
      </Sequence>
      <BackFx sec={songSec} bpm={bpm} mix={mix} scale={0.8} />
      <KawaiiBurst from={danceFrom} />
      {data.lines.map((line, i) => {
        const t = line.t + off - startSec;
        return <PhraseLayer key={i} line={{ ...line, t }} idx={i} scale={scale} songSec={songSec} bpm={bpm} />;
      })}
      <FrontFx sec={songSec} frame={frame} bpm={bpm} mix={mix} scale={0.8} />
      <Audio src={staticFile(data.meta.audio)} startFrom={Math.round(startSec * fps)} endAt={Math.round(endSec * fps)} />
    </AbsoluteFill>
  );
};
