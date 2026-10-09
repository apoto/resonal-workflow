import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { InvertShapesData } from './types';
import { Background } from './Background';
import { InvertShapesLyrics } from './InvertShapes';
import { Credits } from './Credits';
import { Hud } from './Hud';
import { EndCard } from './EndCard';

const BG = '#0d0b12';
const VIOLET = '#8b3dff';   // この曲で唯一の彩度＝放電（再着色はここ）

/**
 * 画面全体のネガ反転（records/negative-invert）＋紫スパーク。
 * ★invert-shapes core の「白図形×文字の difference」とは別レイヤ。
 *   core は全編、こちらは **打点だけ**（1秒3回以下）。Breakdown / Bridge は 0 回。
 */
const useHazard = (data: InvertShapesData, startSec: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = startSec + frame / fps;
  const off = data.meta.timingOffsetSec ?? 0;

  // ★kind='big' だけ画面全体を反転する。'small' は電光だけ走らせて反転しない
  //   （全画面反転が多すぎると目がチカチカする）
  const inverted = (data.meta.invertHits ?? []).some((h) => {
    if (h.kind === 'small') return false;
    const a = h.t + off;
    return t >= a && t < a + h.f / fps;
  });

  // ★スパークは「パキッ」＝短い。0.13秒で落ちきる（長く光らせるとぼやけて鈍る）。
  //   seed で打点ごとに稲妻の形を変え、power で本数・太さを変える。
  let spark = 0;
  let seed = 0;
  let power = 1;
  // ★反転(最大8f=0.27s)より長く残す＝反転中は白飛びで見えないので、**明けた瞬間の暗い画面に残光**が走る。
  //   「パキッ」は立ち上がりの鋭さ(2フレームで走り抜ける)で作るので、残光を伸ばしても鈍らない。
  const DECAY = 0.36;
  for (const s of data.meta.sparkHits ?? []) {
    const d = t - (s + off);
    if (d >= 0 && d < DECAY) {
      const v = 1 - d / DECAY;
      if (v > spark) { spark = v; seed = Math.round(s * 1000); power = 0.8; }
    }
  }
  for (const h of data.meta.invertHits ?? []) {
    const d = t - (h.t + off);
    if (d >= 0 && d < DECAY) {
      const v = 1 - d / DECAY;
      // big は電光2本＋広い振幅、small は1本
      if (v > spark) { spark = v; seed = Math.round(h.t * 1000); power = h.kind === 'big' ? 2 : 1; }
    }
  }
  return { t, inverted, spark, seed, power };
};

