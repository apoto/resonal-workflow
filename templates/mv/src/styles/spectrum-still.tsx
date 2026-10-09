import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadKanit } from '@remotion/google-fonts/Kanit';
import { loadFont as loadReggae } from '@remotion/google-fonts/ReggaeOne';
import { loadFont as loadZenMaru } from '@remotion/google-fonts/ZenMaruGothic';
import { Line, Pattern, Style, DecoProps, OverlayProps } from '../engine/types';
import { beatEnv } from '../engine/beats';

// ============================================================
// スタイル: spectrum-still
//  七色放射(後ろ) / 吸い込みトンネル(前) / ビートブルーム / レイヴストロボ /
//  レンズフレア / EQバーHUD / 明るいグレード / ワードポップ字幕 / バーストドロップ /
//  白飛びslam / 停電cut。曲ごとの再着色は下の PZ を編集。
//  フォントは Google Fonts（OFL）を @remotion/google-fonts で読む。
// ============================================================

const PZ = {
  BG0: '#05010E', CYAN: '#3DE1FF', MAGENTA: '#FF54C8', VIOLET: '#A98BFF',
  GOLD: '#FFC24B', WHITE: '#F2FBFF', DIM: '#B9C4E8',
};

const KANIT = loadKanit('italic', { weights: ['800'], subsets: ['latin'] }).fontFamily;
const REGGAE = loadReggae('normal', { weights: ['400'], subsets: ['japanese', 'latin'], ignoreTooManyRequestsWarning: true }).fontFamily;
const ZMARU = loadZenMaru('normal', { weights: ['700', '900'], subsets: ['japanese', 'latin'], ignoreTooManyRequestsWarning: true }).fontFamily;

const rnd = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const ramp = (a: number, b: number, sec: number, edge = 0.5) => clamp01(Math.min((sec - a) / edge, (b - sec) / edge, 1));
// 行幅から計算した上限（line.maxSize）で頭打ち＝nowrap の字幕を画面外にはみ出させない
const fit = (line: Line, want: number) => Math.min(line.size ?? want, line.maxSize ?? Infinity);
const gradText = (grad: string): React.CSSProperties => ({ backgroundImage: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });

