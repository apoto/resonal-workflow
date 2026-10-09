import React from 'react';
import { AbsoluteFill, Loop, OffthreadVideo, Img, staticFile, Freeze, useCurrentFrame, useVideoConfig } from 'remotion';
import { beatPulse } from './beats';
import { Scene } from './types';

// 決定論的な擬似乱数（Math.random不可のため ハッシュ）
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// 砂嵐ノイズ（feTurbulenceのインラインSVG）。seedでパターンが変わる＝フレームごとにチラつく。
const noiseUrl = (seed: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='${seed}'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

// 背景動画レイヤー（Loop同期）。色ズレ・スライス用に同じ動画を複製してもLoopが同期する。
const VideoLayer: React.FC<{ src: string; loopFrames: number; style?: React.CSSProperties }> = ({
  src,
  loopFrames,
  style,
}) => (
  <Loop durationInFrames={loopFrames}>
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
    </AbsoluteFill>
  </Loop>
);

export const BeatBackground: React.FC<{
  beats: number[];
  background?: string;
  backgroundVideo?: string;
  backgroundVideoDuration?: number;
  scenes?: Scene[];
}> = ({ beats, background, backgroundVideo, backgroundVideoDuration, scenes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = beatPulse(frame, beats, 9);
  const hasBg = Boolean(backgroundVideo || background);
  const loopFrames = Math.max(1, Math.round((backgroundVideoDuration ?? 10) * fps));
  const sec = frame / fps;

  // 現在有効なシーン
  const active = (scenes ?? []).filter((s) => sec >= s.start && sec < s.end);
  const blackout = active.find((s) => s.effect === 'blackout');
  const glitch = active.find((s) => s.effect === 'bgGlitch');
  const chroma = active.find((s) => s.effect === 'bgChroma');

  // グリッチ強度（シーン端で滑らかに立ち上がり/減衰）
  let gi = 0;
  if (glitch) {
    const base = glitch.intensity ?? 1;
    const edge = Math.min(sec - glitch.start, glitch.end - sec);
    gi = base * Math.min(1, edge / 0.3);
  }

  // クロマ（赤青ズレ）強度：オンセットは即時（フェードインしない＝ヒットでドン）、終わりだけフェードアウト。
  let ci = 0;
  let he = 0; // ヒット包絡（hits の瞬間に1→0.5秒で減衰）
  if (chroma) {
    const base = chroma.intensity ?? 1;
    ci = base * Math.min(1, (chroma.end - sec) / 0.6); // 立ち上がりはスラム、末尾0.6sでフェードアウト
    const hits = chroma.hits && chroma.hits.length ? chroma.hits : [chroma.start];
    for (const h of hits) {
      if (sec >= h) he = Math.max(he, Math.max(0, 1 - (sec - h) / 0.5));
    }
    he *= base;
  }
  // 横ズレ量＝持続分（ビート同期）＋ヒットの跳ね
  const chromaOff = (5 + pulse * 16) * ci + he * 30;

  // ステップ量子化：数フレーム同じ崩れ方を保持＝「カクついて固まる」デジタル感（＝早送り感の逆）。
  const STEP = 5;
  const sfi = Math.floor(frame / STEP); // ステップ番号
  const frozen = sfi * STEP; // このステップで映像を固定するフレーム（スタッター）
  const r1 = hash(sfi * 1.3 + 2);
  const r2 = hash(sfi * 2.7 + 11);
  const r3 = hash(sfi * 4.1 + 5);
  const hardGlitch = gi > 0 && r3 > 0.5; // このステップは激しく崩す
  const blockShift = hardGlitch ? (r1 * 2 - 1) * 70 * gi : 0; // 画面全体が横にガクッとズレる
  const splitOff = (8 + r2 * 28) * gi * (hardGlitch ? 1 : 0.4); // RGBスプリット量（ステップ保持）
  const jitterX = (r1 * 2 - 1) * 8 * gi * (hardGlitch ? 1 : 0.25);
  const flick = hardGlitch && r2 > 0.72 ? 0.13 * gi : 0; // 一瞬の白フラッシュ

  const renderVideo = (extraStyle?: React.CSSProperties) =>
    backgroundVideo ? <VideoLayer src={backgroundVideo} loopFrames={loopFrames} style={extraStyle} /> : null;

  // 本体映像のフィルタ：グリッチ時はコントラスト強調、クロマのヒット時は一瞬ブラー（＝視界がぼやける）。
  const baseFilterParts: string[] = [];
  if (gi) baseFilterParts.push(`contrast(${1 + 0.25 * gi}) saturate(${1 + 0.4 * gi})`);
  if (he > 0.01) baseFilterParts.push(`blur(${(he * 4.5).toFixed(2)}px) saturate(${1 + 0.25 * ci})`);
  const baseFilter = baseFilterParts.length ? baseFilterParts.join(' ') : undefined;

  // 映像本体＋グリッチ重ね（RGBスプリット＋横ブロックのズレ）
  const videoStack = (
    <>
      {renderVideo(baseFilter ? { filter: baseFilter } : undefined)}
      {gi > 0.05 ? (
        <>
          {/* RGBスプリット（ステップ保持で「カクッ」とズレる） */}
          <AbsoluteFill style={{ transform: `translateX(${-splitOff}px)`, mixBlendMode: 'screen', opacity: 0.55 * gi }}>
            {renderVideo({ filter: 'sepia(1) saturate(6) hue-rotate(-50deg)' })}
          </AbsoluteFill>
          <AbsoluteFill style={{ transform: `translateX(${splitOff}px)`, mixBlendMode: 'screen', opacity: 0.55 * gi }}>
            {renderVideo({ filter: 'sepia(1) saturate(6) hue-rotate(120deg)' })}
          </AbsoluteFill>
          {/* 横ブロックのズレ（ステップごとに固まってズレる＝データモッシュ風） */}
          {[0, 1, 2, 3].map((k) => {
            const top = hash(sfi * (1.1 + k) + k) * 86;
            const h = 5 + hash(sfi * (2.2 + k)) * 12;
            const dx = (hash(sfi * (3.3 + k)) * 2 - 1) * (hardGlitch ? 100 : 28) * gi;
            return (
              <AbsoluteFill
                key={k}
                style={{ clipPath: `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`, transform: `translateX(${dx}px)` }}
              >
                {renderVideo()}
              </AbsoluteFill>
            );
          })}
        </>
      ) : null}
    </>
  );

  return (
    <AbsoluteFill className="bg-black overflow-hidden">
      <AbsoluteFill style={{ transform: gi ? `translateX(${jitterX + blockShift}px)` : undefined }}>
        {backgroundVideo ? (
          // グリッチ中は映像をステップで固定＝スタッター（早送りでなくカクつく）
          gi > 0.02 ? <Freeze frame={frozen}>{videoStack}</Freeze> : videoStack
        ) : background ? (
          <Img src={staticFile(background)} className="w-full h-full" style={{ objectFit: 'cover' }} />
        ) : null}
      </AbsoluteFill>

      {/* サビ用の赤青クロマ：hits の瞬間(he)に跳ね、以降は軽く持続。ビート同期。 */}
      {backgroundVideo && ci > 0.05 ? (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `translateX(${-chromaOff}px)`, mixBlendMode: 'screen', opacity: Math.min(0.9, (0.5 + 0.4 * he) * ci) }}>
            {renderVideo({ filter: 'sepia(1) saturate(8) hue-rotate(-50deg)' })}
          </AbsoluteFill>
          <AbsoluteFill style={{ transform: `translateX(${chromaOff}px)`, mixBlendMode: 'screen', opacity: Math.min(0.9, (0.5 + 0.4 * he) * ci) }}>
            {renderVideo({ filter: 'sepia(1) saturate(8) hue-rotate(150deg)' })}
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      {/* 砂嵐ノイズ：hits の瞬間にドンと強く乗り、0.5秒で収まる（＝視界がぼやける） */}
      {he > 0.02 ? (
        <AbsoluteFill
          style={{
            backgroundImage: noiseUrl(sfi % 89),
            backgroundSize: '120% 120%',
            opacity: Math.min(0.55, 0.55 * he),
            mixBlendMode: 'overlay',
          }}
        />
      ) : null}

      {/* 可読性のための薄い暗幕 */}
      <AbsoluteFill style={{ backgroundColor: '#000', opacity: hasBg ? 0.28 : 1 }} />
      {/* スキャンライン（グリッチ時のみ） */}
      {gi > 0.05 ? (
        <AbsoluteFill
          style={{
            opacity: 0.25 * gi,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 2px, transparent 3px)',
          }}
        />
      ) : null}
      {/* グリッチ時の白フラッシュ */}
      {flick ? <AbsoluteFill style={{ backgroundColor: '#fff', opacity: flick }} /> : null}
      {/* ビートの控えめなフラッシュ */}
      <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: pulse * 0.05 }} />
      {/* 暗転：動画を覆って黒く */}
      {blackout ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#000',
            opacity: (blackout.intensity ?? 1) * Math.min(1, Math.min(sec - blackout.start, blackout.end - sec) / 0.4 + 0.15),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