// 決定的乱数（seed から同じ形が再現される＝レンダーの再現性を守る）
const rn = (i: number, seed: number) => {
  const x = Math.sin((i + 1) * 12.9898 + (seed % 9973) * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 画面全体を走る枝分かれ電光（radial-gradient の発光ではぼやけて「パキッ」にならない）。
 *
 * 設計:
 *  - **プロシージャル生成**（動画素材にしない）＝打点それぞれに 1フレーム単位で合わせられる。
 *    seed を打点の秒から作るので**毎回違う形**が走り、かつレンダーは再現可能。
 *  - 主幹は画面の端から端へ**直線的なジグザグ**（滑らかにしない＝角が「パキッ」の正体）。
 *  - 枝を数本。細い白コア＋紫のグローの2層で発光体に見せる。
 *  - 減衰は 0.13秒で落ちきる（長いとぼやけて鈍る）。
 */
const Bolt: React.FC<{ seed: number; w: number; h: number; grow: number; wide: boolean; dark: boolean }> = ({
  seed,
  w,
  h,
  grow,
  wide,
  dark,
}) => {
  // 走る向き: 0=上→下 / 1=左→右 / 2=右上→左下
  const dir = Math.floor(rn(0, seed) * 3);
  const SEG = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    // 主軸に沿って進み、直交方向へランダムに折れる（振幅は中央で最大＝端は収束させる）
    const amp = Math.sin(u * Math.PI) * (wide ? 0.30 : 0.20);
    const j = (rn(i * 3 + 1, seed) * 2 - 1) * amp;
    if (dir === 0) pts.push([w * (0.5 + j), h * u]);
    else if (dir === 1) pts.push([w * u, h * (0.45 + j)]);
    else pts.push([w * (1 - u), h * (0.15 + u * 0.7 + j * 0.6)]);
  }
  // grow: 先端が伸びていく（一瞬で走り抜ける感じ）
  const n = Math.max(2, Math.ceil(pts.length * grow));
  const main = pts.slice(0, n).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ');

  // 枝: 主幹の途中から短く分岐
  const branches: string[] = [];
  const bn = wide ? 5 : 3;
  for (let b = 0; b < bn; b++) {
    const at = Math.floor(2 + rn(b * 7 + 2, seed) * (n - 3));
    if (at <= 1 || at >= pts.length - 1) continue;
    const [bx, by] = pts[at];
    const len = (0.06 + rn(b * 11 + 3, seed) * 0.13) * (dir === 1 ? w : h);
    const ang = (rn(b * 13 + 4, seed) * 2 - 1) * 1.15 + (dir === 1 ? 0 : Math.PI / 2);
    const seg: string[] = [`${bx.toFixed(0)},${by.toFixed(0)}`];
    let cx = bx;
    let cy = by;
    for (let k = 1; k <= 4; k++) {
      const a = ang + (rn(b * 17 + k, seed) * 2 - 1) * 0.55;
      cx += Math.cos(a) * (len / 4);
      cy += Math.sin(a) * (len / 4);
      seg.push(`${cx.toFixed(0)},${cy.toFixed(0)}`);
    }
    branches.push(seg.join(' '));
  }

  const glow = (sw: number, color: string, op: number) => (
    <>
      <polyline points={main} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" opacity={op} />
      {branches.map((p, i) => (
        <polyline key={i} points={p} fill="none" stroke={color} strokeWidth={sw * 0.55} strokeLinecap="round" opacity={op * 0.85} />
      ))}
    </>
  );

  // ★反転中(dark)は画面が白飛びしているので、光らせる代わりに**黒い稲妻**として抜く。
  //   そうしないと screen ブレンドの紫が白背景に埋もれて完全に見えない（初回stillで実際に消えた）。
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
      {dark ? (
        <>
          <g style={{ filter: 'blur(10px)' }}>{glow(wide ? 17 : 12, '#2a0a4a', 0.85)}</g>
          <g style={{ filter: 'blur(2px)' }}>{glow(wide ? 5 : 3.5, '#12021f', 1)}</g>
          {glow(wide ? 2.4 : 1.7, '#000000', 1)}
        </>
      ) : (
        <>
          <g style={{ filter: `blur(${wide ? 13 : 9}px)` }}>{glow(wide ? 16 : 11, VIOLET, 0.95)}</g>
          <g style={{ filter: 'blur(2.5px)' }}>{glow(wide ? 5 : 3.5, '#c9a6ff', 1)}</g>
          {glow(wide ? 2.4 : 1.7, '#ffffff', 1)}
        </>
      )}
    </svg>
  );
};

