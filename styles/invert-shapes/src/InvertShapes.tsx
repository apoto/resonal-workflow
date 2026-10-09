import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { DELA } from './fonts';
import { InvertShapesData, Phrase, ShapeSpec } from './types';

/**
 * invert-shapes 歌詞レイヤ — 病みかわいいボカロMV調。
 * 核: ソリッド白図形＋ネガポジ反転（mix-blend-mode:difference）＋極太角ゴシック＋3色（紫/白/黒）。
 * 手作業っぽいキレ: 図形レイアウトの不規則化（big/point/cover/なし）、reveal緩急（flow/swap）、
 * ベースラインのガタガタ（文字ごとの上下ジッター）＋フレーズ全体の微傾き。
 *
 * input/lyrics.json のフレーズ配列で駆動する。
 * タイミングは beat ではなく秒（t/hold）ベース＝whisper由来の歌詞タイミングにそのまま乗る。
 * scale は 9:16 ショート用のサイズ倍率（16:9本編は 1.0）。
 */

const WHITE = '#f2f4f8'; // 曲ごとに再着色する1箇所（純白 #ffffff / クローム寄り #f2f4f8 など）

// ---- ユーティリティ ----
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fract = (x: number) => x - Math.floor(x);
// 決定的な擬似乱数（Math.random は Remotion で不可）。seed=フレーズidx で安定。
const rnd = (i: number, seed: number) => fract(Math.sin((i + 1) * 12.9898 + (seed + 1) * 78.233) * 43758.5453);

