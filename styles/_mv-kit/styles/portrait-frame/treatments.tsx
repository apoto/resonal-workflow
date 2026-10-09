import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { Treatment, TreatmentProps, registerTreatments } from '../../src/registry';
import { Role, VerticalLine, fontFor, lineUnits, pal } from './engine';

/**
 * portrait-frame の歌詞 treatment。
 *
 * plate-swap の wipe-in-persist（横に刷り出して3秒残して1フレーム一掃）と同じ「出て残る」族だが、
 * こちらは**溜める**のが本体。burn-in の kinetic-swap（入れ替わる）とは別型。
 *
 * ★layer='front' 固定。portrait-frame は不透過の面＋立ち絵の上に文字を置くので、
 *   behind に置くと面と立ち絵で丸ごと消える。
 */

const fitCap = (charCount: number, capPct: number, maxPct = 78) => {
  const need = charCount * capPct * 1.14; // lineHeight 1.0 + letterSpacing 0.12 ぶん
  return need > maxPct ? (capPct * maxPct) / need : capPct;
};

const P = (params: Record<string, unknown>) => ({
  role: (params.role as Role) ?? 'read',
  /** 文字高（画面高に対する%） */
  capPct: (params.capPct as number) ?? 9,
  /** 1行目の右端位置（画面幅に対する%。右から左へ積むので大きいほど右） */
  x: (params.x as number) ?? 86,
  /** 行頭の上端位置（%） */
  y: (params.y as number) ?? 14,
  /** 行の間隔（文字高に対する倍率） */
  gap: (params.gap as number) ?? 1.55,
  /** 1行が出切るまでの秒 */
  writeSec: (params.writeSec as number) ?? 0.34,
  /** 行ごとに下へずらす量（%）。0で天端揃え。階段状にすると"積んだ"感じが出る */
  step: (params.step as number) ?? 4,
  /** アクセント色で刷る行のインデックス（0始まり）。空なら全部 ink */
  accentLines: (params.accentLines as number[]) ?? [],
  tone: (params.tone as string) ?? 'ink',
});

// -------------------------------------------------- vertical-stack（動側の主砲）

/**
 * 縦書きの行が右から左へ**積み上がり**、セクション終わりで一掃される。
 *
 * scope='section'。行の出入りを treatment 側で管理する（積む型はセクション全体を見ないと作れない）。
 * 一掃は**1フレームのハードカット**（参照実測でも面積が1フレームで0になっていた）。
 */
const VerticalStack: React.FC<TreatmentProps> = ({ lines, local, sectionFrom, params, scale, palette }) => {
  const { fps, height } = useVideoConfig();
  const p = P(params);
  const t = local / fps;
  const size = (p.capPct / 100) * height * scale;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {lines.map((line, i) => {
        const rel = line.t - sectionFrom;      // セクション頭からの相対秒
        if (t < rel) return null;              // まだ出ていない
        // ★一掃: 行の t+hold ではなく「セクション最終行の終わり」で全部消す＝ブロック消去
        const reveal = Math.min(1, (t - rel) / p.writeSec);
        const lp = line.params ?? {};
        const localScale = (lp.scale as number) ?? 1;
        const accent = p.accentLines.includes(i) || Boolean(lp.accent);
        const chars = lineUnits(line.text);
        // 積む型は上端が階段状に下がるので、その分だけ使える高さが減る
        const cap = fitCap(chars, p.capPct * localScale, 88 - (p.y + i * p.step));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: `${100 - p.x + i * (p.gap * (p.capPct / 100) * 100)}%`,
              top: `${p.y + i * p.step}%`,
            }}
          >
            <VerticalLine
              text={line.text}
              size={(cap / 100) * height * scale}
              color={pal(palette, accent ? 'accent' : p.tone)}
              role={p.role}
              reveal={reveal}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// -------------------------------------------------- vertical-wipe（静側の主役）

/**
 * 1行ずつ縦に刷り出して数秒残し、次の行が来たら前の行は消える（積まない）。
 * Verse の静側で使う。積む型（VerticalStack）と交互に使うことで**静↔動の振り子**を作る
 * （mv-production.md 骨格検査①: 中間を作らない）。
 */
const VerticalWipe: React.FC<TreatmentProps> = ({ lines, local, params, scale, palette }) => {
  const line = lines[0];
  const { fps, height } = useVideoConfig();
  const p = P(params);
  const t = local / fps;
  const size = (p.capPct / 100) * height * scale;
  const lp = line.params ?? {};
  const chars = lineUnits(line.text);
  const cap = fitCap(chars, p.capPct * (((lp.scale as number) ?? 1)), 88 - (((lp.y as number) ?? p.y)));
  const reveal = Math.min(1, t / p.writeSec);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: `${100 - p.x}%`,
          top: `${(lp.y as number) ?? p.y}%`,
        }}
      >
        <VerticalLine
          text={line.text}
          size={(cap / 100) * height * scale}
          color={pal(palette, lp.accent ? 'accent' : p.tone)}
          role={p.role}
          reveal={reveal}
        />
      </div>
    </AbsoluteFill>
  );
};

// -------------------------------------------------- center-mark（キメの1語）

/**
 * 画面中央に短い語を1つだけ、横書きで大きく置く。
 * 縦書きを崩す唯一の区間（Post-Chorus の "blank, blank" 等の英字フック）。
 */
const CenterMark: React.FC<TreatmentProps> = ({ lines, local, params, scale, palette }) => {
  const line = lines[0];
  const { fps, height } = useVideoConfig();
  const p = P(params);
  const t = local / fps;
  const size = (((params.capPct as number) ?? 18) / 100) * height * scale;
  const reveal = Math.min(1, t / 0.12);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          fontSize: size,
          letterSpacing: size * 0.06,
          color: pal(palette, (line.params?.accent as boolean) ? 'accent' : p.tone),
          opacity: reveal,
          whiteSpace: 'nowrap',
          ...fontFor('display'),
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
};

const defs: Treatment[] = [
  {
    id: 'portrait-frame.vertical-stack',
    scope: 'section',
    layer: 'front',
    style: 'portrait-frame',
    name: '縦書きの積み上げ',
    record: 'beat-word-stack',
    fits: ['chorus', 'drop', 'bridge'],
    textLen: [4, 20],
    description:
      '縦書きの行が右から左へ積み上がり、セクション終わりで1フレーム一掃。動側の主砲。参照=抜錨系の蓄積と消去。',
    component: VerticalStack,
  },
  {
    id: 'portrait-frame.vertical-wipe',
    layer: 'front',
    style: 'portrait-frame',
    name: '縦書きの刷り出し（積まない）',
    record: 'wipe-in-persist-type',
    fits: ['intro', 'verse', 'pre', 'outro'],
    textLen: [4, 22],
    description: '1行ずつ縦に刷り出して残し、次の行で消える。静側の主役。積む型と交互に使って振り子を作る。',
    component: VerticalWipe,
  },
  {
    id: 'portrait-frame.center-mark',
    layer: 'front',
    style: 'portrait-frame',
    name: '中央の1語（横書き）',
    record: 'kinetic-typography',
    fits: ['inst', 'drop', 'chorus'],
    textLen: [1, 12],
    description: '画面中央に短い語を横書きで大きく置く。縦書きを崩す唯一の区間（英字フック用）。',
    component: CenterMark,
  },
];

registerTreatments(...defs);
export const portraitFrameTreatments = defs;