const SparkOverlay: React.FC<{ v: number; seed: number; power: number; inverted: boolean }> = ({
  v,
  seed,
  power,
  inverted,
}) => {
  const { width, height } = useVideoConfig();
  if (v <= 0.01) return null;
  // 先端の伸び: 立ち上がりの2フレームで走り抜ける（ここが「パキッ」の正体）
  const grow = Math.min(1, (1 - v) * 9 + 0.30);
  // 明るさは急減衰（v^1.7）＝頭が鋭く、残光は素早く薄くなる
  const bright = Math.pow(v, 1.7);
  const bolts = power >= 2 ? 2 : 1;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: inverted ? 'multiply' : 'screen',
        opacity: Math.min(1, (inverted ? v : bright) * 1.3),
      }}
    >
      {/* 電光の地明かり（空気が一瞬光る）。反転中は白飛びしているので出さない */}
      {!inverted ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(80% 60% at 50% 45%, ${VIOLET}33 0%, rgba(0,0,0,0) 70%)` }}
        />
      ) : null}
      {Array.from({ length: bolts }, (_, i) => (
        <Bolt
          key={i}
          seed={seed + i * 977}
          w={width}
          h={height}
          grow={grow}
          wide={power >= 2 && i === 0}
          dark={inverted}
        />
      ))}
    </AbsoluteFill>
  );
};

// 本編 16:9
export const LyricVideo: React.FC<{ data: InvertShapesData }> = ({ data }) => {
  const m = data.meta;
  const { t, inverted, spark, seed, power } = useHazard(data, 0);
  return (
    <AbsoluteFill style={{ backgroundColor: m.bgColor ?? BG }}>
      {/* ★反転は「輝度だけ」= grayscale→invert。素の invert(1) は色相も反転して
          唯一の彩度である紫を緑に変えてしまう（パレット違反）。白黒が裏返るのが署名。 */}
      <AbsoluteFill style={{ filter: inverted ? 'grayscale(1) invert(1)' : undefined }}>
        <Background
          src={m.bg}
          video={m.bgVideo}
          videoSec={m.bgVideoSec}
          color={m.bgColor}
          t={t}
          calmRegions={m.calmRegions}
          faceRegions={m.faceRegions}
          videoRegions={m.videoRegions}
          cameraMoves={m.cameraMoves}
          buildRegions={m.buildRegions}
          spark={spark}
        />
        <InvertShapesLyrics data={data} scale={1} />
      </AbsoluteFill>
      {/* HUDは反転の外＝世界が裏返っても「計測システム」は生きている、という意味づけ */}
      <Hud regions={m.hudRegions} t={t} scale={1} label={m.thumbTitle} />
      {/* クレジットと紫スパークは反転の外＝反転中も文言が読めて、紫が紫のまま走る */}
      <Credits credits={m.credits} scale={1} />
      <SparkOverlay v={spark} seed={seed} power={power} inverted={inverted} />
      {/* ★冒頭の曲名カード（クレジットの後・歌い出しの前）。暗転せず背景の上に出す */}
      {m.titleCard ? (
        <EndCard
          ec={{ boltAt: m.titleCard.from, blackFrom: m.titleCard.from, titleFrom: m.titleCard.from, title: m.thumbTitle ?? '' }}
          t={t >= m.titleCard.from && t < m.titleCard.to ? t : -1}
          scale={1}
          transparent
        />
      ) : null}
      {/* エンドカード（暗転→タイトル）は最前面。ここまで来たら歌詞もHUDも見せない */}
      <EndCard ec={m.endCard} t={t} scale={1} />
      {m.audio ? <Audio src={staticFile(m.audio)} /> : null}
    </AbsoluteFill>
  );
};

// 縦ショート 9:16（区間切り出し）
export const ShortVideo: React.FC<{ data: InvertShapesData; startSec: number; endSec: number }> = ({
  data,
  startSec,
  endSec,
}) => {
  const m = data.meta;
  const { fps } = useVideoConfig();
  const { t, inverted, spark, seed, power } = useHazard(data, startSec);
  const scale = 0.5;
  return (
    <AbsoluteFill style={{ backgroundColor: m.bgColor ?? BG }}>
      <AbsoluteFill style={{ filter: inverted ? 'grayscale(1) invert(1)' : undefined }}>
        <Background
          src={m.bgVertical}
          video={m.bgVideoVertical}
          videoSec={m.bgVideoSec}
          color={m.bgColor}
          t={t}
          calmRegions={m.calmRegions}
          faceRegions={m.faceRegions}
          flickerUntil={0}
        />
        {/* 縦は背景がバストアップ前提なので歌詞を下寄りにして顔を隠さない（構図に合わせて変える） */}
      <AbsoluteFill style={{ transform: 'translateY(23%)' }}>
        <InvertShapesLyrics data={data} scale={scale} startSec={startSec} />
      </AbsoluteFill>
      </AbsoluteFill>
      <Hud regions={m.hudRegions} t={t} scale={0.62} label={m.thumbTitle} />
      <SparkOverlay v={spark} seed={seed} power={power} inverted={inverted} />
      {m.audio ? (
        <Audio src={staticFile(m.audio)} startFrom={Math.round(startSec * fps)} endAt={Math.round(endSec * fps)} />
      ) : null}
    </AbsoluteFill>
  );
};
