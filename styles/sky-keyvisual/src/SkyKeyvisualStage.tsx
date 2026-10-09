import React, { useMemo } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Field, PAL } from './Field';
import { Character } from './Character';
import { Typo } from './Typo';
import { Credits, CreditCard } from './Credits';
import project from '../input/project.json';
import type { LyricData, RuntimeLyric, Section } from './types';

/** ===== 3層を束ねるステージ =====
 *  ①面(Field) → ②キャラ(Character) → タイポ → クレジット/エンドカード
 *
 *  打点は白フラッシュを使わない（地が高明度でコントラスト差が出ず、ただのチラつきになる）。
 *  代わりに 位置のズレ（registration slam）＋ zoom-punch ＋ shake ＋ 極短の色ズレ で取る。
 *  打点は drop/サビ限定（meta.hits に列挙）。Verse には撒かない＝落差が死ぬ。
 */

const findSection = (secs: Section[], t: number): Section =>
  secs.find((s) => t >= s.start && t < s.end) ?? secs[secs.length - 1];

export const SkyKeyvisualStage: React.FC<{ data: LyricData; short?: boolean }> = ({ data, short }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = frame / fps + (data.meta.timingOffsetSec ?? 0);
  const sec = findSection(data.meta.sections, t);
  const onDark = sec.field === 'dim';

  // セクション内進行 0..1
  const p = interpolate(t, [sec.start, sec.end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // --- 段階消灯（Breakdown で天井の灯を1つずつ落とす）---
  const lit = sec.field === 'dim' ? interpolate(p, [0, 0.8], [1, 0.05], { extrapolateRight: 'clamp' })
            : sec.field === 'white' ? 0.2 : 1;
  // --- 窓の夕焼けの強さ（終盤ほどオレンジが流れ込む）---
  const dur = data.meta.duration;
  const warm = interpolate(t, [0, dur * 0.62, dur * 0.74, dur], [0.15, 0.35, 0.85, 1], { extrapolateRight: 'clamp' });

  // --- 打点（hits）---
  const hits = data.meta.hits ?? [];
  const nearest = hits.reduce((a, h) => (Math.abs(h - t) < Math.abs(a - t) ? h : a), -999);
  const dt = t - nearest;
  const punch = dt >= 0 && dt < 0.16 ? interpolate(dt, [0, 0.16], [1, 0]) : 0;
  const beatGear = sec.gear === 'beat';

  // --- カメラ 3段ギア ---
  // drift = ゆっくり漂う / build = 加速 push-in / beat = 拍で打つ
  const driftX = Math.sin(t * 0.31) * 10;
  const driftY = Math.cos(t * 0.24) * 8;
  const gearZoom =
    sec.gear === 'build' ? interpolate(p, [0, 1], [1.0, 1.09])
    : sec.gear === 'beat' ? 1.0 + punch * 0.055
    : interpolate(p, [0, 1], [1.02, 1.0]);
  const shake = beatGear ? punch * 9 : 0;
  const shX = shake * Math.sin(frame * 2.7);
  const shY = shake * Math.cos(frame * 3.1);

  const camScale = (sec.zoom ?? 1) * gearZoom;
  const camTx = driftX + shX;
  const camTy = driftY + shY + (sec.camY ?? 0) * -34;

  // --- 表示中の歌詞 ---
  const runtime: RuntimeLyric[] = useMemo(
    () =>
      data.lyrics.map((l) => ({
        ...l,
        startFrame: Math.round(l.t * fps),
        endFrame: Math.round((l.t + (l.hold ?? 2.4)) * fps),
      })),
    [data.lyrics, fps]
  );
  const active = runtime.filter((l) => frame >= l.startFrame && frame <= l.endFrame);

  // --- クレジット（input/project.json の credits を creditsFrom から1枚ずつ） ---
  const cards: CreditCard[] =
    data.meta.creditsFrom === undefined
      ? []
      : (project.credits as string[]).map((text, i) => {
          const step = data.meta.creditsStep ?? 3.0;
          const from = data.meta.creditsFrom! + i * step;
          return { text, from, to: from + step - 0.3 };
        });

  // --- エンドカード ---
  const ec = data.meta.endcard;
  const ecOn = ec && t >= ec.start;
  const ecAlpha = ec ? interpolate(t, [ec.start, ec.start + 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', overflow: 'hidden' }}>
      {/* カメラ変形の内側に全部入れる（歌詞を外に置くと固定オーバーレイ＝字幕になる） */}
      <AbsoluteFill
        style={{
          transform: `translate(${camTx}px, ${camTy}px) scale(${camScale})`,
          transformOrigin: '50% 55%',
          filter: punch > 0.5 && beatGear ? `saturate(${1 + punch * 0.5})` : undefined,
        }}
      >
        <Field kind={sec.field} t={t} p={p} lit={lit} warm={warm} drift={sec.still ? 1.6 : 0.7} tight={sec.framing === "bust" || sec.framing === "feet"} />

        {/* 打点で被写体だけ数px ズラす＝registration slam（白フラッシュの代わり） */}
        <AbsoluteFill style={{ transform: `translate(${punch * 7}px, ${punch * -5}px)` }}>
          <Character
            clip={sec.clip}
            clips={sec.clips}
            switchBars={sec.switchBars}
            still={sec.still}
            clipDuration={data.meta.clipDuration}
            bpm={data.meta.bpm}
            silhouette={sec.silhouette}
            adjust={data.meta.clipAdjust?.[sec.clip]}
            localSec={t - sec.start}
            framing={sec.framing}
            progress={p}
            short={short}
          />
        </AbsoluteFill>

        {active.map((l, i) => (
          <Typo key={`${l.t}-${i}`} line={l} onDark={onDark} short={short} />
        ))}
      </AbsoluteFill>

      {/* 打点の色ズレ（極短・サビ限定） */}
      {beatGear && punch > 0.25 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, rgba(255,0,80,${punch * 0.1}) 0%, rgba(0,180,255,${punch * 0.1}) 100%)`,
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {/* クレジット（高明度なのでスクリムは暗色側で効かせる） */}
      {cards.length > 0 && (
        <Credits
          cards={cards}
          sec={t}
          theme={{
            // 高明度スタイル＝黒スクリムは白地に帯が浮くだけなので使わない。
            // 濃いインク＋白ハローで分離する（カタログの高明度再着色表）。
            color: PAL.ink,
            subColor: '#5d6472',
            glow: 'drop-shadow(0 0 14px rgba(255,255,255,0.95))',
            subGlow: 'none',
            scrimRgb: null,
            fade: 0.35,
          }}
        />
      )}

      {/* エンドカード＝本編のハードカット後に一拍おいてフェード */}
      {ecOn && (
        <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: ecAlpha, justifyContent: 'center', alignItems: 'center' }}>
          <Img src={staticFile(ec!.src)} style={{ width: height * 0.62, height: height * 0.62, objectFit: 'contain', mixBlendMode: 'multiply' }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
