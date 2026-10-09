import React from 'react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Credits, CreditCard, DEFAULT_CREDITS } from './Credits';

// ----------------------------------------------------------------------------
//  背景画像1枚＋音源で、被写体を中心に「音に同期して激しく蠢く円形波形」を出す。
//  同期の肝: <Audio> と全レイヤーが同じ useCurrentFrame() を基準に描画し、
//  スペクトルは visualizeAudio で「そのフレームで鳴っている音」を直読みする。
//  → 事前計算のタイムラインが無いので原理的にズレない。
// ----------------------------------------------------------------------------

const DEFAULT_AUDIO_SRC = 'audio.wav'; // public/audio.wav
const BG_IMAGE = 'background.png'; // public/background.png  ← 画像名に合わせて変更

const COLORS = {
  cyan: '#22e6ff',
  pink: '#ff2ec4',
  white: '#ffffff',
  black: '#0a0418',
} as const;

const TAU = Math.PI * 2;

/** 閉じた点列を Catmull-Rom で滑らかな閉曲線(SVGパス)にする＝ウニョウニョ感 */
const closedSmoothPath = (pts: [number, number][]): string => {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + ' Z';
};

interface RingParams {
  baseR: number; // 基準半径(px)
  amp: number; // 振幅の伸び(px)
  rotation: number; // 回転(rad)
  bins: number; // 周波数ビン数(角方向の頂点解像度)
  color: string;
  width: number; // 線幅
  fill?: string;
  binOffset?: number; // 使う周波数帯のずらし
  exp?: number; // 振幅の効き(誇張)
  squirm?: number; // 進行波うねりの強さ(px)
  squirmK?: number; // リング1周あたりのうねり山数
}

