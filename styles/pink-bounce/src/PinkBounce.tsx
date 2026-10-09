import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { MOCHIY_POP, MPLUS_ROUNDED } from './fonts';
import { fitToHeight, fitToWidth, resolveScatter } from './layout';
import { Line } from './types';

/**
 * pink-bounce 文字エンジン（PinkBounceSwatch.tsx から本制作リグへ移植）。
 * 核: 2重フチ丸文字（Mochiy Pop One）＋ spring「ぷるん」1文字ステッガー＋常時wiggle
 *     ＋ドット絵デコ（ハート/星/プラス）。レイアウト center / split / scatter / giant。
 * スウォッチとの差分: ビート駆動→秒駆動（lyrics.json の t/hold）、scale対応（9:16縦用）、
 *     center はデフォルト y=74%（中央キャラの顔を避けて下寄せ）。
 */

// ---- パレット（曲ごとに差し替え可能・ここを変えるだけで再着色） ----
const INK = '#ffffff';            // 文字本体＝ホワイト
const OUTLINE_IN = '#ff3d9a';     // 内フチ＝濃いピンク
const OUTLINE_OUT = '#ffffff';    // 外フチ＝白（2重フチの外側）
const GLOW = '#ff8fc7';           // ピンクのソフトグロー
const NEON_A = '#3df5c4';         // ネオン差し色（エメラルド〜シアン）
const NEON_B = '#36d7ff';
const HEART = '#ff5fa2';
const STAR = '#ffd84d';
const PLUS = '#7be0ff';
export const PALETTE = { INK, OUTLINE_IN, OUTLINE_OUT, GLOW, NEON_A, NEON_B, HEART, STAR, PLUS };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// 決定論的な擬似乱数（Math.randomはフレーム毎再評価で揺れるので使わない）
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// 2重フチ取り＝同じ字を3レイヤー重ねる（白外フチ→ピンク/ネオン内フチ→白塗り）。
// text-shadowの多段リングは縁が割れるので、-webkit-text-stroke のレイヤー重ねでクリーンに。
export const Glyph: React.FC<{ ch: string; size: number; neon?: boolean }> = ({ ch, size, neon }) => {
  const w = Math.max(2, size * 0.045);
  const inStroke = neon ? NEON_A : OUTLINE_IN;
  const layer = (stroke: string, sw: number, z: number): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    top: 0,
    color: stroke,
    WebkitTextStroke: `${sw}px ${stroke}`,
    paintOrder: 'stroke fill',
    zIndex: z,
  });
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        whiteSpace: 'pre',
        filter: `drop-shadow(0 ${size * 0.05}px 0 ${OUTLINE_IN}55) drop-shadow(0 0 ${size * 0.14}px ${GLOW})`,
      }}
    >
      <span style={layer(OUTLINE_OUT, w * 3.4, 0)}>{ch}</span>
      <span style={layer(inStroke, w * 1.7, 1)}>{ch}</span>
      <span style={{ position: 'relative', color: INK, zIndex: 2 }}>{ch}</span>
    </span>
  );
};

// ---- ドット絵風デコ・パーティクル ----
type Deco = { kind: 0 | 1 | 2; x: number; y: number; size: number; delay: number; drift: number };
export const PixelSvg: React.FC<{ grid: string[]; s: number; color: string }> = ({ grid, s, color }) => {
  const cols = grid[0].length;
  const px = s / cols;
  const cells: React.ReactNode[] = [];
  grid.forEach((row, ry) =>
    row.split('').forEach((c, cx) => {
      if (c === '1')
        cells.push(
          <rect key={`${ry}-${cx}`} x={cx * px} y={ry * px} width={px + 0.5} height={px + 0.5} fill={color} />,
        );
    }),
  );
  return (
    <svg width={s} height={px * grid.length} viewBox={`0 0 ${s} ${px * grid.length}`}>
      {cells}
    </svg>
  );
};
export const HEART_GRID = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
export const STAR_GRID = ['0001000', '0001000', '1111111', '0111110', '0011100', '0100010', '1000001'];
export const PLUS_GRID = ['00100', '00100', '11111', '00100', '00100'];

