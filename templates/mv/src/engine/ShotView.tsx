import React from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene, Shot, Style } from './types';
import { beatPunch, dropPunch, beatEnv } from './beats';

// カメラ機構（engine・共通）。ショット1つを「切り抜き前景 × 背景 × スタイルのデコ」で描く。
//  ・kf 焦点(px,py%)/scale を smoothstep 補間
//  ・intensity=ビートのズームパンチ / shake=ロール(傾き)インパルス / tilt=固定ディーゴ角 / bounce=縦ズンズン
//  ・見切れ防止クランプ（回転/バウンス込みで黒帯を出さない）
const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type KF = { t: number; px: number; py: number; s: number };
const interpKF = (kf: KF[], sec: number) => {
  if (sec <= kf[0].t) return kf[0];
  if (sec >= kf[kf.length - 1].t) return kf[kf.length - 1];
  for (let i = 0; i < kf.length - 1; i++) {
    if (sec >= kf[i].t && sec <= kf[i + 1].t) {
      const r = (sec - kf[i].t) / (kf[i + 1].t - kf[i].t);
      const e = r * r * (3 - 2 * r);
      return { t: sec, px: kf[i].px + (kf[i + 1].px - kf[i].px) * e, py: kf[i].py + (kf[i + 1].py - kf[i].py) * e, s: kf[i].s + (kf[i + 1].s - kf[i].s) * e };
    }
  }
  return kf[kf.length - 1];
};

export type ShotCtx = {
  style: Style;
  lightAt: (sec: number) => { rainbow: number; tunnelP: number };
  dropHits: number[];
  bg: string; fg: string;               // 16:9 用素材ファイル名
  bgV: string; fgV: string;             // 9:16 用
  bgLoop?: { wide: number | null; vert: number | null }; // 背景ループ動画の尺（秒）。あれば bg_loop*.mp4 を静止画の代わりに使う
  scenes?: Scene[]; // 背景の画像を秒で切り替える（ループ動画が無いとき）
};

// 背景ループ動画。ショットごとの Sequence で頭に戻らないよう、曲の絶対秒で位相を合わせて回す
const BgLoop: React.FC<{ file: string; sec: number; absStart: number; style: React.CSSProperties }> = ({ file, sec, absStart, style }) => {
  const { fps } = useVideoConfig();
  const len = Math.max(1, Math.floor(sec * fps));
  const phase = Math.round(absStart * fps) % len;
  return (
    <Sequence from={-phase} layout="none">
      <Loop durationInFrames={len} layout="none">
        <OffthreadVideo src={staticFile(file)} muted style={style} />
      </Loop>
    </Sequence>
  );
};

// ショットのカメラ幾何（ShotView と 収束点投影 で共有）
export const shotGeom = (shot: Shot, localSec: number, absSec: number, frame: number, dropHits: number[], width: number, height: number) => {
  const f = interpKF(shot.kf, localSec);
  const inten = shot.intensity ?? 0;
  const punch = beatPunch(absSec) * inten + dropPunch(absSec, dropHits) * (inten > 0.02 ? 0.06 : 0.02);
  const s = f.s * (1 + punch);
  const active = (shot.shake ?? 0) > 0 || !!shot.sway;
  const roll = active ? Math.sin(absSec * 0.7 + f.px * 0.05) * 0.5 : 0;
  const tiltImp = (shot.shake ?? 0) * (0.5 + punch * 4);
  let rotDeg = (shot.tilt ?? 0) + roll + (rnd(Math.floor(frame / 2)) - 0.5) * tiltImp * 4;
  rotDeg = Math.max(-5, Math.min(5, rotDeg));
  const sCover = s * (1 + Math.min(0.14, Math.abs(rotDeg) * 0.028) + (active ? 0.03 : 0) + (shot.bounce ? 0.05 : 0));
  const wide = !!shot.useWide || !shot.vertical;
  const assetAspect = wide ? 16 / 9 : 9 / 16;
  const compAspect = width / height;
  const dw0 = assetAspect > compAspect ? height * assetAspect : width;
  const dh0 = assetAspect > compAspect ? height : width / assetAspect;
  const dw = dw0 * sCover, dh = dh0 * sCover;
  const roomX = Math.max(0, (dw - width) / 2), roomY = Math.max(0, (dh - height) / 2);
  const cl = (v: number, r: number) => Math.max(-r, Math.min(r, v));
  const bounceY = (shot.bounce ?? 0) * beatEnv(absSec, 13) * height * 0.045;
  const tx = cl(dw * (0.5 - f.px / 100), roomX);
  const ty = cl(dh * (0.5 - f.py / 100) + bounceY, roomY);
  return { f, sCover, rotDeg, wide, dw0, dh0, dw, dh, tx, ty };
};

