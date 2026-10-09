import React from 'react';
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from 'remotion';
import { Treatment, TreatmentProps, registerTreatments } from '../../src/registry';
import { GFONT, Material, paintFor, phrases, seeded, unitsOf } from './engine';
import { INS, OUTS, pickAnim } from '../../src/anim';

/**
 * burn-in の歌詞 treatment 4種 — 参考にした MV の型をそのまま再現する版。
 */

const P = (params: Record<string, unknown>) => ({
  material: (params.material as Material) ?? 'henceforth',
  /** 文字高の基準。画面高に対する % */
  capPct: (params.capPct as number) ?? 12,
  bpm: (params.bpm as number) ?? 150,
  per: (params.per as number) ?? 1,
  /** 極大にする文節の番号。-1 で無し */
  bomb: (params.bomb as number) ?? -1,
  side: (params.side as 'left' | 'right') ?? 'right',
  y: params.y as number | undefined,
  seed: (params.seed as number) ?? 0,
});

// ---------------------------------------------------------------- 静パート

/** 縦書き・小・画面端。Aメロ型。白の単色ベタ、装飾なし。 */
const QuietVertical: React.FC<TreatmentProps> = ({ lines, local, params, scale }) => {
  const line = lines[0];
  const { height } = useVideoConfig();
  const p = P(params);
  const size = (p.capPct / 100) * height * scale;
  const chars = Array.from(line.text.replace(/\s+/g, ''));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: `${p.y ?? 12}%`,
          [p.side === 'right' ? 'right' : 'left']: '6%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: GFONT,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.22,
          letterSpacing: '0.04em',
        } as React.CSSProperties}
      >
        {chars.map((ch, i) => {
          const t = interpolate(local - i * 0.8, [0, 7], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          return (
            <span
              key={i}
              style={{ ...paintFor('white', size), opacity: t, transform: `translateY(${(1 - t) * size * 0.4}px)` }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 横書き・小・下寄せ。Bメロ型。黄の単色ベタ、文字高は画面の7%。 */
const QuietCenter: React.FC<TreatmentProps> = ({ lines, local, params, scale }) => {
  const line = lines[0];
  const { height } = useVideoConfig();
  const p = P(params);
  const size = ((params.capPct as number) ?? 7) / 100 * height * scale;
  const t = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: `${p.y ?? 78}%`,
          transform: `translate(-50%, -50%) translateY(${(1 - t) * size * 0.28}px)`,
          fontFamily: GFONT,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.1,
          whiteSpace: 'pre',
          opacity: t,
          letterSpacing: '0.1em',
          ...paintFor(p.material === 'white' ? 'white' : 'henceforth', size),
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
};

/** 暗転＋小1行。タメ。白の単色ベタ。 */
const HoldDark: React.FC<TreatmentProps> = ({ lines, local, params, scale }) => {
  const line = lines[0];
  const { height } = useVideoConfig();
  const p = P(params);
  const size = ((params.capPct as number) ?? 8) / 100 * height * scale;
  const veil = interpolate(local, [0, 10], [0, 0.8], { extrapolateRight: 'clamp' });
  const t = interpolate(local, [4, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: '#03000a', opacity: veil }} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: `${p.y ?? 50}%`,
          transform: 'translate(-50%, -50%)',
          fontFamily: GFONT,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '0.16em',
          whiteSpace: 'pre',
          opacity: t,
          ...paintFor('white', size),
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- サビ

/**
 * beat-word-stack。
 * 1拍1文節が巨大サイズで飛び込み縮小着地し、消えずに積もる。
 * ★1文節の中で文字ごとにサイズが落ちて縦位置が下がる＝階段。これが「デザインされて見える」正体。
 */
/**
 * beat-word-stack（第5版）。scope='section' / layered。
 *
 * 語を時間順に並べ、**次の語が来たら前の語を追い出す**逐次モデル。
 *   出入りのアニメーションは engine の INS / OUTS から seed で引く＝毎回違う動きになる。
 *   セクション内で2回以上出る語は punch（画面いっぱい・中央・背面）に格上げする。
 */
const WordStack: React.FC<TreatmentProps> = ({ lines, local, params, scale, sectionFrom, layer }) => {
  const { fps, width, height } = useVideoConfig();
  const p = P(params);
  const UNIT_STAGGER = (params.unitStagger as number) ?? 3;
  const IN_F = (params.inFrames as number) ?? 7;
  const OUT_F = (params.outFrames as number) ?? 10;
  /** 語幅がこれ以下なら punch（繰り返し語は幅に関係なく punch） */
  const punchMaxEm = (params.punchMaxEm as number) ?? 3.0;
  const t = local / fps;

  const emOf = (units: string[]) =>
    units.reduce((a, ch) => a + (/[\x00-\x7F]/.test(ch) ? 0.56 * Array.from(ch).length : 0.98), 0);

  /** 語ブロックを時間順に。out は「次の語の in」で始まる＝入れ替わる */
  const blocks = React.useMemo(() => {
    const raw: { units: string[]; em: number; at: number; text: string; key: string }[] = [];
    lines.forEach((L, li) => {
      const ws = phrases(L.text);
      ws.forEach((w, wi) => {
        const units = unitsOf(w);
        raw.push({
          units,
          em: emOf(units),
          at: L.t - sectionFrom + (wi / ws.length) * L.hold,
          text: w.toLowerCase(),
          key: `${li}-${wi}`,
        });
      });
    });
    raw.sort((a, b) => a.at - b.at);
    // セクション内で2回以上出る語は「画面いっぱい中央」に格上げする
    const seen = new Map<string, number>();
    raw.forEach((b) => seen.set(b.text, (seen.get(b.text) ?? 0) + 1));
    return raw.map((b, i) => {
      const repeat = (seen.get(b.text) ?? 0) >= 2;
      const next = raw[i + 1];
      return {
        ...b,
        repeat,
        punch: repeat || b.em <= punchMaxEm,
        // 次の語が来たら追い出す。最後の語は少し残してから抜ける
        outAt: next ? Math.max(b.at + (IN_F + 2) / fps, next.at) : b.at + 1.9,
        idx: i,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, sectionFrom, punchMaxEm, IN_F, fps]);

  const boxes: { x: number; y: number; w: number; h: number; a: number; b: number }[] = [];
  const layout = blocks.map((B) => {
    const r = (n: number) => seeded(p.seed * 97 + B.idx * 37 + n);
    const cap = B.punch
      ? Math.min((p.capPct * 3.4 * height) / 100, (width * (B.units.some((u) => /[\x00-\x7F]/.test(u)) ? 0.97 : 1.02)) / Math.max(0.9, B.em)) * scale
      : ((p.capPct * 0.82) / 100) * height * scale;

    let cx = 0;
    let cy = 0;
    const glyphs = B.units.map((ch, ci) => {
      const mix = B.punch ? [1.0, 0.9, 0.96, 0.86][ci % 4] : [1.0, 0.78, 0.92, 0.84][ci % 4];
      const size = cap * mix * (0.97 + r(20 + ci) * 0.06);
      const gx = cx;
      const gy = cy;
      const ulen = Array.from(ch).length;
      cx += size * (/[\x00-\x7F]/.test(ch) ? 0.56 * ulen : 0.98);
      cy += size * (B.punch ? 0.1 : 0.3);
      return { ch, size, gx, gy };
    });
    const spanW = cx;
    const spanH = cy + glyphs[glyphs.length - 1].size;

    let x: number;
    let y: number;
    if (B.punch) {
      x = (width - spanW) / 2; // 中央
      y = (height - spanH) / 2 + (r(4) - 0.5) * height * 0.1;
    } else {
      const maxX = Math.max(0.03 * width, width * 0.62 - spanW);
      x = Math.min(Math.max((0.04 + r(2) * 0.16) * width, 0.03 * width), maxX);
      y = Math.min(Math.max((0.3 + r(1) * 0.55) * height, 0.03 * height), height * 0.94 - spanH);
      const hits = (a: { x: number; y: number; w: number; h: number }) =>
        boxes.some((b) => {
          if (B.outAt <= b.a || b.b <= B.at) return false; // 時間が重ならない語は無視
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          return ox > 0 && oy > 0 && (ox * oy) / Math.min(a.w * a.h, b.w * b.h) > 0.2;
        });
      for (let s2 = 0; s2 < 14 && hits({ x, y, w: spanW, h: spanH }); s2++) {
        y = Math.min(
          Math.max(y + spanH * 0.55 * (s2 % 2 === 0 ? 1 : -1) * Math.ceil((s2 + 1) / 2), 0.03 * height),
          height * 0.94 - spanH
        );
      }
      boxes.push({ x, y, w: spanW, h: spanH, a: B.at, b: B.outAt });
    }

    // 出入りのアニメーションをブロックごとに引く＝常に違う入れ替わり方になる
    const { inKey, outKey } = pickAnim(r);
    const rot = (B.idx % 2 ? -1 : 1) * (B.punch ? 1 + r(3) * 4 : 3 + r(3) * 8);
    return { ...B, glyphs, spanW, spanH, x, y, rot, inKey, outKey };
  });

  // 今の層に属するブロックだけ描く。
  // punch は画面を占有するので**同時に出すのは最新の1つだけ**。
  // （House Arrest のタイトル2ヒットのように punch が時間的に重なると重なって潰れる）
  let mine = layout.filter((L) => (layer === 'front' ? !L.punch : L.punch));
  if (layer !== 'front') {
    const live = mine.filter((L) => t >= L.at && t <= L.outAt + OUT_F / fps);
    mine = live.length ? [live.reduce((a, b) => (b.at > a.at ? b : a))] : [];
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {mine.map((L) => {
        const outEnd = L.outAt + OUT_F / fps;
        if (t < L.at || t > outEnd) return null;
        const outP =
          t <= L.outAt
            ? 0
            : interpolate(t, [L.outAt, outEnd], [0, 1], {
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.4, 0, 1, 1),
              });
        const OUT = OUTS[L.outKey];
        const IN = INS[L.inKey];

        return (
          <div key={L.key} style={{ position: 'absolute', left: L.x, top: L.y }}>
            {L.glyphs.map((g, ci) => {
              const s0 = t - L.at - (ci * UNIT_STAGGER) / fps;
              if (s0 < 0) return null;
              const inP = interpolate(s0, [0, IN_F / fps], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.1, 0.85, 0.18, 1),
              });
              const a = outP > 0 ? OUT(outP, g.size) : IN(inP, g.size);
              // 手前にいる間だけ落ちる影（奥行きの手がかり）
              const near = outP > 0 ? 0 : 1 - inP;
              const shadow =
                near > 0.02
                  ? `drop-shadow(${g.size * 0.09 * near}px ${g.size * 0.12 * near}px ${
                      g.size * 0.05 * near
                    }px rgba(6,0,24,${0.5 * near}))`
                  : '';
              // 手前に出す語は分離用の薄い影を残す（読ませるため）
              const sep =
                layer === 'front'
                  ? `drop-shadow(${g.size * 0.02}px ${g.size * 0.03}px ${g.size * 0.03}px rgba(6,0,24,0.35))`
                  : '';
              return (
                <span
                  key={ci}
                  style={{
                    position: 'absolute',
                    left: g.gx,
                    top: g.gy,
                    transform: `${a.tf} rotate(${L.rot}deg)`,
                    transformOrigin: 'center center',
                    opacity: a.opacity,
                    filter: [a.blur > 0.2 ? `blur(${a.blur}px)` : '', shadow, sep].filter(Boolean).join(' ') || 'none',
                    fontFamily: GFONT,
                    fontWeight: 900,
                    fontSize: g.size,
                    lineHeight: 1,
                    whiteSpace: 'pre',
                    ...paintFor(p.material, g.size),
                  }}
                >
                  {g.ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const BURN_IN_TREATMENTS: Treatment[] = [
  {
    id: 'burn-in.quiet-vertical',
    style: 'burn-in',
    name: '縦書き小・画面端（静・白ベタ）',
    record: 'negative-space',
    fits: ['intro', 'verse'],
    textLen: [4, 16],
    description: 'Aメロ型。キャラの余白に1行だけ縦に落とす。白の単色ベタ・装飾ゼロ。',
    component: QuietVertical,
  },
  {
    id: 'burn-in.quiet-center',
    style: 'burn-in',
    name: '横書き小・下寄せ（静・黄ベタ）',
    record: 'subtitle-caption-ui',
    fits: ['intro', 'verse', 'pre', 'outro'],
    textLen: [4, 24],
    description: 'Bメロ型。下部に小さく1行、文字高は画面の7%。黄の単色ベタ・装飾ゼロ。',
    component: QuietCenter,
  },
  {
    id: 'burn-in.word-stack',
    style: 'burn-in',
    scope: 'section',
    layered: true,
    name: 'ワードスタック（動・黄ベタ）',
    record: 'beat-word-stack',
    fits: ['chorus', 'drop'],
    textLen: [4, 24],
    description:
      'サビ型。1拍1文節が約7倍で飛び込み5フレームで縮小着地、消えずに積もる。文節内は文字ごとにサイズが落ちて階段状に右下へ流れる。material:prism でラスサビ昇格（動き同一）。',
    component: WordStack,
  },
  {
    id: 'burn-in.hold-dark',
    style: 'burn-in',
    name: '暗転＋小1行（タメ・白ベタ）',
    record: 'progressive-blackout',
    fits: ['bridge', 'inst', 'pre'],
    textLen: [2, 16],
    description: '画面を落として1行だけ残す。次の爆発の落差を作る溜め。白の単色ベタ・装飾ゼロ。',
    component: HoldDark,
  },
];

registerTreatments(...BURN_IN_TREATMENTS);
