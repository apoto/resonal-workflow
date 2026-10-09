import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { OverlayDef, OverlayProps, registerOverlays } from '../../src/registry';
import { fontFor, pal, seeded } from './engine';

/**
 * portrait-frame の常時レイヤー。
 *
 * ★これが portrait-frame のコスト設計の本体: **雪・霧・キラキラ・グレインは Kling を使わず
 *   プロシージャルで作る**（無料・完全ループ・速度自由）。Kling は「面全体の質感が
 *   有機的に変化するカット」だけに投下する。
 * ★完全静止フレーム禁止（mv-production.md 骨格検査）の担保もここ。
 *   立ち絵が静止していても、雪と霧が常時動いていれば画は生きている。
 */

// ------------------------------------------------------------------ snow

/**
 * 舞う雪＋地吹雪。density で密度、wind で横流れの強さ。
 */
const Snow: React.FC<OverlayProps> = ({ local, params, palette, scale }) => {
  const { fps, width, height } = useVideoConfig();
  const t = local / fps;
  const n = Math.round(((params.density as number) ?? 220) * scale);
  const wind = (params.wind as number) ?? 1;
  const color = pal(palette, (params.tone as string) ?? 'ground');
  // 拍の直後だけ流速が上がる（指数減衰）。bpm 未指定なら常に等速
  const bpm = (params.bpm as number) ?? 0;
  const kick = (params.kick as number) ?? 0.55;
  const beat = bpm > 0 ? 60 / bpm / ((params.per as number) ?? 1) : 0;
  const surge = beat > 0 ? 1 + kick * Math.exp(-((t % beat) / beat) * 7) : 1;

  const flakes = new Array(n).fill(0).map((_, i) => {
    const r = (k: number) => seeded(i * 12.9898 + k * 78.233);
    const size = (0.8 + r(1) * 3.4) * scale;
    const speed = (40 + r(2) * 210) * surge;             // 落下速度 px/s（拍で加速）
    const drift = (120 + r(3) * 420) * wind * surge;     // 横流れ px/s（拍で加速）
    const y = (r(4) * height + t * speed) % (height + 40) - 20;
    const x = (r(5) * width + t * drift) % (width + 80) - 40;
    // 手前の粒は大きく速く不透明、奥は小さく薄い
    const depth = size / (4.2 * scale);
    return { x, y, size, opacity: 0.28 + depth * 0.55, blur: (1 - depth) * 1.4 };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {flakes.map((f, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: f.size,
            height: f.size,
            borderRadius: '50%',
            background: color,
            opacity: f.opacity,
            filter: f.blur > 0.1 ? `blur(${f.blur}px)` : undefined,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ mist

/** 白い霧が横に流れる。面の情報量を落として歌詞を読ませる役も持つ。 */
const Mist: React.FC<OverlayProps> = ({ local, params, palette }) => {
  const { fps, width } = useVideoConfig();
  const t = local / fps;
  const amount = (params.amount as number) ?? 0.4;
  const speed = (params.speed as number) ?? 0.06;
  const color = pal(palette, (params.tone as string) ?? 'ground');
  const bands = 3;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {new Array(bands).fill(0).map((_, i) => {
        const off = ((t * speed * (1 + i * 0.6)) % 1) * width;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: `${8 + i * 26}% -40% ${58 - i * 26}% -40%`,
              background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
              // 3バンドの重なりで飽和しないよう1バンドあたりを十分薄くする
              opacity: amount * (0.16 + i * 0.06),
              transform: `translateX(${off - width * 0.5}px)`,
              filter: 'blur(30px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ sparkle

/**
 * 結晶のキラキラ。4方向の光条を持つ点を疎に散らす。
 */
const Sparkle: React.FC<OverlayProps> = ({ local, params, palette, scale }) => {
  const { fps, width, height } = useVideoConfig();
  const t = local / fps;
  const n = Math.round(((params.count as number) ?? 16) * scale);
  const color = pal(palette, (params.tone as string) ?? 'ground');
  const bpm = (params.bpm as number) ?? 0;
  const beat = bpm > 0 ? 60 / bpm / ((params.per as number) ?? 1) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {new Array(n).fill(0).map((_, i) => {
        const r = (k: number) => seeded(i * 31.71 + k * 17.13);
        // bpm 指定時は「拍を周期にして、粒ごとに位相をずらす」＝拍で一斉に、でも同時ではない
        const period = beat > 0 ? beat * (1 + Math.floor(r(1) * 3)) : 1.6 + r(1) * 2.8;
        const phase = (t + r(2) * period) % period;
        const on = phase < (beat > 0 ? Math.min(0.42, beat * 0.7) : 0.42);
        if (!on) return null;
        const life = phase / 0.42;                       // 0→1
        const a = Math.sin(life * Math.PI);              // 立ち上がって落ちる
        const len = (10 + r(3) * 26) * scale * a;
        return (
          <div key={i} style={{ position: 'absolute', left: r(4) * width, top: r(5) * height, opacity: a }}>
            <div style={{ position: 'absolute', width: len * 2, height: 1.2 * scale, left: -len, background: color }} />
            <div style={{ position: 'absolute', height: len * 2, width: 1.2 * scale, top: -len, background: color }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ frame

/**
 * 額縁装飾。コーナーオーナメント＋上下の細い装飾ライン。
 * portrait-frame は「絵画／舞台を見ている」型なので、額縁が世界の枠を宣言する。
 * ★意匠は章で1段だけ変える（weight）。毎カット変えると額縁が主役になる。
 */
const Frame: React.FC<OverlayProps> = ({ params, palette, scale }) => {
  const { width, height } = useVideoConfig();
  const color = pal(palette, (params.tone as string) ?? 'shade');
  const w = ((params.weight as number) ?? 1.4) * scale;
  const inset = ((params.inset as number) ?? 3.4) / 100;
  const corner = ((params.corner as number) ?? 5.2) / 100;
  const x = width * inset;
  const y = height * inset;
  const cx = width * corner;
  const cy = height * corner;
  const line = (s: React.CSSProperties) => (
    <div style={{ position: 'absolute', background: color, opacity: (params.opacity as number) ?? 0.7, ...s }} />
  );
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 上下の細いライン（左右は開けて余白を殺さない） */}
      {line({ left: x + cx, right: x + cx, top: y, height: w })}
      {line({ left: x + cx, right: x + cx, bottom: y, height: w })}
      {/* 四隅のオーナメント（L字） */}
      {[
        { left: x, top: y },
        { right: x, top: y },
        { left: x, bottom: y },
        { right: x, bottom: y },
      ].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', width: cx, height: cy, ...pos }}>
          {line({ left: 0, right: 0, [i < 2 ? 'top' : 'bottom']: 0, height: w } as React.CSSProperties)}
          {line({ top: 0, bottom: 0, [i % 2 === 0 ? 'left' : 'right']: 0, width: w } as React.CSSProperties)}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ grain

/** フィルムグレイン。AI生成のツルツル感を消す常時がけの下地。 */
const Grain: React.FC<OverlayProps> = ({ local, params }) => {
  const amount = (params.amount as number) ?? 0.06;
  // フレームごとに種を変える（静止したグレインは埃に見える）
  const seed = Math.floor(local) % 8;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: amount,
        mixBlendMode: 'overlay',
        backgroundImage:
          `url("data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='3' seed='${seed}'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>`
          )}")`,
        backgroundSize: '180px 180px',
      }}
    />
  );
};


// ------------------------------------------------------------------ credit

/**
 * portrait-frame は白基調なので**スクリムは白**（暗いスクリムを敷くと画が濁る）。
 */
const Credit: React.FC<OverlayProps> = ({ local, durationInFrames, params, palette, scale }) => {
  const { fps, height } = useVideoConfig();
  const t = local / fps;
  const dur = durationInFrames / fps;
  const label = (params.label as string) ?? '';
  const name = (params.name as string) ?? '';
  const fade = (params.fade as number) ?? 0.4;
  const a =
    t < fade ? t / fade : t > dur - fade ? Math.max(0, (dur - t) / fade) : 1;
  const nameSize = Math.max(36, height * 0.042) * scale;
  const labelSize = Math.max(18, height * 0.020) * scale;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/*
        白スクリム。★`scrim: false` を渡すと描かない。
        クレジットを何枚も出す間、帯を**出しっぱなし**にしたい場合は
        `portrait-frame.scrim` overlay を別に敷いて、こちらは文字だけ描く
        （credit ごとにスクリムを出し入れすると帯が点滅する）。
      */}
      {(params.scrim ?? true) !== false && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '26%',
            background: `linear-gradient(to top, ${pal(palette, 'ground')} 0%, transparent 100%)`,
            opacity: 0.85,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: `${(params.bottomPct as number) ?? 6.5}%`,
          textAlign: 'center',
          opacity: a,
          color: pal(palette, 'ink'),
        }}
      >
        {label && (
          <div style={{ fontSize: labelSize, letterSpacing: labelSize * 0.22, opacity: 0.72, marginBottom: labelSize * 0.5, ...fontFor('read') }}>
            {label}
          </div>
        )}
        <div style={{ fontSize: nameSize, letterSpacing: nameSize * 0.08, ...fontFor('display') }}>{name}</div>
      </div>
    </AbsoluteFill>
  );
};


// ------------------------------------------------------------------ flood-white

/**
 * 白飛びワイプの **overlay 版**（record: light-flood-wipe）。
 */
const FloodWhite: React.FC<OverlayProps> = ({ local, durationInFrames, params, palette }) => {
  const { fps } = useVideoConfig();
  const t = local / fps;
  const dur = durationInFrames / fps;
  const prog = dur > 0 ? Math.max(0, Math.min(1, t / dur)) : 0;
  const peak = (params.peak as number) ?? 0.42;
  const hold = (params.hold as number) ?? 0.16;
  const dir = (params.dir as string) ?? 'left';
  const color = pal(palette, (params.tone as string) ?? 'ground');

  const a =
    prog < peak
      ? Math.pow(prog / peak, 1.7)
      : prog < peak + hold
        ? 1
        : Math.pow(1 - (prog - peak - hold) / Math.max(0.0001, 1 - peak - hold), 1.4);

  const gradient =
    dir === 'radial'
      ? `radial-gradient(circle at 50% 50%, ${color} 0%, ${color} ${30 + a * 70}%, transparent 100%)`
      : `linear-gradient(${dir === 'left' ? 90 : dir === 'right' ? 270 : 180}deg, ${color} 0%, ${color} ${a * 100}%, transparent ${Math.min(100, a * 100 + 18)}%)`;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', background: gradient, opacity: Math.min(1, a * 1.02) }} />
  );
};


// ------------------------------------------------------------------ scrim

/**
 * 画面下部の白い帯（クレジットの下敷き）。**出しっぱなしにして最後にフェードアウトする**用。
 */
const Scrim: React.FC<OverlayProps> = ({ local, durationInFrames, params, palette }) => {
  const { fps } = useVideoConfig();
  const t = local / fps;
  const dur = durationInFrames / fps;
  const fadeIn = (params.fadeIn as number) ?? 0.6;
  const fadeOut = (params.fadeOut as number) ?? 2.5;
  const base = (params.opacity as number) ?? 0.85;
  const a =
    t < fadeIn ? t / fadeIn
      : t > dur - fadeOut ? Math.max(0, (dur - t) / fadeOut)
      : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${(params.heightPct as number) ?? 26}%`,
          background: `linear-gradient(to top, ${pal(palette, 'ground')} 0%, transparent 100%)`,
          opacity: base * a,
        }}
      />
    </AbsoluteFill>
  );
};

const defs: OverlayDef[] = [
  { id: 'portrait-frame.snow', style: 'portrait-frame', name: '舞う雪・地吹雪', record: 'particle-rise', description: 'プロシージャルの雪。density/wind。完全静止フレーム禁止の担保。', component: Snow },
  { id: 'portrait-frame.mist', style: 'portrait-frame', name: '流れる霧', record: 'god-rays', description: '白い霧が横に流れる。面の情報量を落として歌詞を読ませる役も持つ。', component: Mist },
  { id: 'portrait-frame.sparkle', style: 'portrait-frame', name: '結晶のキラキラ', record: 'particle-rise', description: '4方向の光条を持つ点を疎に散らす常時の質感。打点ではない。', component: Sparkle },
  { id: 'portrait-frame.frame', style: 'portrait-frame', name: '額縁装飾', record: 'frame-in-frame', description: 'コーナーオーナメント＋上下の装飾ライン。世界の枠を宣言する。意匠は章で1段だけ変える。', component: Frame },
  { id: 'portrait-frame.flood-white', style: 'portrait-frame', name: '白飛びワイプ（overlay）', record: 'light-flood-wipe', description: '一方向から光が流入→全白→引き際に次の面を開示。★歌詞より下の層に出るので白の中に文字を置ける。1曲2〜3回まで。', component: FloodWhite },
  { id: 'portrait-frame.scrim', style: 'portrait-frame', name: '下部の白い帯', record: 'subtitle-caption-ui', description: 'クレジットの下敷き。出しっぱなしにして最後に fadeOut 秒でフェードアウトする。', component: Scrim },
  { id: 'portrait-frame.credit', style: 'portrait-frame', name: 'クレジット表記', description: 'クレジット表記（params.lines）。画面下部中央・白スクリム出しっぱなし。', component: Credit },
  { id: 'portrait-frame.grain', style: 'portrait-frame', name: 'フィルムグレイン', record: 'film-grain', description: 'AI生成のツルツル感を消す常時がけの下地。', component: Grain },
];

registerOverlays(...defs);
export const portraitFrameOverlays = defs;