// ---------- デコ: 七色放射（被写体の後ろ・消失点=頭の後ろ）----------
const SceneRays: React.FC<DecoProps> = ({ light, vx = 48, vy = 24 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const energy = light.rainbow;
  if (energy <= 0) return null;
  const e = energy * (0.6 + 0.4 * beatEnv(frame / fps, 7));
  const R = Math.hypot(width, height), len = R * 1.3;
  const count = Math.round(24 + energy * 30);
  const rays = Array.from({ length: count }, (_, i) => {
    const rot = (i / count) * 360 + frame * (0.5 + (i % 3) * 0.15) * (i % 2 ? 1 : -1);
    const hue = ((i / count) * 360 + frame * 2) % 360;
    const w = (3 + rnd(i + 3) * 7) * (0.7 + energy);
    const op = (0.18 + rnd(i + 1) * 0.28) * e;
    return <div key={i} style={{ position: 'absolute', left: 0, top: -w / 2, width: len, height: w, transformOrigin: '0% 50%', transform: `rotate(${rot}deg)`, background: `linear-gradient(90deg, hsl(${hue} 100% 60% / 0) 0%, hsl(${hue} 100% 60%) 50%, hsl(${hue} 100% 60% / 0) 100%)`, opacity: op, mixBlendMode: 'screen' }} />;
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${vx}%`, top: `${vy}%` }}>{rays}</div>
      <AbsoluteFill style={{ background: `radial-gradient(24% 24% at ${vx}% ${vy}%, hsl(0 0% 100% / ${0.14 * e}) 0%, transparent 64%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
};

// ---------- デコ: 吸い込み光トンネル（被写体の前・消失点=中心）----------
// 「光の中を突き抜ける」= 中心から外へ走る太い発光ビーム ＋ 厚く発光するリング（外ほど大きく厚く明るい＝近い）＋ 中心コア発光。
const SceneTunnel: React.FC<DecoProps> = ({ light, vx = 50, vy = 50 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = light.tunnelP;
  if (p <= 0) return null;
  const R = Math.hypot(width, height);
  const hueOf = (x: number) => (x * 220 + frame * 2.5) % 360; // シアン〜バイオレット〜マゼンタ寄り

  // 中心から外へ走る太い光ビーム（加速して湧く・発光）
  const beams = Array.from({ length: 22 }, (_, i) => {
    const ang = (i / 22) * 360 + frame * 0.4 * (i % 2 ? 1 : -1);
    const w = (10 + rnd(i) * 26) * (0.5 + p);           // 太い
    const col = i % 3 === 0 ? '#F2FBFF' : `hsl(${hueOf(i / 22)} 100% 72%)`;
    const op = (0.14 + rnd(i + 1) * 0.22) * p;
    return (
      <div key={'b' + i} style={{ position: 'absolute', left: 0, top: -w / 2, width: R * 1.25, height: w, transformOrigin: '0% 50%', transform: `rotate(${ang}deg)`, background: `linear-gradient(90deg, ${col} 0%, ${col}00 82%)`, opacity: op, mixBlendMode: 'screen', filter: `blur(${2 + p * 3}px)` }} />
    );
  });

  // 厚く発光するリング（外＝近い ほど 大きく厚く明るく）
  const rings = Array.from({ length: 10 }, (_, i) => {
    const t = ((frame * (6 + p * 26) + i * (R / 10)) % R) / R; // 0(中心/遠)→1(外/近)
    const d = R * (0.04 + t * 1.55);
    const thick = (5 + t * 46) * (0.5 + p);                    // 外ほど厚い＝厚み
    const light2 = 62 + t * 26;                                 // 外ほど明るい
    const col = `hsl(${hueOf(t)} 100% ${light2}%)`;
    const op = (0.12 + t * 0.6) * p;
    return (
      <div key={'r' + i} style={{ position: 'absolute', left: 0, top: 0, width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, borderRadius: '50%', border: `${thick}px solid ${col}`, boxShadow: `0 0 ${thick * 1.4}px ${col}, inset 0 0 ${thick}px ${col}`, opacity: op, mixBlendMode: 'screen', filter: `blur(${1 + t * 4}px)` }} />
    );
  });

  // 中心コア発光（脈動＋白飛びへ橋渡し）
  const core = 0.35 + 0.65 * Math.pow(p, 1.3);
  const white = Math.pow(p, 1.4) * 0.9;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: `${vx}%`, top: `${vy}%` }}>{beams}</div>
      <div style={{ position: 'absolute', left: `${vx}%`, top: `${vy}%` }}>{rings}</div>
      <AbsoluteFill style={{ background: `radial-gradient(${18 + p * 8}% ${18 + p * 8}% at ${vx}% ${vy}%, #F2FBFF ${20 * core}%, ${PZ.CYAN}00 70%)`, opacity: core * p, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: `radial-gradient(${34 - p * 16}% ${34 - p * 16}% at ${vx}% ${vy}%, hsl(0 0% 100% / ${white}) 0%, transparent 72%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
};

// ---------- グローバルFX（最前面・色付き）----------
const BreatheGlow: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps; const w = ramp(from, to, sec, 1.2);
  if (w <= 0) return null;
  const b = 0.5 + 0.5 * Math.sin(sec * 1.15);
  return <AbsoluteFill style={{ background: `radial-gradient(${46 + 26 * b}% ${46 + 26 * b}% at 50% 44%, ${PZ.WHITE} 0%, ${PZ.CYAN}55 40%, transparent 72%)`, opacity: (0.05 + 0.11 * b) * w, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};
const Bloom: React.FC<{ from: number; to: number; base?: number; amp?: number; offset?: number }> = ({ from, to, base = 0.04, amp = 0.16, offset = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps + offset; const w = ramp(from, to, sec, 0.6);
  if (w <= 0) return null;
  const e = base + beatEnv(sec, 8) * amp;
  return <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 40%, ${PZ.WHITE} 0%, ${PZ.GOLD}00 60%)`, opacity: e * w * 0.9, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};
const Strobe: React.FC<{ from: number; to: number; offset?: number }> = ({ from, to, offset = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps + offset; const w = ramp(from, to, sec, 0.4);
  if (w <= 0) return null;
  const tick = Math.floor(frame / 4);
  if (rnd(tick + 0.5) <= 0.42) return null;
  const col = [PZ.CYAN, PZ.MAGENTA, PZ.WHITE, PZ.GOLD][tick % 4];
  return <AbsoluteFill style={{ background: col, opacity: (0.10 + rnd(tick) * 0.14) * w, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};
const LensSweep: React.FC<{ hits: number[]; offset?: number }> = ({ hits, offset = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const sec = frame / fps + offset; let p = -1; const dur = 0.6;
  for (const h of hits) if (sec >= h && sec < h + dur) p = (sec - h) / dur;
  if (p < 0) return null;
  const x = interpolate(p, [0, 1], [-20, 120]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: '26%', transform: 'skewX(-16deg)', background: `linear-gradient(90deg, transparent, ${PZ.WHITE}cc, ${PZ.CYAN}55, transparent)`, opacity: Math.sin(p * Math.PI) * 0.8, mixBlendMode: 'screen', filter: 'blur(6px)' }} />
    </AbsoluteFill>
  );
};
const Overlay: React.FC<OverlayProps> = ({ fx, offset = 0 }) => (
  <>
    {(fx.breathes ?? []).map((b, i) => <BreatheGlow key={'br' + i} from={b.from} to={b.to} />)}
    {(fx.blooms ?? []).map((b, i) => <Bloom key={'bl' + i} from={b.from} to={b.to} base={b.base} amp={b.amp} offset={offset} />)}
    {(fx.strobes ?? []).map((s, i) => <Strobe key={'st' + i} from={s.from} to={s.to} offset={offset} />)}
    {fx.lensHits && fx.lensHits.length > 0 && <LensSweep hits={fx.lensHits} offset={offset} />}
  </>
);

// ---------- グレード / HUD ----------
const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  const jitter = rnd(Math.floor(frame / 3)) * 1.2;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: `radial-gradient(150% 120% at 50% 30%, ${PZ.CYAN}10 0%, transparent 45%)`, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: `radial-gradient(150% 150% at 50% 46%, transparent 66%, ${PZ.BG0}55 100%)` }} />
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(0deg, #00000000 0px, #00000000 3px, #00000022 4px, #00000000 5px)`, transform: `translateY(${jitter}px)`, opacity: 0.12 }} />
    </AbsoluteFill>
  );
};
const Hud: React.FC<{ scale?: number; hideDuring?: [number, number][] }> = ({ scale = 1, hideDuring = [] }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const sec = frame / fps;
  for (const [a, b] of hideDuring) if (sec >= a && sec < b) return null; // 停電中は消す
  const env = beatEnv(sec, 6);
  const N = 40, bw = width / N;
  const bars = Array.from({ length: N }, (_, i) => {
    const f1 = Math.sin(frame * 0.10 + i * 0.7) * 0.5 + 0.5;
    const f2 = Math.sin(frame * 0.23 + i * 1.9) * 0.5 + 0.5;
    const h = Math.min(0.95, 0.2 + 0.4 * (f1 * 0.6 + f2 * 0.4) + 0.45 * env * (0.5 + rnd(i) * 0.5)) * height * 0.2 * scale;
    const hue = ((i / N) * 320 + frame * 2.2) % 360;
    const col = `hsl(${hue} 100% 60%)`;
    return <div key={i} style={{ position: 'absolute', bottom: 0, left: i * bw, width: bw - 2, height: h, background: `linear-gradient(180deg, ${col} 0%, hsl(${hue} 100% 60% / 0.12) 100%)`, opacity: 0.75, mixBlendMode: 'screen', boxShadow: `0 0 12px hsl(${hue} 100% 60% / 0.6)` }} />;
  });
  const total = String(durationInFrames).padStart(5, '0'), fcount = String(frame).padStart(5, '0');
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill>{bars}</AbsoluteFill>
      <div style={{ position: 'absolute', top: 30 * scale, left: 40 * scale, fontFamily: KANIT, fontSize: 22 * scale, letterSpacing: 1, color: PZ.CYAN, opacity: 0.7, textShadow: `0 0 8px ${PZ.CYAN}88` }}>{`ALT +${(12000 + Math.floor(rnd(frame) * 400))}m`}</div>
      <div style={{ position: 'absolute', top: 30 * scale, right: 40 * scale, fontFamily: KANIT, fontSize: 22 * scale, letterSpacing: 1, color: PZ.MAGENTA, opacity: 0.7, textShadow: `0 0 8px ${PZ.MAGENTA}88`, textAlign: 'right' }}>{`SPD ${(300 + Math.floor(rnd(frame + 7) * 40))}  ${fcount}/${total}`}</div>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 58%, ${PZ.BG0}77 82%, ${PZ.BG0}cc 100%)` }} />
    </AbsoluteFill>
  );
};

// ---------- 字幕 ----------
const WordPop: React.FC<{ text: string; local: number; font: string; weight: number; size: number; color: string; glow: string; stagger?: number; ls?: number }> = ({ text, local, font, weight, size, color, glow, stagger = 5, ls = 0 }) => {
  const words = text.split(/(\s+)/); let wi = -1;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'nowrap', whiteSpace: 'pre', fontFamily: font, fontWeight: weight, fontSize: size, letterSpacing: ls }}>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return <span key={i} style={{ whiteSpace: 'pre' }}>{w}</span>;
        wi++;
        const e = smooth(clamp01((local - wi * stagger) / 9));
        return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: e, transform: `translateY(${(1 - e) * 26}px)`, filter: e < 1 ? `blur(${(1 - e) * 5}px)` : 'none', color, textShadow: glow }}>{w}</span>;
      })}
    </span>
  );
};

const Phrase: React.FC<{ line: Line; idx: number; scale?: number }> = ({ line, idx, scale = 1 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const start = line.t * fps, end = (line.t + line.hold) * fps;
  if (line.pattern === 'cut') {
    if (frame < start || frame > end) return null;
    const size = fit(line, 120) * scale, y = line.y ?? 50;
    return <AbsoluteFill><div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: 'translate(-50%,-50%)', fontFamily: ZMARU, fontWeight: 900, fontSize: size, color: PZ.WHITE, letterSpacing: 2 * scale, textShadow: `0 0 20px ${PZ.CYAN}, 0 2px 12px #000`, whiteSpace: 'nowrap' }}>{line.text}</div></AbsoluteFill>;
  }
  const pre = 10;
  if (frame < start - pre || frame > end + 6) return null;
  const local = frame - start;
  const fadeIn = interpolate(frame, [start - pre, start + 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [end - 5, end + 4], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const alpha = Math.min(fadeIn, fadeOut);
  const P: Pattern = line.pattern;
  const ascii = /^[\x00-\x7F\s]*$/.test(line.text);

  if (P === 'title') {
    const size = fit(line, 210) * scale, y = line.y ?? 46;
    const s = interpolate(spring({ frame: local, fps, config: { damping: 200, mass: 0.7 } }), [0, 1], [1.18, 1]);
    const swipe = smooth(clamp01(local / 14));
    return (
      <AbsoluteFill style={{ opacity: alpha }}>
        <SceneRays light={{ rainbow: 0.5 * alpha, tunnelP: 0 }} vx={50} vy={y} />
        <div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: `translate(-50%,-50%) scale(${s})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: KANIT, fontWeight: 800, fontStyle: 'italic', fontSize: size, letterSpacing: -1, ...gradText(`linear-gradient(180deg, ${PZ.WHITE} 0%, ${PZ.CYAN} 62%, ${PZ.VIOLET} 100%)`), filter: `drop-shadow(0 0 ${size * 0.06}px ${PZ.CYAN}) drop-shadow(0 4px 18px #05010Ecc)` }}>{line.text}</div>
          <div style={{ width: `${swipe * 100}%`, height: 6 * scale, marginTop: 6 * scale, background: `linear-gradient(90deg, ${PZ.CYAN}, ${PZ.MAGENTA}, ${PZ.GOLD})`, boxShadow: `0 0 14px ${PZ.CYAN}`, borderRadius: 3 }} />
          {line.sub && <div style={{ fontFamily: ZMARU, fontWeight: 900, fontSize: 30 * scale, letterSpacing: 14 * scale, color: PZ.WHITE, opacity: 0.85, marginTop: 12 * scale }}>{line.sub}</div>}
        </div>
      </AbsoluteFill>
    );
  }
  if (P === 'slam') {
    const size = fit(line, 360) * scale;
    const s = interpolate(spring({ frame: local, fps, config: { damping: 140, mass: 0.6 } }), [0, 1], [1.5, 1]);
    return <AbsoluteFill style={{ opacity: alpha, alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: KANIT, fontWeight: 800, fontStyle: 'italic', fontSize: size, letterSpacing: -4, transform: `rotate(-3deg) scale(${s})`, whiteSpace: 'nowrap', backgroundImage: `linear-gradient(180deg, #1A0B3A 0%, ${PZ.VIOLET} 55%, ${PZ.MAGENTA} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextStroke: `${Math.max(3, size * 0.02)}px #0A0330`, paintOrder: 'stroke fill', filter: `drop-shadow(0 0 ${size * 0.05}px ${PZ.CYAN}) drop-shadow(0 8px 26px #05010E66)` }}>{line.text}</div></AbsoluteFill>;
  }
  if (P === 'drop') {
    const size = fit(line, (ascii ? 200 : 138)) * scale;
    const rot = (idx % 2 ? 1 : -1) * (ascii ? 2 : 3), yBase = line.y ?? (ascii ? 42 : 56), xoff = (idx % 3) - 1;
    const s = interpolate(spring({ frame: local, fps, config: { damping: 180, mass: 0.5 } }), [0, 1], [1.32, 1]);
    const grad = ascii ? `linear-gradient(180deg, ${PZ.WHITE} 0%, ${PZ.CYAN} 60%, ${PZ.VIOLET} 100%)` : `linear-gradient(180deg, ${PZ.WHITE} 0%, ${PZ.GOLD} 55%, ${PZ.MAGENTA} 100%)`;
    return (
      <AbsoluteFill style={{ opacity: alpha }}>
        <SceneRays light={{ rainbow: 0.75 * alpha, tunnelP: 0 }} vx={50 + xoff * 8} vy={yBase} />
        <div style={{ position: 'absolute', left: `${50 + xoff * 8}%`, top: `${yBase}%`, transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${s})`, fontFamily: ascii ? KANIT : REGGAE, fontWeight: ascii ? 800 : 400, fontStyle: ascii ? 'italic' : 'normal', fontSize: size, whiteSpace: 'nowrap', ...gradText(grad), filter: `drop-shadow(0 0 ${size * 0.05}px ${ascii ? PZ.CYAN : PZ.GOLD}) drop-shadow(0 5px 20px #05010Edd)`, WebkitTextStroke: `${Math.max(2, size * 0.012)}px #0A0330` }}>{line.text}</div>
      </AbsoluteFill>
    );
  }
  if (P === 'hud') {
    const size = fit(line, 150) * scale;
    const fly = smooth(clamp01(local / 7)), side = idx % 2 ? 1 : -1;
    const x = interpolate(fly, [0, 1], [side * 40, 0]), y = line.y ?? (idx % 2 ? 30 : 66), txt = line.text.toUpperCase();
    return (
      <AbsoluteFill style={{ opacity: alpha }}>
        <div style={{ position: 'absolute', left: `${50 + x}%`, top: `${y}%`, transform: 'translate(-50%,-50%) skewX(-8deg)', fontFamily: KANIT, fontWeight: 800, fontStyle: 'italic', fontSize: size, whiteSpace: 'nowrap' }}>
          {[0.14, 0.28, 0.42].map((t, k) => <span key={k} style={{ position: 'absolute', inset: 0, color: k % 2 ? PZ.MAGENTA : PZ.CYAN, opacity: (1 - fly) * (0.5 - k * 0.12), transform: `translateX(${-side * (k + 1) * 22 * (1 - fly)}px)`, mixBlendMode: 'screen' }}>{txt}</span>)}
          <span style={{ position: 'relative', ...gradText(`linear-gradient(180deg, ${PZ.WHITE}, ${PZ.CYAN})`), filter: `drop-shadow(0 0 ${size * 0.05}px ${PZ.CYAN}) drop-shadow(0 3px 12px #05010E)`, WebkitTextStroke: `2px #0A0330` }}>{txt}</span>
        </div>
      </AbsoluteFill>
    );
  }
  if (P === 'whisper') {
    const size = fit(line, 120) * scale;
    const y = (line.y ?? 44) + interpolate(local, [0, end - start], [8, -18], { extrapolateRight: 'clamp' }) * 0.1;
    return <AbsoluteFill style={{ opacity: alpha * 0.9 }}><div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: 'translate(-50%,-50%)', fontFamily: KANIT, fontWeight: 800, fontStyle: 'italic', fontSize: size, letterSpacing: 6 * scale, ...gradText(`linear-gradient(180deg, ${PZ.WHITE}, ${PZ.CYAN})`), filter: `drop-shadow(0 0 ${size * 0.08}px ${PZ.CYAN})`, whiteSpace: 'nowrap' }}>{line.text}</div></AbsoluteFill>;
  }
  if (P === 'break') {
    const size = fit(line, 78) * scale, y = line.y ?? 48;
    return <AbsoluteFill style={{ opacity: alpha }}><div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: 'translate(-50%,-50%)', textAlign: 'center' }}><WordPop text={line.text} local={local} font={ZMARU} weight={900} size={size} color={PZ.WHITE} glow={`0 0 16px ${PZ.VIOLET}aa, 0 3px 16px #05010E`} stagger={5} ls={1 * scale} /></div></AbsoluteFill>;
  }
  if (P === 'end') {
    const size = fit(line, 60) * scale, y = line.y ?? 50;
    const slowIn = interpolate(frame, [start - pre, start + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return <AbsoluteFill style={{ opacity: Math.min(slowIn, fadeOut) }}><div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: 'translate(-50%,-50%)', textAlign: 'center' }}><WordPop text={line.text} local={local} font={ZMARU} weight={700} size={size} color={PZ.DIM} glow={`0 0 12px ${PZ.VIOLET}66`} stagger={6} ls={5 * scale} /></div></AbsoluteFill>;
  }
  // verse（既定）
  const size = fit(line, 66) * scale, y = line.y ?? 76;
  const swipe = smooth(clamp01((local - 2) / 12));
  return (
    <AbsoluteFill style={{ opacity: alpha }}>
      <div style={{ position: 'absolute', left: '50%', top: `${y}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 * scale, whiteSpace: 'nowrap' }}>
        <WordPop text={line.text} local={local} font={ZMARU} weight={700} size={size} color={PZ.WHITE} glow={`0 0 8px ${PZ.CYAN}66, 0 2px 12px #05010E`} stagger={4} ls={1 * scale} />
        <div style={{ width: `${swipe * 66}%`, height: 3 * scale, background: `linear-gradient(90deg, ${PZ.CYAN}00, ${PZ.CYAN}, ${PZ.MAGENTA}00)`, opacity: 0.75, boxShadow: `0 0 8px ${PZ.CYAN}66` }} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- サムネのタイトル ----------
const ThumbTitle: React.FC<{ title: string; sub: string }> = ({ title, sub }) => (
  <div style={{ position: 'absolute', left: '50%', bottom: 96, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ fontFamily: KANIT, fontWeight: 800, fontStyle: 'italic', fontSize: 230, letterSpacing: -2, ...gradText(`linear-gradient(180deg, ${PZ.WHITE} 0%, ${PZ.CYAN} 60%, ${PZ.VIOLET} 100%)`), WebkitTextStroke: '3px #0A0330', filter: `drop-shadow(0 0 26px ${PZ.CYAN}) drop-shadow(0 6px 22px #05010Ecc)`, whiteSpace: 'nowrap' }}>{title}</div>
    <div style={{ width: 360, height: 8, marginTop: 8, background: `linear-gradient(90deg, ${PZ.CYAN}, ${PZ.MAGENTA}, ${PZ.GOLD})`, boxShadow: `0 0 18px ${PZ.CYAN}`, borderRadius: 4 }} />
    <div style={{ fontFamily: ZMARU, fontWeight: 900, fontSize: 34, letterSpacing: 16, color: PZ.WHITE, opacity: 0.9, marginTop: 18 }}>{sub}</div>
  </div>
);

export const spectrumStill: Style = {
  name: 'spectrum-still',
  Phrase, Grade, Hud,
  DecoBehind: SceneRays,
  DecoFront: SceneTunnel,
  Overlay, ThumbTitle,
};
