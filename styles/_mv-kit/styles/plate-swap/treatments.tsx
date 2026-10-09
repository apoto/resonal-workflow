import React from 'react';
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from 'remotion';
import { Treatment, TreatmentProps, registerTreatments } from '../../src/registry';
import { Face, NcMaterial, NcPaletteKey, fitSize, fontFor, pal, paintFor } from './engine';

/**
 * plate-swap の歌詞 treatment。
 *
 * 参照の「蓄積と消去」実測（黄マスクの面積をフレーム毎に追った結果）:
 *   ・**出てくる**  : 面積が 0 → 0.46% → 1.38% と約0.3秒で立ち上がる。1フレームで全部出ない
 *   ・その後 約3秒 残り、ゆっくり縮む／流れる
 *   ・**一掃は1フレームのハードカット**（面積が1フレームで0になる）
 *   ・キメで**1フレームおきの点滅**（12.6-13.1s と 19.5-20.0s の2箇所で確認）
 *
 * burn-in の kinetic-swap とは別の型。あちらは**入れ替わる**、こちらは**出て残る**。
 */

const P = (params: Record<string, unknown>) => ({
  material: (params.material as NcMaterial) ?? 'bright',
  face: (params.face as Face) ?? 'gothic',
  /** 文字高。画面高に対する % */
  capPct: (params.capPct as number) ?? 16,
  /** 縦書きにするか */
  vertical: Boolean(params.vertical),
  /** 出切るまでの秒（実測 約0.3秒） */
  writeSec: (params.writeSec as number) ?? 0.3,
  /** 傾き（度） */
  tilt: (params.tilt as number) ?? 0,
  x: (params.x as number) ?? 8,
  y: (params.y as number) ?? 30,
  /** x を行の**中心**として扱う（既定は左端） */
  center: Boolean(params.center),
  /** サビのキメ。palette の別の色に振り替える（装飾は足さない＝単色ベタのまま） */
  accent: Boolean(params.accent),
  accentKey: (params.accentKey as NcPaletteKey) ?? 'glow',
  /** 行の右端（左端）に残す余白。画面幅に対する % */
  margin: (params.margin as number) ?? 6,
  /** 1行に収めるために縮めてよい下限（要求サイズに対する比）。これを下回るなら行を折る */
  minRatio: (params.minRatio as number) ?? 0.7,
  /** 折ってよい最大行数。1 にすると絶対に折らない */
  maxRows: (params.maxRows as number) ?? 2,
  /**
   * 行の割り方。
   *   'auto'（既定）… 幅に収まらないときだけ折る
   *   'all'          … **空白のたびに折って縦に積む**（参照の雰囲気＝短い句を左に積む）
   */
  stack: (params.stack as 'auto' | 'all') ?? 'auto',
  /** 積んだ行の間隔（文字高に対する倍率） */
  rowGap: (params.rowGap as number) ?? 0.5,
  /** キメの点滅（1フレームおき）を掛ける秒数。0で無効 */
  flickerSec: (params.flickerSec as number) ?? 0,
});

/**
 * 1行で幅に収まらないとき、空白で2行（maxRows まで）に折る。
 * ★縮めるだけだと縦ショートで字が小さすぎて読めない（1080幅で13文字＝73px になった）。
 * 折り位置は**真ん中に最も近い空白**。空白が無い行は折らない（日本語は空白で分かち書きしてある前提）。
 */
const wrapRows = (
  text: string,
  want: number,
  avail: number,
  minRatio: number,
  maxRows: number,
  stack: 'auto' | 'all' = 'auto',
): string[] => {
  if (maxRows <= 1) return [text];
  if (stack === 'all') {
    // 空白のたびに割る。maxRows を超える分は最後の行にまとめる
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [text];
    if (parts.length <= maxRows) return parts;
    return [...parts.slice(0, maxRows - 1), parts.slice(maxRows - 1).join(' ')];
  }
  if (fitSize(want, text, avail) >= want * minRatio) return [text];   // 1行で足りている
  const sp: number[] = [];
  Array.from(text).forEach((c, i) => { if (/\s/.test(c)) sp.push(i); });
  if (!sp.length) return [text];
  const mid = text.length / 2;
  const at = sp.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), sp[0]);
  return [text.slice(0, at), text.slice(at + 1)];
};