/** 1本のリングのパスを生成（左右対称にミラーして波形リングらしく） */
const buildRingPath = (
  spectrum: number[],
  cx: number,
  cy: number,
  p: RingParams,
  tnow: number
): string => {
  const half = p.bins;
  const total = half * 2; // ミラーで2倍
  const pts: [number, number][] = [];
  const exp = p.exp ?? 1.0;
  const squirm = p.squirm ?? 0;
  const squirmK = p.squirmK ?? 5;
  for (let j = 0; j < total; j++) {
    const bin = (j < half ? j : total - 1 - j) + (p.binOffset ?? 0);
    const v = Math.min(1, spectrum[bin % spectrum.length] ?? 0);
    const a = (j / total) * TAU + p.rotation;
    const wave =
      Math.pow(v, exp) * p.amp +
      squirm * Math.sin(a * squirmK + tnow * 6) * (0.4 + v);
    const r = p.baseR + wave;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return closedSmoothPath(pts);
};

export interface RingVisualizerProps {
  centerX?: number; // リング中心(画面比)
  centerY?: number;
  imgShiftX?: number; // 背景画像の平行移動(画面比)。被写体を中心へ
  imgShiftY?: number;
  intensity?: number; // 波形振幅の倍率
  squirm?: number; // 進行波うねりの強さ(px)
  ring1Color?: string;
  ring2Color?: string;
  ring3Color?: string;
  audioSrc?: string; // public/ 内の音源ファイル名（縦動画では切り抜き版を渡す）
  ringScale?: number; // リング全体の半径スケール（横幅の狭い縦動画で縮める用。1.0=既定）
  widthScale?: number; // 線幅の倍率（縦動画で太くしてインパクトを出す用。1.0=既定）
  fadeInSec?: number; // 冒頭フェードイン秒（既定0.5）
  fadeOutSec?: number; // 末尾フェードアウト秒（既定1.2／0で「バスッと」終わる）
  /** 冒頭クレジット。省略時は DEFAULT_CREDITS（input/project.json の credits）が入る。
   *  ショートで出したくないときだけ空配列 [] を渡す。 */
  credits?: CreditCard[];
}

export const RingVisualizer: React.FC<RingVisualizerProps> = ({
  centerX = 0.5,
  centerY = 0.5,
  imgShiftX = 0,
  imgShiftY = 0,
  intensity = 1.7,
  squirm = 26,
  ring1Color = COLORS.cyan,
  ring2Color = COLORS.pink,
  ring3Color = COLORS.white,
  audioSrc = DEFAULT_AUDIO_SRC,
  ringScale = 1,
  widthScale = 1,
  fadeInSec = 0.5,
  fadeOutSec = 1.2,
  credits = DEFAULT_CREDITS,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const audioData = useAudioData(staticFile(audioSrc));

  const raw = audioData
    ? visualizeAudio({ fps, frame, audioData, numberOfSamples: 256 })
    : new Array(256).fill(0);

  // 低域(ベース)で全体を脈動
  const bass = Math.min(1, ((raw[0] + raw[1] + raw[2]) / 3) * 6);
  // 全体音量（リングの大きさ）。静かでも見えるよう下限を確保
  const loud = Math.min(1, (raw.slice(0, 96).reduce((s, v) => s + v, 0) / 96) * 9);
  const energy = 0.4 + loud * 0.6;

  // 毎フレーム正規化：最大ビンを1に揃え、凹凸を常に最大化（静音部でも蠢く）
  const peak = Math.max(1e-4, ...raw.slice(0, 128));
  const spectrum = raw.map((v) => Math.min(1, (v / peak) ** 0.85));

  const cx = width * centerX;
  const cy = height * centerY;
  const t = frame / fps;

  // ベースズームは「被写体を中央に寄せる平行移動(imgShift)で画面端に黒が出ない」最小倍率を自動確保する。
  // translate後にcoverを保つには scale >= 1 + 2*max(|imgShiftX|,|imgShiftY|)。それに小さなケンバーンズ余白を足す。
  const coverBase = 1.04 + 2 * Math.max(Math.abs(imgShiftX), Math.abs(imgShiftY));
  const imgScale = coverBase + bass * 0.05 + interpolate(frame, [0, durationInFrames], [0, 0.06]);
  const pulse = 1 + bass * 0.18;

  const rs = ringScale;
  const rings: RingParams[] = [
    {
      baseR: 210 * pulse * rs,
      amp: 320 * energy * intensity * rs,
      rotation: t * 1.4,
      bins: 56,
      color: ring1Color,
      width: 6,
      binOffset: 0,
      exp: 0.8,
      squirm: squirm * rs,
      squirmK: 6,
    },
    {
      baseR: 300 * pulse * rs,
      amp: 400 * energy * intensity * rs,
      rotation: -t * 1.9 + 0.3,
      bins: 72,
      color: ring2Color,
      width: 7,
      binOffset: 5,
      exp: 0.78,
      squirm: squirm * 1.3 * rs,
      squirmK: 9,
    },
    {
      baseR: 400 * pulse * rs,
      amp: 360 * energy * intensity * rs,
      rotation: t * 0.95 + 1.1,
      bins: 92,
      color: ring3Color,
      width: 3,
      binOffset: 11,
      exp: 0.9,
      squirm: squirm * 1.6 * rs,
      squirmK: 13,
    },
  ];

  const fadeInFrames = Math.max(1, Math.round(fps * fadeInSec));
  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fadeOut =
    fadeOutSec <= 0
      ? 1 // 「バスッと」終わる：末尾フェードなし
      : interpolate(
          frame,
          [durationInFrames - Math.round(fps * fadeOutSec), durationInFrames],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
  const fade = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <Audio src={staticFile(audioSrc)} />

      {/* 背景画像1枚（被写体を中心へ平行移動＋ゆっくりズーム＋ベース鼓動） */}
      <AbsoluteFill>
        <Img
          src={staticFile(BG_IMAGE)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(${imgShiftX * width}px, ${imgShiftY * height}px) scale(${imgScale})`,
          }}
        />
      </AbsoluteFill>

      {/* 中心を少し締めて波形を引き立てる暗がり */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${centerX * 100}% ${centerY * 100}%, rgba(10,4,24,0.45) 0%, rgba(10,4,24,0.15) 28%, transparent 55%)`,
          mixBlendMode: 'multiply',
        }}
      />

      {/* 円形波形 */}
      <AbsoluteFill style={{ opacity: fade }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 中心の発光コア（キックで膨らむ） */}
          <circle
            cx={cx}
            cy={cy}
            r={(60 + bass * 90) * rs}
            fill={ring2Color}
            opacity={0.12 + bass * 0.25}
            filter="url(#ringGlow)"
          />

          {rings.map((p, i) => (
            <path
              key={i}
              d={buildRingPath(spectrum, cx, cy, p, t)}
              fill={p.fill ?? 'none'}
              stroke={p.color}
              strokeWidth={p.width * widthScale}
              strokeLinejoin="round"
              opacity={0.55 + energy * 0.45}
              style={{ filter: `drop-shadow(0 0 ${10 + bass * 24}px ${p.color})` }}
            />
          ))}
        </svg>
      </AbsoluteFill>

      {/* 冒頭クレジット（input/project.json） */}
      <Credits cards={credits} sec={frame / fps} />
    </AbsoluteFill>
  );
};