// 漫画ポーズ切替用の軽量FX。背景レイヤー内に置くため歌詞より常に後ろ。
// 毎2拍=ぷにっ＋端粒子、毎8拍=キャンディ枠。中央の顔ゾーンは完全に空ける。
export const PosePopFx: React.FC<{
  active: boolean;
  poseIndex: number;
  switchFrame: number;
  switchStep: number;
  fps?: number;
  scale?: number;
}> = ({ active, poseIndex, switchFrame, switchStep, fps = 30, scale = 1 }) => {
  if (!active || switchFrame < 0 || switchFrame > 10) return null;

  const life = clamp01(1 - switchFrame / 10);
  const pop = spring({ frame: switchFrame, fps, config: { damping: 9, stiffness: 220, mass: 0.45 } });
  const labels = ['ぱくっ', 'もぐっ', 'ぱくっ', 'ぺろっ'];
  const labelSide = switchStep % 2 === 0 ? 12 : 88;
  const particleCount = switchStep % 2 === 0 ? 6 : 4;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const r = (k: number) => seeded(switchStep * 41.3 + poseIndex * 9.7 + i * 6.1 + k);
    const left = i % 2 === 0;
    const x = left ? 7 + r(1) * 13 : 80 + r(1) * 13;
    const y = 18 + r(2) * 62;
    const travelX = (left ? -1 : 1) * (8 + r(3) * 18) * (1 - life);
    const travelY = -(8 + r(4) * 25) * (1 - life);
    const kind = ((poseIndex + i) % 3) as 0 | 1 | 2;
    const color = [HEART, STAR, PLUS][kind];
    const grid = [HEART_GRID, STAR_GRID, PLUS_GRID][kind];
    const size = (24 + r(5) * 28) * scale;
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%,-50%) translate(${travelX}px, ${travelY}px) scale(${0.65 + pop * 0.55}) rotate(${(r(6) - 0.5) * 50}deg)`,
          opacity: life * 0.78,
          filter: `drop-shadow(0 0 ${size * 0.3}px ${color}) drop-shadow(0 2px 0 #fff)`,
          imageRendering: 'pixelated',
        }}
      >
        <PixelSvg grid={grid} s={size} color={color} />
      </div>
    );
  });

  const candyFrame = poseIndex === 0 && switchStep > 0 ? (
    <AbsoluteFill
      style={{
        inset: 12 * scale,
        border: `${Math.max(3, 6 * scale)}px solid #ffffff`,
        borderRadius: 30 * scale,
        boxShadow: `inset 0 0 0 ${Math.max(2, 5 * scale)}px ${HEART}, inset 0 0 ${40 * scale}px ${NEON_A}, 0 0 ${26 * scale}px ${GLOW}`,
        opacity: life * 0.46,
      }}
    />
  ) : null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {candyFrame}
      {particles}
      <div
        style={{
          position: 'absolute',
          left: `${labelSide}%`,
          top: '62%',
          transform: `translate(-50%,-50%) rotate(${labelSide < 50 ? -8 : 8}deg) scale(${0.55 + pop * 0.55})`,
          color: '#ffffff',
          fontFamily: MOCHIY_POP,
          fontSize: 48 * scale,
          letterSpacing: '0.05em',
          WebkitTextStroke: `${Math.max(2, 4 * scale)}px ${OUTLINE_IN}`,
          paintOrder: 'stroke fill',
          filter: `drop-shadow(0 3px 0 #ffffff) drop-shadow(0 0 ${18 * scale}px ${GLOW})`,
          opacity: life * 0.92,
          whiteSpace: 'nowrap',
        }}
      >
        {labels[poseIndex] ?? 'ぱくっ'}
      </div>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 48%, transparent 58%, #ffffff ${95 - life * 12}%)`,
          opacity: life * 0.1,
        }}
      />
    </AbsoluteFill>
  );
};