function easeOutBack(t: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// 文字ごとの上下ジッター（px）。figure/text 両レイヤーで同値を使い整列を保つ。
const jitterY = (i: number, seed: number, size: number) => (rnd(i, seed) * 2 - 1) * size * 0.07;

// ---- ソリッド白図形 ----
const SolidShape: React.FC<{ kind: number; pop: number; px: number; dx?: number; dy?: number }> = ({
  kind,
  pop,
  px,
  dx = 0,
  dy = 0,
}) => {
  const s = px;
  const half = s / 2;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${pop})`,
  };
  let inner: React.ReactNode;
  switch (kind % 3) {
    case 0:
      inner = <circle cx={half} cy={half} r={half} fill={WHITE} />;
      break;
    case 1:
      inner = <polygon points={`${half},0 ${s},${s} 0,${s}`} fill={WHITE} />;
      break;
    default:
      inner = <rect x={0} y={0} width={s} height={s} fill={WHITE} transform={`rotate(${kind % 2 ? 10 : 0} ${half} ${half})`} />;
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={style}>
      {inner}
    </svg>
  );
};

// ---- flow 行（dual-row：shapes と text を同じ字送り＋同じジッター/傾きで重ねる） ----
const FlowRow: React.FC<{
  p: Phrase;
  size: number;
  local: number;
  seed: number;
  mode: 'shape' | 'text';
  /** この行のテキスト（改行フレーズでは1行分）。省略時は p.text 全体 */
  text?: string;
  /** 縦積みのオフセット（2行改行時に使う） */
  offsetY?: number;
  /** shapes.at は元テキスト基準なので、行の開始indexを足して照合する */
  charBase?: number;
}> = ({ p, size, local, seed, mode, text, offsetY = 0, charBase = 0 }) => {
  const chars = Array.from(text ?? p.text);
  // ★reveal='block' は stagger 0 ＝全文字を同時に出す（塊）。
  //   一文字ずつ出る見え方が合わない区間（Pre-Chorus / 「溜めてるだけ・動いてない」）で使う。
  const stagger = p.reveal === 'block' ? 0 : 1.9;
  const enterDur = 10;
  const shapes = p.shapes ?? [];
  const tilt = p.tilt ?? 0;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: DELA,
          fontSize: size,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          color: WHITE,
          transform: `translateY(${offsetY}px) rotate(${tilt}deg)`,
          transformOrigin: 'center',
        }}
      >
        {chars.map((ch, i) => {
          const lc = local - i * stagger;
          const visible = lc >= 0;
          const jy = jitterY(i, seed, size);
          const spec = shapes.find((s) => s.at === charBase + i);

          return (
            <span
              key={i}
              style={{
                position: 'relative',
                display: 'inline-block',
                transform: `translateY(${jy}px)`, // ガタガタ・ベースライン（両レイヤー共通）
              }}
            >
              <span style={{ visibility: 'hidden' }}>{ch === ' ' ? ' ' : ch}</span>
              {visible && mode === 'shape' && spec && (
                <span style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
                  {(() => {
                    const popT = clamp01(lc / 7);
                    const pop = easeOutBack(popT);
                    if (spec.mode === 'big') return <SolidShape kind={spec.kind} pop={pop} px={size * 2.5} dx={(spec.dx ?? 0) * size} />;
                    if (spec.mode === 'point') {
                      const off = size * 0.34;
                      const dx = spec.corner?.includes('r') ? off : -off;
                      const dy = spec.corner?.includes('t') ? -off : off;
                      return <SolidShape kind={spec.kind} pop={pop} px={size * 0.42} dx={dx} dy={dy} />;
                    }
                    return <SolidShape kind={spec.kind} pop={pop} px={size * 0.92} />;
                  })()}
                </span>
              )}
              {visible && mode === 'text' && (
                <span style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    const tIn = clamp01(lc / enterDur);
                    const ty = (1 - easeOutCubic(tIn)) * 70;
                    const scl = 0.45 + easeOutBack(tIn) * 0.55;
                    return <span style={{ transform: `translateY(${ty}px) scale(${scl})`, color: WHITE }}>{ch === ' ' ? ' ' : ch}</span>;
                  })()}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---- swap ビュー：中央で1文字ずつ上書き ----
const SwapView: React.FC<{ p: Phrase; size: number; local: number; durF: number; seed: number }> = ({ p, size, local, durF, seed }) => {
  const chars = Array.from(p.text).filter((c) => c !== ' ');
  const per = durF / Math.max(1, chars.length); // 1文字の持ち時間（frame）
  const cur = clamp(Math.floor(local / per), 0, chars.length - 1);
  const ch = chars[cur];
  const lc = local - cur * per;
  const tIn = clamp01(lc / 6);
  const scl = 0.6 + easeOutBack(tIn) * 0.4;
  const jy = jitterY(cur, seed, size);
  const hasShape = rnd(cur, seed + 7) > 0.45;
  const popT = clamp01(lc / 6);
  const pop = easeOutBack(popT);
  const kind = Math.floor(rnd(cur, seed + 3) * 3);
  const tilt = p.tilt ?? 0;

  const wrap: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, calc(-50% + ${jy}px)) rotate(${tilt}deg)`,
    fontFamily: DELA,
    fontSize: size,
    lineHeight: 1,
    color: WHITE,
  };

  return (
    <>
      {hasShape && (
        <div style={wrap}>
          <SolidShape kind={kind} pop={pop} px={size * 1.05} />
        </div>
      )}
      <AbsoluteFill style={{ mixBlendMode: 'difference' }}>
        <div style={{ ...wrap, transform: `translate(-50%, calc(-50% + ${jy}px)) rotate(${tilt}deg) scale(${scl})` }}>{ch}</div>
      </AbsoluteFill>
    </>
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
  if (frame < startF || frame >= endF) return null; // ハードカット
  const local = frame - startF;
  const durF = endF - startF;
  const size = (p.size ?? 380) * scale;

  // ★英語句などは "\n" で上下2行に改行する（1行に極大サイズで置くと画面外に出て読めない）。
  //   改行フレーズは図形なし＝「極大文字だけドン」の invert-shapes パターンで出す。
  const lines = (p.text ?? '').split('\n');
  const bases: number[] = [];
  {
    let acc = 0;
    for (const ln of lines) {
      bases.push(acc);
      acc += Array.from(ln).length + 1; // +1 は改行文字ぶん
    }
  }
  const lineGap = size * 1.06;
  const oy = (li: number) => (lines.length === 1 ? 0 : (li - (lines.length - 1) / 2) * lineGap);

  return (
    <AbsoluteFill style={{ isolation: 'isolate' }}>
      {p.reveal === 'swap' ? (
        <SwapView p={p} size={size} local={local} durF={durF} seed={idx} />
      ) : (
        <>
          {lines.map((ln, li) => (
            <FlowRow
              key={`s${li}`}
              p={p}
              text={ln}
              size={size}
              local={local - li * 3}
              seed={idx * 7 + li}
              mode="shape"
              offsetY={oy(li)}
              charBase={bases[li]}
            />
          ))}
          <AbsoluteFill style={{ mixBlendMode: 'difference' }}>
            {lines.map((ln, li) => (
              <FlowRow
                key={`t${li}`}
                p={p}
                text={ln}
                size={size}
                local={local - li * 3}
                seed={idx * 7 + li}
                mode="text"
                offsetY={oy(li)}
                charBase={bases[li]}
              />
            ))}
          </AbsoluteFill>
        </>
      )}
    </AbsoluteFill>
  );
};

// 歌詞レイヤ本体（背景は別レイヤ＝Background に分離）。scale は 9:16 用のサイズ倍率。
export const InvertShapesLyrics: React.FC<{ data: InvertShapesData; scale?: number; startSec?: number }> = ({
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
