import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { DELA, JP_GOTHIC } from './fonts';
import { InvertShapesData, Phrase } from './types';
import { sampleEnergy } from './energy';

/**
 * shape-burst 歌詞レイヤ。
 * 核:
 *  1) 1文字ごとに下から「跳ねて」出現（back-out オーバーシュート）。高速ステッガー。
 *  2) 1文字＝1図形がはじける（□○△＋◇✕ が scale0→過剰→消散）。
 *  3) スピード感＝短hold・ハードカット（重なり無し）。
 *  4) Drop は特大＋色収差グリッチ。
 *  5) 低体温Verse(cold) は色収差を薄く常時。
 *  配色: このファイルの PAL（既定は高明度パステル × 濃いインク）。
 *  タイミングは秒(t/hold)ベース＝whisper由来の歌詞タイミングにそのまま乗る。
 *  scale は 9:16 ショート用のサイズ倍率（16:9本編は 1.0）。
 */

// ---- パレット（再着色はここ1箇所）----
// 既定は「高明度パステル背景 × 濃いインク」。甘い色 × 硬い書体の矛盾で見せる。
// 差し色の高彩度は MAGENTA 1色だけに絞る。暗背景版にするなら BG/INK/STROKE の極性を反転する。
export const PAL = {
  BG: '#fff2f7',      // ほぼ白のパステルピンク（高明度のベース）
  INK: '#2e0a24',     // 濃いベリーのインク＝ほぼ黒だが甘い側の色相を持つ（これが"凶器"）
  MAGENTA: '#ff2c9c', // 唯一の高彩度アクセント
  PINK: '#ff7ac2',    // 図形/装飾用の中彩度ピンク（白地で沈まない濃さ）
  MINT: '#3fd8c8',    // ミント（寒色の受け）
  CYAN: '#00c8dc',    // 色収差ゴーストの寒色側（白地で見える濃さ）
  STROKE: '#ffffff',  // 文字の**白い**縁取り＝賑やかなパステル背景から濃いインクを分離
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
function easeOutBack(t: number): number {
  const c1 = 2.4;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ---- 1文字ごとの図形バースト（形が文字ごとに変わる）----
const ShapeBurst: React.FC<{ kind: number; color: string; local: number; size: number }> = ({
  kind,
  color,
  local,
  size,
}) => {
  const dur = 16;
  if (local < 0 || local > dur) return null;
  const t = local / dur;
  const scale = local < 4 ? easeOutBack(clamp01(local / 4)) * 1.5 : 1.5 + (t - 0.25) * 0.8;
  const opacity = local < 3 ? local / 3 : clamp01(1 - (local - 3) / (dur - 3));
  const rot = local * 9;
  const s = size * 1.5;
  const half = s / 2;
  const sw = Math.max(4, size * 0.05);

  let shape: React.ReactNode = null;
  const common = { fill: 'none', stroke: color, strokeWidth: sw } as const;
  switch (kind % 6) {
    case 0:
      shape = <rect x={sw} y={sw} width={s - sw * 2} height={s - sw * 2} {...common} />;
      break;
    case 1:
      shape = <circle cx={half} cy={half} r={half - sw} {...common} />;
      break;
    case 2:
      shape = <polygon points={`${half},${sw} ${s - sw},${s - sw} ${sw},${s - sw}`} {...common} />;
      break;
    case 3:
      shape = (
        <path d={`M${half},${sw} L${half},${s - sw} M${sw},${half} L${s - sw},${half}`} {...common} strokeWidth={sw * 1.4} />
      );
      break;
    case 4:
      shape = <polygon points={`${half},${sw} ${s - sw},${half} ${half},${s - sw} ${sw},${half}`} {...common} />;
      break;
    default:
      shape = (
        <path d={`M${sw},${sw} L${s - sw},${s - sw} M${s - sw},${sw} L${sw},${s - sw}`} {...common} strokeWidth={sw * 1.4} />
      );
  }

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
        opacity: opacity * 0.95,
        filter: `drop-shadow(0 0 ${size * 0.06}px ${color})`,
      }}
    >
      {shape}
    </svg>
  );
};

