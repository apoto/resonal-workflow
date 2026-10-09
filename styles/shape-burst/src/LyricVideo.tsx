import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { InvertShapesData } from './types';
import { Stage } from './Stage';
import { ShapeBurstLyrics, ShapeBurstBG, PAL } from './ShapeBurst';
import { Credits, CreditCard, CreditTheme } from './Credits';
import { JP_GOTHIC } from './fonts';
import { CREDITS_FROM, CREDITS_STEP } from './song';
import project from '../input/project.json';

/** クレジット＝input/project.json の credits を CREDITS_FROM から1枚ずつ出す */
const CARDS: CreditCard[] = (project.credits as string[]).map((text, i) => ({
  text,
  from: CREDITS_FROM + i * CREDITS_STEP,
  to: CREDITS_FROM + (i + 1) * CREDITS_STEP,
}));

// 高明度スタイルのクレジット意匠:
// スクリムは白（黒スクリムだと高明度の画面が濁る）。文字は濃いインク＝歌詞と同じ極性。
// 書体は JP_GOTHIC（Dela Gothic One は密な漢字が潰れる）。縁はぼかさない白縁（ぼかすとにじむ）。
const CREDIT_THEME: Partial<CreditTheme> = {
  fontFamily: JP_GOTHIC,
  color: PAL.INK,
  subColor: PAL.MAGENTA,
  glow: ['2px 0', '-2px 0', '0 2px', '0 -2px', '2px 2px', '-2px -2px', '2px -2px', '-2px 2px']
    .map((d) => `${d} 0 #ffffff`).join(', '),
  subGlow: ['1.5px 0', '-1.5px 0', '0 1.5px', '0 -1.5px'].map((d) => `${d} 0 #ffffff`).join(', '),
  fade: 0.12, // ほぼハードカット
  bottom: 5.5,
  nameSize: 54,
  subSize: 26,
  letterSpacing: '0.22em',
  subLetterSpacing: '0.4em',
  scrimRgb: '255,255,255',
  // 白スクリムは濃い被写体を持ち上げきれないので強めに焼く
  scrimStrength: 0.97,
};

// 本編 16:9。Stage（多層パララックス）＋歌詞オーバーレイ＋歌詞＋クレジット＋音源。
export const LyricVideo: React.FC<{ data: InvertShapesData }> = ({ data }) => {
  const m = data.meta;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: m.bgColor ?? PAL.BG }}>
      <Stage meta={m} />
      <ShapeBurstBG />
      <ShapeBurstLyrics data={data} scale={1} />
      <Credits cards={CARDS} sec={frame / fps} theme={CREDIT_THEME} />
      {m.audio ? <Audio src={staticFile(m.audio)} /> : null}
    </AbsoluteFill>
  );
};

// 縦ショート 9:16。区間切り出し。Stage は frameOffset で絶対時間の sec/hit/表情/雲キューに同期。
export const ShortVideo: React.FC<{ data: InvertShapesData; startSec: number; endSec: number }> = ({ data, startSec, endSec }) => {
  const m = data.meta;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = 0.62; // 1080幅に合わせて縮小
  return (
    <AbsoluteFill style={{ backgroundColor: m.bgColor ?? PAL.BG }}>
      <Stage meta={m} vertical frameOffset={Math.round(startSec * fps)} />
      <ShapeBurstBG frameOffset={Math.round(startSec * fps)} />
      <ShapeBurstLyrics data={data} scale={scale} startSec={startSec} />
      {/* 区間がクレジット枠を含めばショートにも出る */}
      <Credits cards={CARDS} sec={startSec + frame / fps} scale={0.8} theme={CREDIT_THEME} />
      {m.audio ? (
        <Audio src={staticFile(m.audio)} startFrom={Math.round(startSec * fps)} endAt={Math.round(endSec * fps)} />
      ) : null}
    </AbsoluteFill>
  );
};