export const DecoLayer: React.FC<{ seed: number; local: number; fps: number; scale?: number }> = ({
  seed,
  local,
  fps,
  scale = 1,
}) => {
  // フレーズごとに7個のデコを散らす。歌詞表示から数フレーム遅れて出現→ふわふわ上昇→フェードアウト。
  const decos: Deco[] = Array.from({ length: 7 }, (_, i) => {
    const r = (k: number) => seeded(seed * 13.37 + i * 7.7 + k);
    let x = 8 + r(2) * 84;
    let y = 18 + r(3) * 64;
    // 顔ゾーン（中央キャラの顔まわり）回避: 中央上部に落ちたデコは水平に外へ押し出す
    if (x > 32 && x < 68 && y < 58) x = x < 50 ? x - 26 : x + 26;
    x = Math.max(4, Math.min(96, x));
    return {
      kind: (Math.floor(r(1) * 3) as 0 | 1 | 2),
      x,
      y,
      size: (28 + r(4) * 46) * scale,
      delay: 4 + Math.floor(r(5) * 12),
      drift: (r(6) - 0.5) * 40,
    };
  });
  return (
    <>
      {decos.map((d, i) => {
        const lf = local - d.delay;
        if (lf < 0) return null;
        const pop = spring({ frame: lf, fps, config: { damping: 9, stiffness: 160, mass: 0.6 } });
        const life = lf / fps;
        const rise = life * 60;
        const opacity = clamp01(pop) * clamp01(1 - (lf - 18) / 26);
        if (opacity <= 0) return null;
        const wob = Math.sin(lf / 8 + i) * 6 + d.drift * (life * 0.5);
        const color = [HEART, STAR, PLUS][d.kind];
        const grid = [HEART_GRID, STAR_GRID, PLUS_GRID][d.kind];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: `translate(-50%,-50%) translate(${wob}px, ${-rise}px) scale(${pop}) rotate(${(seeded(seed + i) - 0.5) * 30}deg)`,
              opacity,
              filter: `drop-shadow(0 0 ${d.size * 0.25}px ${color}) drop-shadow(0 2px 0 #fff)`,
              imageRendering: 'pixelated',
            }}
          >
            <PixelSvg grid={grid} s={d.size} color={color} />
          </div>
        );
      })}
    </>
  );
};

// ---- ホワイトアウト＋kawaiiバースト（静止→ダンス切替の「パーン」） ----
// from の3フレーム前から白がせり上がり、from で真っ白（ここで背景が静止画→動画に切り替わる）。
// 白が抜けながらハート/星/プラスが放射状にはじけ、白リングが広がる。約1.2秒で完全消滅。
export const KawaiiBurst: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - from;
  if (local < -3 || local > 40) return null;

  // 白フラッシュ: -3..0 でせり上がり → 0..12 で抜ける
  const flash = local < 0 ? (local + 3) / 3 : clamp01(1 - local / 12);

  // 放射パーティクル: 中心(50%,46%)からease-outで飛散
  const N = 26;
  const particles =
    local < 0
      ? null
      : Array.from({ length: N }, (_, i) => {
          const r = (k: number) => seeded(i * 9.13 + k * 3.7 + 5);
          const ang = (i / N) * Math.PI * 2 + (r(1) - 0.5) * 0.5;
          const dist = 24 + r(2) * 32; // 画面%換算の飛距離
          const t = clamp01(local / (26 + r(3) * 10));
          const p = 1 - Math.pow(1 - t, 3); // ease-out cubic
          const x = 50 + Math.cos(ang) * dist * p * 0.62; // 縦画面なのでxは圧縮
          const y = 46 + Math.sin(ang) * dist * p;
          const pop = spring({ frame: local, fps, config: { damping: 9, stiffness: 180, mass: 0.5 } });
          const opacity = clamp01(pop) * clamp01(1 - (local - 16) / 20);
          if (opacity <= 0) return null;
          const kind = Math.floor(r(4) * 3) as 0 | 1 | 2;
          const color = [HEART, STAR, PLUS][kind];
          const grid = [HEART_GRID, STAR_GRID, PLUS_GRID][kind];
          const size = 30 + r(5) * 44;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%,-50%) scale(${pop}) rotate(${(r(6) - 0.5) * 140 * p}deg)`,
                opacity,
                filter: `drop-shadow(0 0 ${size * 0.3}px ${color}) drop-shadow(0 2px 0 #fff)`,
              }}
            >
              <PixelSvg grid={grid} s={size} color={color} />
            </div>
          );
        });

  // 白リング: 中心からパーンと拡大しつつ消える
  const ringT = clamp01(local / 18);
  const ringP = 1 - Math.pow(1 - ringT, 3);
  const ring =
    local < 0 ? null : (
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: 200,
          height: 200,
          transform: `translate(-50%,-50%) scale(${0.3 + ringP * 6})`,
          borderRadius: '50%',
          border: `10px solid #ffffff`,
          boxShadow: `0 0 40px ${GLOW}, inset 0 0 30px ${GLOW}`,
          opacity: 0.9 * (1 - ringP),
        }}
      />
    );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {ring}
      {particles}
      <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---- 1文字（springぷるんポップ＋常時wiggle） ----