// ---- 1文字 ----
const Char: React.FC<{ ch: string; idx: number; localPhrase: number; phrase: Phrase; size: number; stagger: number; enterDur: number }> = ({
  ch,
  idx,
  localPhrase,
  phrase,
  size,
  stagger,
  enterDur,
}) => {
  const charStart = idx * stagger;
  const local = localPhrase - charStart;
  if (local < 0) return null;

  const tIn = clamp01(local / enterDur);
  const e = easeOutBack(tIn);
  const ty = (1 - easeOutCubic(tIn)) * 60;
  const scale = 0.35 + e * 0.65;
  const opacity = clamp01(local / 3);

  const shapeColor = [PAL.MAGENTA, PAL.PINK, PAL.MINT][idx % 3];

  // Drop: 入り際に強い色収差（英語フックはこれで綺麗に出る）。
  // cold: 漢字が二重化して潰れるので極薄に（読みやすさ優先）。
  const dropChroma = phrase.drop ? Math.max(0, 9 - local) : 0;
  const coldChroma = phrase.cold ? 0.5 + Math.sin((local + idx * 3) / 6) * 0.4 : 0;
  const off = Math.max(dropChroma, coldChroma);
  const ghostOp = phrase.drop ? 0.75 : 0.22;
  // 白フィルはそのまま（漢字の内側の隙間を潰さない）。縁取りは div の textShadow で外側だけに出す。
  const inkStyle: React.CSSProperties = {
    position: 'relative',
    color: PAL.INK,
  };

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        transform: `translateY(${ty}px) scale(${scale})`,
        opacity,
        margin: phrase.english ? '0 0.01em' : '0',
      }}
    >
      {/* 図形バーストは打点系＝drop/サビ限定。全フレーズで出すと Verse と Chorus の落差が死ぬ。 */}
      {phrase.drop && <ShapeBurst kind={idx} color={shapeColor} local={local} size={size} />}
      {off > 0.4 && (
        <>
          <span style={{ position: 'absolute', left: 0, top: 0, color: PAL.MAGENTA, transform: `translateX(${-off}px)`, opacity: ghostOp }}>{ch}</span>
          <span style={{ position: 'absolute', left: 0, top: 0, color: PAL.CYAN, transform: `translateX(${off}px)`, opacity: ghostOp }}>{ch}</span>
        </>
      )}
      <span style={inkStyle}>{ch}</span>
    </span>
  );
};

const PhraseView: React.FC<{ p: Phrase; idx: number; frame: number; fps: number; offset: number; scale: number }> = ({
  p,
  idx,
  frame,
  fps,
  offset,
  scale,
}) => {
  const startF = Math.round((p.t + offset) * fps);
  const endF = Math.round((p.t + offset + p.hold) * fps);
  if (frame < startF || frame >= endF) return null; // ハードカット（重なり無し）
  const localPhrase = frame - startF;
  const durF = endF - startF;

  // 英語=DELA（極太ブロックで殴る）、日本語=Noto Sans JP Black（漢字が潰れず読める）。
  const font = p.english ? DELA : JP_GOTHIC;
  // JP_GOTHIC は DELA より字面が小さめなので日本語だけ僅かに拡大して字高を揃える。
  const jpBoost = p.english ? 1 : 1.08;
  const size = (p.size ?? (p.drop ? 220 : 130)) * scale * jpBoost;
  const tilt = p.tilt ?? 0;
  const chars = Array.from(p.text);

  // 出現を hold 内に必ず収める（＝表示しきる）。全文字の入場を hold の55%以内で完了させ、
  // 残り45%は完全表示で「余裕を持って」見せる。長い hold でも reveal は最大1.0sで畳みかける（phonk感）。
  const enterDur = 6;
  const maxReveal = Math.min(durF * 0.55, 30); // ≤55%hold かつ ≤1.0s
  const nGap = Math.max(1, chars.length - 1);
  const stagger = chars.length > 1 ? Math.max(1.0, Math.min(2.6, (maxReveal - enterDur) / nGap)) : 0;

  // 縁取り＝細めの4方向**白**影（＝高明度背景の雲/粒子から濃いインクを分離する）。
  // 暗背景版なら白文字を黒縁で締める。高明度版は濃い文字を白縁で浮かせる。
  // 落とし影も黒だと高明度が濁るので、淡いピンク寄りのソフト影にする。
  const o = Math.max(1.5, size * 0.012);
  const outline = [`${o}px 0`, `-${o}px 0`, `0 ${o}px`, `0 -${o}px`, `${o}px ${o}px`, `-${o}px -${o}px`, `${o}px -${o}px`, `-${o}px ${o}px`]
    .map((d) => `${d} 0 ${PAL.STROKE}`)
    .join(', ');
  const textShadow = `${outline}, 0 ${(size * 0.02).toFixed(0)}px ${(size * 0.05).toFixed(0)}px rgba(120,30,90,0.28)`;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: font,
          fontWeight: 900,
          fontSize: size,
          color: PAL.INK,
          letterSpacing: p.english ? '-0.01em' : '0.01em',
          transform: `scaleX(0.9) rotate(${tilt}deg)`,
          whiteSpace: 'nowrap',
          display: 'flex',
          textShadow,
        }}
      >
        {chars.map((ch, i) => (
          <Char key={i} ch={ch === ' ' ? ' ' : ch} idx={i} localPhrase={localPhrase} phrase={p} size={size} stagger={stagger} enterDur={enterDur} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---- 粉砂糖の舞い（`particle-rise`）----
// 完全静止フレームを作らないための常時装飾。落ちサビでも止めない。
// 決定的（Math.random 不使用）＝ハッシュで粒ごとの位相を作る。
const fract = (x: number) => x - Math.floor(x);
const rnd = (n: number) => fract(Math.sin(n * 12.9898) * 43758.5453);

const SugarDust: React.FC<{ frame: number; fps: number; count?: number }> = ({ frame, fps, count = 46 }) => {
  const t = frame / fps;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const x = rnd(i * 1.7) * 100;
    const speed = 3.2 + rnd(i * 3.1) * 5.5;          // %/秒（ゆっくり上昇）
    const life = 12 + rnd(i * 5.3) * 10;
    const phase = rnd(i * 7.9) * life;
    const age = (t + phase) % life;
    const y = 106 - (age * speed) % 118;              // 下から上へ抜ける
    const sway = Math.sin((t + i) * 0.55 + i) * 1.6;  // 横にふわり
    const r = 1.6 + rnd(i * 11.3) * 3.4;
    // 出入りで淡くフェード＝ポップイン/アウトを目立たせない
    const fadeIn = Math.min(1, age / 1.6);
    const fadeOut = Math.min(1, (life - age) / 2.2);
    const op = 0.5 * fadeIn * fadeOut;
    dots.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x + sway}%`,
          top: `${y}%`,
          width: r,
          height: r,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 0 ${r * 2.4}px #ffffff`,
          opacity: op,
        }}
      />
    );
  }
  return <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>{dots}</AbsoluteFill>;
};

