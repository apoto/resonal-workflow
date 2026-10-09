import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PALETTE, PixelSvg, HEART_GRID, STAR_GRID, PLUS_GRID } from './PinkBounce';
import { Section, SectionName } from './types';
import { barEnv, barSec, beatEnv, clamp01, seeded } from './Camera';

/**
 * 区間別の画面演出。サビ以外も動きが途切れないように敷くレイヤー群:
 *   fx.sparkle / fx.parallax-dust / fx.speed-lines / fx.zoom-punch / fx.strobe /
 *   fx.chromatic-shake / fx.confetti / fx.ripple / bg.sunburst-rotate
 * 顔ゾーン（中央上部）と歌詞帯（y≒68〜88%）を潰さないのは既存FXと同じ制約。
 */

const KINDS = [HEART_GRID, STAR_GRID, PLUS_GRID];
const COLORS = [PALETTE.HEART, PALETTE.STAR, PALETTE.PLUS];

// ---- 常時のふわふわデコ（fx.parallax-dust をピクセルデコに置換） ----
// DecoLayer はフレーズ表示中だけ出るので、間奏やAメロの合間を埋めるためにこちらはフレーズと無関係に流れ続け、奥/中/手前の3層が別速度で動いて奥行きを作る。
export const AmbientDeco: React.FC<{ sec: number; scale?: number; strength?: number }> = ({
  sec,
  scale = 1,
  strength = 1,
}) => {
  if (strength <= 0) return null;
  // 「エフェクトが小さくて動きが見えない」対策: 手前層は思い切って大きく＆速くする。
  // 奥(小さく遅くぼかす)→手前(大きく速くシャープ)の差が大きいほど画面が動いて見える。
  const layers = [
    { n: 7, base: 0, size: 30, period: 16.5, opacity: 0.26, blur: 2.6 },
    { n: 5, base: 60, size: 58, period: 11.0, opacity: 0.42, blur: 1.0 },
    { n: 4, base: 120, size: 104, period: 7.0, opacity: 0.58, blur: 0 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {layers.map((L, li) =>
        Array.from({ length: L.n }).map((_, i) => {
          const seed = L.base + i * 7.3;
          const phase = seeded(seed * 3.7) * L.period;
          const progress = (((sec + phase) % L.period) + L.period) % L.period / L.period;
          // 顔ゾーン(x 34..66% の上半分)を避けて左右の帯に配置する
          const side = i % 2 === 0 ? seeded(seed * 5.1) * 30 + 2 : 68 + seeded(seed * 5.1) * 30;
          const y = 96 - progress * 96;
          const wob = Math.sin(progress * Math.PI * 2 * 2 + seeded(seed * 2.3) * 6) * 3.2;
          const size = L.size * (0.7 + seeded(seed * 4.4) * 0.7) * scale;
          const kind = Math.floor(seeded(seed * 1.9) * 3);
          const o =
            L.opacity * strength * Math.min(clamp01(progress / 0.12), clamp01((1 - progress) / 0.18));
          if (o <= 0.005) return null;
          return (
            <div
              key={`${li}-${i}`}
              style={{
                position: 'absolute',
                left: `${side + wob}%`,
                top: `${y}%`,
                transform: `translate(-50%,-50%) rotate(${progress * 200 * (kind === 1 ? 1 : -1)}deg)`,
                opacity: o,
                filter: `${L.blur ? `blur(${L.blur}px) ` : ''}drop-shadow(0 0 ${size * 0.3}px ${COLORS[kind]})`,
                imageRendering: 'pixelated',
              }}
            >
              <PixelSvg grid={KINDS[kind]} s={size} color={COLORS[kind]} />
            </div>
          );
        }),
      )}
    </AbsoluteFill>
  );
};

// ---- キラキラ（fx.sparkle）: 十字グロー。サビ/ブリッジの「上品な賑やかさ」担当 ----
export const SparkleLayer: React.FC<{ frame: number; strength?: number; scale?: number }> = ({
  frame,
  strength = 1,
  scale = 1,
}) => {
  if (strength <= 0) return null;
  const n = 16;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = seeded(i * 9.7) * 100;
        const y = seeded(i * 13.3) * 100;
        // 顔ゾーンに乗ったものは外へ寄せる
        const px = x > 34 && x < 66 && y < 58 ? (x < 50 ? x - 26 : x + 26) : x;
        const freq = 0.1 + seeded(i * 5.1) * 0.2;
        const twinkle = Math.pow(Math.max(0, Math.sin(frame * freq + seeded(i * 7.7) * 6.28)), 3);
        const o = twinkle * 0.85 * strength;
        if (o <= 0.01) return null;
        const size = (5 + seeded(i * 3.3) * 6) * scale;
        const col = i % 3 === 0 ? PALETTE.NEON_A : i % 3 === 1 ? '#ffffff' : PALETTE.GLOW;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${Math.max(2, Math.min(98, px))}%`,
              top: `${y}%`,
              width: size * 6,
              height: size * 6,
              transform: `translate(-50%,-50%) rotate(${seeded(i) * 90}deg)`,
              opacity: o,
            }}
          >
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: '100%', background: col, transform: 'translateX(-50%)', boxShadow: `0 0 ${size}px ${col}` }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, height: 2, width: '100%', background: col, transform: 'translateY(-50%)', boxShadow: `0 0 ${size}px ${col}` }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: size, height: size, borderRadius: '50%', background: '#fff', transform: 'translate(-50%,-50%)', boxShadow: `0 0 ${size * 2}px #fff` }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---- 集中線（fx.speed-lines）をキャンディ色で。ビルド/ブレイクの加速感 ----
// 34枚のグラデdivを個別に回すと毎フレーム34回ラスタライズが走り、ブレイクダウンでコマ落ちした
// （全編0.25倍テストで4フレーム真っ白＝背景も歌詞も出ない）。1枚の repeating-conic-gradient を
// GPU transform で回す形に置き換えて、毎フレームの再描画を無くす。
export const SpeedLines: React.FC<{ sec: number; bpm: number; strength?: number }> = ({ sec, bpm, strength = 1 }) => {
  if (strength <= 0.01) return null;
  const env = beatEnv(sec, bpm, 4);
  const fade = 'radial-gradient(circle at 50% 46%, transparent 0%, transparent 12%, #000 42%, #000 100%)';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', opacity: (0.16 + env * 0.3) * strength }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: '260%',
          height: '260%',
          transform: `translate(-50%,-50%) rotate(${sec * 26}deg)`,
          background: `repeating-conic-gradient(from 0deg, ${PALETTE.NEON_A} 0deg 1.1deg, transparent 1.1deg 4.2deg, ${PALETTE.OUTLINE_IN} 4.2deg 5deg, transparent 5deg 9.5deg, #ffffff 9.5deg 10.4deg, transparent 10.4deg 15deg)`,
          WebkitMaskImage: fade,
          maskImage: fade,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- サンバースト（bg.sunburst-rotate）を薄く。Aメロの「後ろが生きてる」担当 ----
export const SunburstHalo: React.FC<{ sec: number; strength?: number }> = ({ sec, strength = 1 }) => {
  if (strength <= 0.01) return null;
  const rot = sec * 4.5;
  const pulse = 1 + Math.sin(sec * 0.5) * 0.05;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.13 * strength,
        mixBlendMode: 'screen',
        // 中央（顔）だけマスクで抜いて被写体を汚さない
        WebkitMaskImage: 'radial-gradient(circle at 50% 44%, transparent 0%, transparent 17%, #000 48%)',
        maskImage: 'radial-gradient(circle at 50% 44%, transparent 0%, transparent 17%, #000 48%)',
      }}
    >
      <AbsoluteFill
        style={{
          transform: `rotate(${rot}deg) scale(${pulse * 1.7})`,
          background: `repeating-conic-gradient(#ffffff 0deg 11.25deg, transparent 11.25deg 22.5deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- ガバ用の暴力（fx.strobe + fx.chromatic-shake + fx.flash）。breakdown 専用 ----
export const GabberFx: React.FC<{ sec: number; bpm: number; strength?: number }> = ({ sec, bpm, strength = 1 }) => {
  if (strength <= 0.01) return null;
  const beatIndex = Math.floor((sec * bpm) / 60);
  const bEnv = beatEnv(sec, bpm, 9);
  const flashCol = beatIndex % 4 === 0 ? '#ffffff' : beatIndex % 2 === 0 ? PALETTE.GLOW : PALETTE.NEON_A;
  // 4つ打ちの裏でだけ走査帯を走らせる（毎拍やると読めない）
  const scan = beatIndex % 2 === 1;
  const scanY = ((sec * bpm) / 60 % 1) * 120 - 10;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ backgroundColor: flashCol, opacity: bEnv * 0.2 * strength }} />
      {scan && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${scanY}%`,
            height: '14%',
            background: `linear-gradient(180deg, transparent, ${PALETTE.NEON_B}55, transparent)`,
            mixBlendMode: 'screen',
            opacity: 0.7 * strength,
          }}
        />
      )}
      {/* 色収差: 赤/シアンを拍で左右にずらす */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, #ff004455 0%, transparent 22%, transparent 78%, #00e5ff55 100%)`,
          mixBlendMode: 'screen',
          opacity: bEnv * 0.5 * strength,
          transform: `translateX(${(seeded(beatIndex * 4.1) - 0.5) * 26}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ---- 波紋（fx.ripple）。アウトロの余韻 ----
export const RippleRings: React.FC<{ sec: number; bpm: number; strength?: number }> = ({ sec, bpm, strength = 1 }) => {
  if (strength <= 0.01) return null;
  const period = barSec(bpm) * 2;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {[0, 1, 2].map((i) => {
        const p = (((sec / period) + i / 3) % 1 + 1) % 1;
        const e = 1 - Math.pow(1 - p, 3);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '46%',
              width: 260,
              height: 260,
              borderRadius: '50%',
              border: `${6 - i}px solid ${i % 2 === 0 ? '#ffffff' : PALETTE.GLOW}`,
              transform: `translate(-50%,-50%) scale(${0.2 + e * 5.4})`,
              opacity: (1 - e) * 0.45 * strength,
              boxShadow: `0 0 40px ${PALETTE.GLOW}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---- 紙吹雪（fx.confetti）をキャンディ色で。ラスサビ後半とアウトロの「祝祭」 ----
export const ConfettiLayer: React.FC<{ sec: number; strength?: number; scale?: number }> = ({
  sec,
  strength = 1,
  scale = 1,
}) => {
  if (strength <= 0.01) return null;
  const n = 30;
  const period = 6.5;
  const PALS = [PALETTE.HEART, PALETTE.STAR, PALETTE.PLUS, '#ffffff', PALETTE.NEON_A];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: n }).map((_, i) => {
        const phase = seeded(i * 17.3) * period;
        const p = ((sec + phase) % period) / period;
        const x = seeded(i * 5.9) * 100 + Math.sin(p * 6.28 + seeded(i * 2.1) * 10) * 5;
        const y = p * 118 - 9;
        const size = (8 + seeded(i * 4.4) * 12) * scale;
        const o = 0.85 * strength * Math.min(clamp01(p / 0.05), clamp01((1 - p) / 0.14));
        if (o <= 0.01) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size * (seeded(i * 6.6) > 0.5 ? 1 : 0.45),
              borderRadius: seeded(i * 3.3) > 0.5 ? '50%' : 2,
              backgroundColor: PALS[i % PALS.length],
              transform: `rotate(${p * 360 * (1 + seeded(i * 6.6) * 2)}deg)`,
              opacity: o,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * 区間名 → どのFXをどれだけ出すか。ここが「動きの設計図」。
 * 同じ強度を全編に敷くと結局単調になるので、区間ごとに主役のFXを1〜2個に絞る。
 */
export type FxMix = {
  ambient: number;
  sparkle: number;
  speedLines: number;
  sunburst: number;
  gabber: number;
  ripple: number;
  confetti: number;
};

const ZERO: FxMix = {
  ambient: 0, sparkle: 0, speedLines: 0,
  sunburst: 0, gabber: 0, ripple: 0, confetti: 0,
};

const MIX: Record<SectionName, Partial<FxMix>> = {
  intro:     { ambient: 0.8, sparkle: 0.9, sunburst: 0.5 },
  verse:     { ambient: 1.0, sparkle: 0.45, sunburst: 0.85 },
  prechorus: { ambient: 1.0, sparkle: 0.6, speedLines: 0.25 },
  build:     { ambient: 0.7, sparkle: 0.8, speedLines: 0.9 },
  chorus:    { ambient: 1.0, sparkle: 1.0, sunburst: 0.4 },
  post:      { ambient: 1.0, sparkle: 0.9, speedLines: 0.5, confetti: 0.5 },
  breakdown: { ambient: 0.5, gabber: 1.0, speedLines: 1.0 },
  bridge:    { ambient: 1.2, sparkle: 0.7, sunburst: 0.3, ripple: 0.5 },
  outro:     { ambient: 1.0, sparkle: 0.8, ripple: 1.0, confetti: 1.0, sunburst: 0.4 },
};

export const fxMixAt = (sec: number, section: Section | undefined, bpm: number): FxMix => {
  if (!section) return ZERO;
  const target = { ...ZERO, ...MIX[section.name] };
  // 区間の入り/出をクロスフェードして、FXが「パッと消える」のを避ける（0.9秒）
  const fade = Math.min(1, (sec - section.start) / 0.9, (section.end - sec) / 0.9);
  const k = clamp01(fade);
  // ビルドは終盤へ向けて全部を煽る＝サビのバーストへ繋ぐ助走
  const ramp =
    section.name === 'build'
      ? 0.45 + 0.55 * clamp01((sec - section.start) / Math.max(0.001, section.end - section.start))
      : 1;
  const out = { ...target };
  (Object.keys(out) as (keyof FxMix)[]).forEach((key) => {
    out[key] = out[key] * k * ramp;
  });
  void barEnv(sec, bpm); // 将来の拍連動用（現状はFX側で個別に取っている）
  return out;
};

/** 区間FXの一括描画。背景の上／歌詞の下に敷くもの（=ambient/sunburst/集中線）はこちら。 */
export const BackFx: React.FC<{ sec: number; bpm: number; mix: FxMix; scale?: number }> = ({ sec, bpm, mix, scale = 1 }) => (
  <>
    <SunburstHalo sec={sec} strength={mix.sunburst} />
    <AmbientDeco sec={sec} scale={scale} strength={mix.ambient} />
    <SpeedLines sec={sec} bpm={bpm} strength={mix.speedLines} />
  </>
);

/** 歌詞より前に出すもの（=キラキラ/ガバ/波紋/紙吹雪）。 */
export const FrontFx: React.FC<{ sec: number; frame: number; bpm: number; mix: FxMix; scale?: number }> = ({
  sec,
  frame,
  bpm,
  mix,
  scale = 1,
}) => (
  <>
    <SparkleLayer frame={frame} strength={mix.sparkle} scale={scale} />
    <RippleRings sec={sec} bpm={bpm} strength={mix.ripple} />
    <ConfettiLayer sec={sec} strength={mix.confetti} scale={scale} />
    <GabberFx sec={sec} bpm={bpm} strength={mix.gabber} />
  </>
);