const Char: React.FC<{
  ch: string;
  idx: number;
  local: number;
  fps: number;
  size: number;
  neon?: boolean;
  vertical?: boolean;
  stagger?: number;
}> = ({ ch, idx, local, fps, size, neon, vertical, stagger = 3 }) => {
  const enter = spring({
    frame: local - idx * stagger,
    fps,
    config: { damping: 8, stiffness: 170, mass: 0.7 }, // overshoot で「ぷるん」（0→~1.2→1）
  });
  if (enter <= 0) return null;
  const settle = clamp01((local - idx * stagger - 10) / 10);
  const wy = Math.sin(local / 14 + idx * 0.9) * 6 * settle;
  const wr = Math.sin(local / 18 + idx * 0.7) * 3 * settle;
  return (
    <span style={{ display: 'inline-block', transform: `translateY(${wy}px) rotate(${wr}deg) scale(${enter})` }}>
      <Glyph ch={vertical && ch === ' ' ? '　' : ch} size={size} neon={neon} />
    </span>
  );
};

export const Word: React.FC<{
  text: string;
  local: number;
  fps: number;
  size: number;
  neon?: boolean;
  handwrite?: boolean;
  vertical?: boolean;
}> = ({ text, local, fps, size, neon, handwrite, vertical }) => {
  const chars = Array.from(text);
  // 早口曲対策: 長い行ほど1文字ディレイを詰め、行全体が約20フレームで出揃うようにする（短い行は3フレーム上限）。
  const stagger = Math.max(1, Math.min(3, 20 / Math.max(1, chars.length)));
  const common: React.CSSProperties = {
    fontFamily: handwrite ? MPLUS_ROUNDED : MOCHIY_POP,
    fontWeight: 800,
    fontSize: size,
    lineHeight: vertical ? 1.18 : 1.05,
    letterSpacing: handwrite ? '0.1em' : '0.05em',
  };
  if (vertical) {
    // 縦書き: writingMode に任せて縦に流す（flexは使わない＝順序/向きが壊れない）
    return (
      <div style={{ ...common, writingMode: 'vertical-rl', textOrientation: 'upright', textAlign: 'center' }}>
        {chars.map((ch, i) => (
          <Char key={i} ch={ch} idx={i} local={local} fps={fps} size={size} neon={neon} vertical stagger={stagger} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ ...common, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {chars.map((ch, i) => (
        <Char key={i} ch={ch} idx={i} local={local} fps={fps} size={size} neon={neon} stagger={stagger} />
      ))}
    </div>
  );
};

// ---- 1行（lyrics.json の Line）を秒駆動で描く ----
export const PhraseLayer: React.FC<{
  line: Line;
  idx: number;
  scale: number;
  /** 曲の絶対秒（giant の拍同期に使う）。省略時は拍アニメなし。 */
  songSec?: number;
  bpm?: number;
}> = ({ line, idx, scale, songSec, bpm = 120 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const startF = line.t * fps;
  const endF = (line.t + line.hold) * fps;
  if (frame < startF || frame >= endF) return null;
  const local = frame - startF;
  const rawSize = (line.size ?? 110) * scale;

  let body: React.ReactNode = null;
  if (line.pattern === 'center') {
    // 実測幅で画面に収める（長い英語行が画面外に切れないように）
    const sz = fitToWidth(line.text!, rawSize, width, line.handwrite);
    body = (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${line.y ?? 74}%`,
            transform: 'translate(-50%,-50%) rotate(-2deg)',
          }}
        >
          <Word text={line.text!} local={local} fps={fps} size={sz} neon={line.neon} handwrite={line.handwrite} />
        </div>
      </AbsoluteFill>
    );
  } else if (line.pattern === 'giant') {
    // 極大・半透明・被写体を邪魔しない背景レイヤー。
    // rotate(-4deg) ぶん実効幅が伸びるので、その分を見込んで収める（BREAK! の左右はみ出し対策）。
    const sz = fitToWidth(line.text!, rawSize, width, false, 0.9);
    // giant は置いてあるだけだと静止して見えるので、拍で殴る。
    const beat = songSec !== undefined ? (songSec * bpm) / 60 : 0;
    const bEnv = songSec !== undefined ? Math.exp(-(beat % 1) * 7) : 0;
    const barIdx = Math.floor(beat / 4);
    const punch = 1 + bEnv * 0.075;
    const jitter = bEnv * 10 * (seeded(barIdx * 5.7) - 0.5) * 2;
    const tilt = -4 + Math.sin(beat * Math.PI * 0.5) * 2.4;
    body = (
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.42 + bEnv * 0.22,
        }}
      >
        <div style={{ transform: `translate(${jitter}px, ${-bEnv * 8}px) rotate(${tilt}deg) scale(${punch})` }}>
          <Word text={line.text!} local={local} fps={fps} size={sz} neon />
        </div>
      </AbsoluteFill>
    );
  } else if (line.pattern === 'split') {
    // 左右分割の縦書き（中央のキャラを挟む）
    const szL = fitToHeight(line.left!, rawSize, height);
    const szR = fitToHeight(line.right!, rawSize, height);
    body = (
      <AbsoluteFill>
        <div style={{ position: 'absolute', left: '13%', top: '50%', transform: 'translate(-50%,-50%) rotate(-4deg)' }}>
          <Word text={line.left!} local={local} fps={fps} size={szL} vertical neon={line.neon} />
        </div>
        <div style={{ position: 'absolute', right: '13%', top: '50%', transform: 'translate(50%,-50%) rotate(3deg)' }}>
          <Word text={line.right!} local={local} fps={fps} size={szR} vertical neon={line.neon} />
        </div>
      </AbsoluteFill>
    );
  } else {
    // scatter: 斜め・ランダム（大中小のリズム）。
    // x/y は手置きなので語が重なりうる。resolveScatter が実測幅で押し出し／必要なら縮小して解く。y と rot は作者の意図なので動かさない。
    const placed = resolveScatter(line.words!, width, height, scale);
    body = (
      <AbsoluteFill>
        {placed.map((w, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${w.x}%`,
              top: `${w.y}%`,
              transform: `translate(-50%,-50%) rotate(${w.rot}deg)`,
            }}
          >
            <Word text={w.t} local={local - i * 4} fps={fps} size={w.size} neon={line.neon} />
          </div>
        ))}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      {body}
      {line.deco !== false && <DecoLayer seed={idx + 1} local={local} fps={fps} scale={scale} />}
    </AbsoluteFill>
  );
};