// ---- 高明度オーバーレイ（透明。背景の上に重ねる）----
// 白スクリム（中央を持ち上げて濃いインクを読ませる）＋白ビネット＋粉砂糖の舞い。
export const ShapeBurstBG: React.FC<{ frameOffset?: number }> = ({ frameOffset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { sec } = sampleEnergy(frame, frameOffset);
  const drift = Math.sin(frame / 40) * 60;
  const drift2 = Math.cos(frame / 55) * 80;

  // 可読性スクリムは energy 駆動。常時置くと顔に白いモヤが掛かり続けるので、
  // サビ(sec高)ではほぼ外して顔を見せ、静かな区間だけ薄く戻す。
  const calm = clamp01(1 - sec / 0.62);          // sec>=0.62(Drop)で 0
  const scrimA = 0.10 + 0.40 * calm;             // Drop 0.10 / 静 0.50
  const vigA = 0.30 + 0.35 * calm;               // ビネットも静かな所だけ強く
  const hex = (a: number) => Math.round(clamp01(a) * 255).toString(16).padStart(2, '0');

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {/* 漂うパステルの層（白地では screen が効かないので低不透明の重ね） */}
      <AbsoluteFill
        style={{
          opacity: 0.34,
          background: `radial-gradient(62% 52% at ${28 + drift / 6}% ${38 + drift2 / 10}%, ${PAL.PINK}66, transparent 62%),
                       radial-gradient(56% 46% at ${74 + drift2 / 8}% ${64 + drift / 10}%, ${PAL.MINT}55, transparent 62%)`,
        }}
      />
      {/* 可読性スクリム: 中央を白く持ち上げる。サビでは外して顔を出す */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 44% at 50% 50%, ${PAL.BG}${hex(scrimA)} 0%, ${PAL.BG}${hex(scrimA * 0.7)} 46%, transparent 80%)`,
        }}
      />
      {/* 粉砂糖（常時＝完全静止フレーム禁止の担保） */}
      <SugarDust frame={frame} fps={fps} />
      {/* 白ビネット（端を飛ばして高明度に閉じる） */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 100% at 50% 48%, transparent 42%, ${PAL.BG}${hex(vigA)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// 歌詞レイヤ本体（背景は ShapeBurstBG に分離）。scale は 9:16 用のサイズ倍率。
export const ShapeBurstLyrics: React.FC<{ data: InvertShapesData; scale?: number; startSec?: number }> = ({
  data,
  scale = 1,
  startSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offset = (data.meta.timingOffsetSec ?? 0) - startSec;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {data.phrases.map((p, i) => (
        <PhraseView key={i} p={p} idx={i} frame={frame} fps={fps} offset={offset} scale={scale} />
      ))}
    </AbsoluteFill>
  );
};