// 画像内の点(fx,fy 0-1)がスクリーン上どこに来るか（%）。トンネル収束点を目に固定するのに使う。
export const projectPct = (g: ReturnType<typeof shotGeom>, fx: number, fy: number, width: number, height: number) => ({
  vx: ((width / 2 + g.dw * (fx - 0.5) + g.tx) / width) * 100,
  vy: ((height / 2 + g.dh * (fy - 0.5) + g.ty) / height) * 100,
});

export const ShotView: React.FC<{ shot: Shot; absStart: number; ctx: ShotCtx }> = ({ shot, absStart, ctx }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const localSec = frame / fps;
  const absSec = absStart + localSec;
  const g = shotGeom(shot, localSec, absSec, frame, ctx.dropHits, width, height);
  const { f, sCover, rotDeg, wide, dw0, dh0, tx, ty } = g;
  const scene = [...(ctx.scenes ?? [])].reverse().find((s) => absSec >= s.from);
  const bgFile = scene ? (wide ? scene.wide : scene.vert) : wide ? ctx.bg : ctx.bgV;
  const fgFile = wide ? ctx.fg : ctx.fgV;
  const loopSec = ctx.bgLoop ? (wide ? ctx.bgLoop.wide : ctx.bgLoop.vert) : null;
  const cx = width / 2, cy = height / 2;
  const imgStyle: React.CSSProperties = { position: 'absolute', left: (width - dw0) / 2, top: (height - dh0) / 2, width: dw0, height: dh0, objectFit: 'cover' };
  const bright = 1 + (dropPunch(absSec, ctx.dropHits) > 0 ? beatEnv(absSec, 8) * 0.12 : 0);
  const fx = `${shot.fx ? shot.fx + ' ' : ''}brightness(${bright})`;
  const light = ctx.lightAt(absSec);
  const { DecoBehind } = ctx.style;
  const raysVx = shot.vertical ? 50 : 48;
  // 前トンネル(吸い込み)は画面中央固定にしたいので ShotView(=カメラ変換内)では描かない。
  // → LyricVideo/ShortVideo でスクリーン中央に描画（FrontTunnel）。
  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#05010E' }}>
      <AbsoluteFill style={{ transform: `translate(${tx}px,${ty}px) scale(${sCover}) rotate(${rotDeg}deg)`, transformOrigin: `${cx}px ${cy}px`, filter: fx }}>
        {loopSec
          ? <BgLoop file={wide ? 'bg_loop.mp4' : 'bg_loop_vertical.mp4'} sec={loopSec} absStart={absStart} style={{ ...imgStyle, filter: 'brightness(0.86) saturate(1.05)' }} />
          : <Img src={staticFile(bgFile)} style={{ ...imgStyle, filter: 'brightness(0.86) saturate(1.05)' }} />}
        <DecoBehind light={light} vx={raysVx} vy={24} />
        <Img src={staticFile(fgFile)} style={imgStyle} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ムード明暗（engine）: 指定窓で明るく、それ以外はわずかに沈める（明るい曲基調）。
export const MoodDark: React.FC<{ bright: [number, number, number?][] }> = ({ bright }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const ramp = (a: number, b: number, edge = 0.6) => clamp01(Math.min((sec - a) / edge, (b - sec) / edge, 1));
  let b = 0;
  for (const [from, to, w] of bright) b = Math.max(b, (w ?? 1) * ramp(from, to));
  return <AbsoluteFill style={{ background: '#05010E', opacity: 0.12 - 0.12 * b, pointerEvents: 'none' }} />;
};