/**
 * 1文字ずつ「進行方向のワイプ」で刷り上がる。
 * 参照は1フレーズ0.3秒で立ち上がるので、6文字なら1文字0.05秒＝1.5フレーム。
 */
const WipeIn: React.FC<TreatmentProps> = ({ lines, local, params, scale, palette }) => {
  const line = lines[0];
  const { fps, width, height } = useVideoConfig();
  const p = P(params);
  const t = local / fps;
  // 縦書きは空白を詰めるが、横書きでは**空白を残す**。
  // 一律に除去すると "still here" が "stillhere" になった（実際なった）。
  const chars = p.vertical ? Array.from(line.text.replace(/\s+/g, '')) : Array.from(line.text);
  // 横書きは使える幅に収まるまで縮める（縦書きは高さが効くので幅フィットは掛けない）。
  // center は x を中心とみなすので、左右で狭い側の2倍が使える幅。
  const avail = p.center
    ? width * 2 * (Math.min(p.x, 100 - p.x) - p.margin) / 100
    : width * (1 - (p.x + p.margin) / 100);
  const want = (p.capPct / 100) * height * scale;

  const rows = p.vertical ? [line.text] : wrapRows(line.text, want, avail, p.minRatio, p.maxRows, p.stack);
  const size = p.vertical
    ? want
    : Math.min(want, ...rows.map((r) => fitSize(want, r, avail)));

  const per = p.writeSec / Math.max(1, chars.length); // 1文字ぶんの間隔
  const wipe = Math.max(per * 1.6, 0.05); // 1文字を出し切る時間

  // 出切ったあと、ゆっくり縮んで流れる（参照は面積が徐々に減っていた）
  const settle = Math.max(0, t - p.writeSec);
  const shrink = 1 - Math.min(0.1, settle * 0.03);
  const driftX = -settle * width * 0.004;

  // キメの点滅: 1フレームおきに出す/消す
  // ★点滅も**秒**で決める（フレーム番号だと fps を変えた瞬間に周期が変わる）。
  //   参照の実測は「1フレームおき＝30fpsで15Hz」なので、fps に依らず 15Hz にする。
  const flick = p.flickerSec > 0 && t < p.flickerSec ? (Math.floor(t * 30) % 2 === 0 ? 1 : 0) : 1;
  if (flick === 0) return null;

  // accent は palette の別の色に振り替えるだけ（縁・影・グローは足さない＝スタイルの文法を守る）
  const paint: React.CSSProperties = p.accent
    ? { color: pal(palette, p.accentKey) }
    : paintFor(p.material, palette);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: `${p.y}%`,
          display: 'flex',
          // 折ったときは行を縦に積む（1行なら見た目は従来どおり）
          flexDirection: 'column',
          // 左寄せのときは行頭を揃える（中央寄せのときだけ中央）
          alignItems: p.vertical ? 'center' : p.center ? 'center' : 'flex-start',
          rowGap: rows.length > 1 ? size * p.rowGap : 0,
          transform: `translateX(${p.center ? '-50%' : '0px'}) translateX(${driftX}px) scale(${shrink}) rotate(${p.tilt}deg)`,
          transformOrigin: p.center ? 'center top' : 'left top',
          fontSize: size,
          lineHeight: p.vertical ? 1.02 : 1,
          whiteSpace: 'pre',
          ...fontFor(p.face, 'read'),
        }}
      >
        {(p.vertical ? [chars] : rows.map((r) => Array.from(r))).map((rowChars, ri, all) => (
        <div
          key={`r${ri}`}
          style={{
            display: 'flex',
            flexDirection: p.vertical ? 'column' : 'row',
            alignItems: p.vertical ? 'center' : 'flex-end',
          }}
        >
        {rowChars.map((ch, ci) => {
          // ワイプの順番は行を跨いで通し番号（折っても左上から順に刷り上がる）
          const i = all.slice(0, ri).reduce((n, r) => n + r.length + 1, 0) + ci;
          const s0 = t - i * per;
          const k = interpolate(s0, [0, wipe], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.3, 0.8, 0.4, 1),
          });
          if (/^\s$/.test(ch)) {
            return <span key={ci} style={{ display: 'inline-block', width: size * 0.32 }} />;
          }
          if (k <= 0) {
            return (
              <span key={ci} style={{ visibility: 'hidden', ...paint }}>
                {ch}
              </span>
            );
          }
          const dir = p.vertical
            ? `inset(0 0 ${(1 - k) * 100}% 0)` // 上→下
            : `inset(0 ${(1 - k) * 100}% 0 0)`; // 左→右
          return (
            <span key={ci} style={{ clipPath: dir, display: 'inline-block', ...paint }}>
              {ch}
            </span>
          );
        })}
        </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 黄ベタ面に置く極太の抜き文字。転換のキメ。 */
const InkPunch: React.FC<TreatmentProps> = ({ lines, local, params, scale, palette }) => {
  const line = lines[0];
  const { fps, width, height } = useVideoConfig();
  const p = P({ ...params, capPct: (params.capPct as number) ?? 34 });
  const t = local / fps;
  const k = interpolate(t, [0, 0.12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 出た直後にわずかに詰める（極太は動かないと版に見える）
  const s = 1 + 0.03 * Math.exp(-Math.max(0, t - 0.12) * 6);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          fontSize: fitSize(
            (p.capPct / 100) * height * scale,
            line.text,
            width * (1 - (p.margin * 2) / 100),
          ),
          lineHeight: 1,
          whiteSpace: 'pre',
          transform: `scale(${s})`,
          clipPath: `inset(0 ${(1 - k) * 100}% 0 0)`,
          ...fontFor(p.face, 'display'),
          ...paintFor((params.material as NcMaterial) ?? 'ink', palette),
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
};

/** 高キー面に置く小さな副次の文字（静の極） */
const SmallGray: React.FC<TreatmentProps> = ({ lines, local, params, scale, palette }) => {
  const line = lines[0];
  const { fps, width, height } = useVideoConfig();
  const p = P({ ...params, capPct: (params.capPct as number) ?? 3.4 });
  const t = local / fps;
  const op = interpolate(t, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: `${p.x}%`,
          top: `${p.y}%`,
          fontSize: fitSize(
            (p.capPct / 100) * height * scale,
            line.text,
            // letterSpacing 0.08em ぶんを幅の見積もりから差し引く
            (width * (1 - (p.x + p.margin) / 100)) / 1.08,
          ),
          lineHeight: 1.9,
          letterSpacing: '0.08em',
          opacity: op,
          textAlign: 'right',
          ...fontFor(p.face, 'read'),
          ...paintFor('muted', palette),
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  );
};

const Credits: React.FC<TreatmentProps> = ({ lines, local, params, scale, sectionFrom, palette }) => {
  const { fps, height } = useVideoConfig();
  const t = local / fps;
  const p = P({ ...params, capPct: (params.capPct as number) ?? 4.4 });
  const fade = (params.fadeSec as number) ?? 0.5;

  // 名前サイズは 1080p で ≥36px、ラベルはその 0.52 倍（≥18px）
  const nameSize = Math.max(36 * scale, (p.capPct / 100) * height * scale);
  const labelSize = nameSize * 0.52;

  const items = lines.map((l) => {
    const rel = l.t - sectionFrom;
    const sp = l.text.lastIndexOf(' ');
    // 「Label: Name」「Produced by Name」はラベル/名前の2段。それ以外（ユニット名など）は名前だけ
    const known = /^(.+?):\s*(.+)$/.exec(l.text) ?? /^(.*?\bby)\s+(.+)$/.exec(l.text);
    return {
      label: known ? known[1] : '',
      name: known ? known[2] : l.text,
      op: interpolate(t, [rel - fade, rel, rel + l.hold, rel + l.hold + fade], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
      key: l.t,
      sp,
    };
  });

  // スクリムは全区間（最初の行のフェードイン前〜最後の行のフェードアウト後）で出しっぱなし
  const first = lines[0].t - sectionFrom;
  const last = lines[lines.length - 1];
  const scrim = interpolate(
    t,
    [first - fade, first, last.t - sectionFrom + last.hold, last.t - sectionFrom + last.hold + fade],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '22%',
          opacity: scrim,
          background: `linear-gradient(to top, ${pal(palette, 'sky')}D9, transparent)`,
        }}
      />
      {items.map((it) => (
        <div
          key={it.key}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `${(params.bottom as number) ?? 6}%`,
            textAlign: 'center',
            opacity: it.op,
            ...fontFor(p.face, 'read'),
            ...paintFor('bright', palette),
          }}
        >
          {it.label ? (
            <div style={{ fontSize: labelSize, lineHeight: 1.5, letterSpacing: '0.14em', opacity: 0.8 }}>
              {it.label}
            </div>
          ) : null}
          <div style={{ fontSize: nameSize, lineHeight: 1.2, letterSpacing: '0.04em' }}>{it.name}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const PLATE_SWAP_TREATMENTS: Treatment[] = [
  {
    id: 'plate-swap.wipe-in',
    // ★実際に解釈するキー。lint が scene の未解釈 params を警告する土台（registry.paramKeys）
    paramKeys: ['material', 'face', 'capPct', 'vertical', 'writeSec', 'tilt', 'x', 'margin', 'center', 'accentKey', 'flickerSec', 'minRatio', 'maxRows', 'stack', 'rowGap'],
    style: 'plate-swap',
    layered: false,
    // 実測: 面 ＜ キャラ ＜ 文字。背面に置くと不透過プレートで文字が消える
    layer: 'front',
    name: '極太ゴシックが刷り上がる（手前）',
    record: 'wipe-in-persist-type',
    fits: ['intro', 'verse', 'pre', 'chorus', 'bridge', 'outro'],
    textLen: [2, 14],
    description:
      '要求 capPct が行幅に収まらなければ**自動で縮む**（margin で余白%）。center で x を行の中心に、accent で palette の別色（既定 glow）に振り替え。実測どおり約0.3秒で1文字ずつ進行方向にワイプして出て、約3秒残ってゆっくり縮み、1フレームで一掃。vertical で縦書き、flickerSec でキメの1フレーム点滅、face=pop で丸ポップ体に差し替え。装飾は一切足さない（単色ベタ）。',
    component: WipeIn,
  },
  {
    id: 'plate-swap.ink-punch',
    // ★実際に解釈するキー。lint が scene の未解釈 params を警告する土台（registry.paramKeys）
    paramKeys: ['material', 'face', 'capPct', 'vertical', 'writeSec', 'tilt', 'x', 'margin', 'center', 'accentKey', 'flickerSec', 'minRatio', 'maxRows', 'stack', 'rowGap'],
    style: 'plate-swap',
    layer: 'front',
    name: 'ベタ面の抜き文字（中央・極大）',
    record: 'negative-space',
    fits: ['pre', 'drop', 'bridge'],
    textLen: [1, 8],
    description:
      '単色ベタ面に ink 色で極大の短い語を抜く。転換のキメ。左→右に一気にワイプし、直後にわずかに詰まる。',
    component: InkPunch,
  },
  {
    id: 'plate-swap.credits',
    // ★実際に解釈するキー。lint が scene の未解釈 params を警告する土台（registry.paramKeys）
    paramKeys: ['face', 'capPct', 'fadeSec', 'bottom'],
    style: 'plate-swap',
    scope: 'section',
    layer: 'front',
    name: 'クレジット3点（下スクリム・中央・2段組）',
    record: 'subtitle-caption-ui',
    fits: ['intro', 'outro'],
    textLen: [2, 24],
    description:
      'クレジット（credits の行）を画面下部中央に2段組（ラベル/名前）で出す。スクリムは全区間で出しっぱなし。行は「Vocal: NAME」のようにラベル込みで書く。',
    component: Credits,
  },
  {
    id: 'plate-swap.small-gray',
    // ★実際に解釈するキー。lint が scene の未解釈 params を警告する土台（registry.paramKeys）
    paramKeys: ['material', 'face', 'capPct', 'vertical', 'writeSec', 'tilt', 'x', 'margin', 'center', 'accentKey', 'flickerSec', 'minRatio', 'maxRows', 'stack', 'rowGap'],
    style: 'plate-swap',
    layer: 'front',
    name: '高キー面の小さい副次文字（右寄せ）',
    record: 'subtitle-caption-ui',
    fits: ['intro', 'verse', 'inst', 'outro'],
    textLen: [2, 40],
    description: '高キー面に小さく muted 色で右寄せ。静の極。文字高は画面の3.4%。',
    component: SmallGray,
  },
];

registerTreatments(...PLATE_SWAP_TREATMENTS);
