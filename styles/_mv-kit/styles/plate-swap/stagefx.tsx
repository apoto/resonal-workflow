import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { StageFxDef, StageFxProps, registerStageFx } from '../../src/registry';
import { seeded } from './engine';

/**
 * plate-swap の StageFx（画面全体を包む層）。
 */
const useInside = (from: number, to: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return { t, inside: t >= from && t <= to };
};

/**
 * レターボックス＋歌詞側を締める地。
 *
 *   参照は①上下の黒帯で画面を横長に切り②細い内枠を引き③歌詞を暗い側に小さく置く。
 *   歌詞が読めるのは**装飾（縁・影）ではなく地が暗いから**＝engine の「装飾を足した瞬間に
 *   カラオケ字幕になる」を破らずに可読性を上げる唯一の手がこれ。
 *   だから scrim は**文字に付けるのではなく面に敷く**。
 *
 * params:
 *   bar     … 上下の黒帯の高さ（画面高に対する%）。既定 5
 *   barColor… 帯の色。既定 #000
 *   inset   … 内枠の線の太さ(px)。0 で枠なし
 *   scrim   … 歌詞側（既定=左）を締める量 0..1
 *   scrimTo … 'auto'（既定＝横は left / 縦は bottom）| 'left' | 'bottom'
 */
const Letterbox: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { inside } = useInside(from, to);
  const { width, height } = useVideoConfig();
  if (!inside) return <>{children}</>;
  const bar = (params.bar as number) ?? 5;
  const inset = (params.inset as number) ?? 0;
  const scrim = (params.scrim as number) ?? 0;
  const auto = width < height ? 'bottom' : 'left';
  const scrimTo = (params.scrimTo as string) === 'auto' || params.scrimTo === undefined
    ? auto
    : (params.scrimTo as string);
  // 帯は黒が正（palette に依らない＝「画面を切る」ための地）。曲で変えたいときだけ barColor を渡す
  const ink = (params.barColor as string) ?? '#000';

  const grad =
    scrimTo === 'bottom'
      ? `linear-gradient(to top, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,0) 46%)`
      : `linear-gradient(to right, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,0) 52%)`;

  return (
    <AbsoluteFill>
      {children}
      {scrim > 0 ? <AbsoluteFill style={{ background: grad, pointerEvents: 'none' }} /> : null}
      {bar > 0 ? (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${bar}%`, background: ink }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${bar}%`, background: ink }} />
        </>
      ) : null}
      {inset > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: `${bar / 2}%`,
            right: `${bar / 2}%`,
            top: `${bar + bar / 3}%`,
            bottom: `${bar + bar / 3}%`,
            border: `${inset}px solid rgba(255,255,255,0.16)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * ごく軽い走査線＋グレイン（`records/film-grain`）。
 *
 * ★弱くする（強いと「フィルタをかけた素人動画」になる）。既定は走査線6%・グレイン3%。
 * ★走査線もごく低速で下へ流す（VHS のトラッキング）。動かすのは1フレーム1px未満。
 *
 * params: line（走査線の濃さ0..1）/ period（走査線の周期px）/ grain（グレインの濃さ0..1）
 */
const Scanlines: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { t, inside } = useInside(from, to);
  if (!inside) return <>{children}</>;
  const line = (params.line as number) ?? 0.06;
  const period = (params.period as number) ?? 3;
  const grain = (params.grain as number) ?? 0.03;
  const grainHz = (params.grainHz as number) ?? 24;
  const tick = Math.floor(t * grainHz);
  const gx = Math.floor(seeded(tick) * 120);
  const gy = Math.floor(seeded(tick + 977) * 120);
  // 走査線はごく低速で下へ（1周 = period px を約1.1秒で）
  const sy = (t * period * 0.9) % period;
  return (
    <AbsoluteFill>
      {children}
      {line > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,${line}) 0px, rgba(0,0,0,${line}) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) ${period}px)`,
            backgroundPosition: `0px ${sy}px`,
          }}
        />
      ) : null}
      {grain > 0 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: grain,
            // 決定論的なタイル（フレーム毎に作り直さない＝ちらつかない）
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='1'/></svg>\")",
            backgroundRepeat: 'repeat',
            backgroundPosition: `${gx}px ${gy}px`,
            mixBlendMode: 'overlay',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * 打点＝**マゼンタのベタ面で1〜2フレーム抜く**（H1 発火 / H2 抜き方）。
 *
 * ★光過敏対策: 点滅は1秒3回以下。1曲で数回までに留める。
 *
 * params: at（**絶対秒**の配列）/ frames（1発の長さ・既定2）/ color（既定 palette の field 相当をここで渡す）
 */
const FieldPunch: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { inside } = useInside(from, to);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!inside) return <>{children}</>;
  const at = (params.at as number[] | undefined) ?? [];
  const dur = (params.frames as number) ?? 2;
  const color = (params.color as string) ?? '#FF2FD0';
  const t = frame / fps;
  const hit = at.some((sec) => {
    const d = (t - sec) * fps;
    return d >= 0 && d < dur;
  });
  return (
    <AbsoluteFill>
      {children}
      {hit ? <AbsoluteFill style={{ backgroundColor: color, pointerEvents: 'none' }} /> : null}
    </AbsoluteFill>
  );
};

/**
 * **CRT落ち**＝ブラウン管の電源を切ったときの消え方（`records/glitch-cut`）。
 *
 * 順番（実機の挙動をなぞる）:
 *   ① 画がわずかに明るくなって横に膨らむ（電源が落ちる瞬間の過渡）
 *   ② 縦が一気に潰れて**横一本の光の線**になる
 *   ③ 線が中央へ縮んで**点**になる
 *   ④ 点が消えて黒。残光がごく短く残る
 *
 * params: at（開始秒）/ dur（落ちるのにかける秒・既定 0.9）
 */
const CrtOff: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { t, inside } = useInside(from, to);
  if (!inside) return <>{children}</>;
  const at = (params.at as number) ?? to - 1.0;
  const dur = (params.dur as number) ?? 0.9;
  const k = (t - at) / dur;                    // 0 → 1
  if (k <= 0) return <>{children}</>;
  if (k >= 1) return <AbsoluteFill style={{ backgroundColor: '#000' }} />;

  // ①0〜0.18 膨らむ ②0.18〜0.55 縦に潰れる ③0.55〜0.85 横に縮む ④0.85〜1 消える
  const bulge = k < 0.18 ? 1 + 0.05 * Math.sin((k / 0.18) * Math.PI) : 1;
  const sy = k < 0.18 ? 1 : k < 0.55 ? Math.max(0.0025, 1 - (k - 0.18) / 0.37) : 0.0025;
  const sx = k < 0.55 ? bulge : Math.max(0.004, bulge * (1 - (k - 0.55) / 0.30));
  const glow = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.85) / 0.15);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          transform: `scaleX(${sx}) scaleY(${sy})`,
          transformOrigin: 'center center',
          // 潰れるほど白熱する（ブラウン管の線が白く光る）
          filter: `brightness(${1 + (1 - sy) * 2.2}) saturate(${Math.max(0.2, sy)})`,
          opacity: glow,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PLATE_SWAP_STAGEFX: StageFxDef[] = [
  {
    id: 'plate-swap.letterbox',
    style: 'plate-swap',
    name: 'レターボックス＋歌詞側を締める地',
    record: 'subtitle-caption-ui',
    description:
      '上下に黒帯（bar%）、任意で細い内枠（inset px）、歌詞側（scrimTo=left|bottom）に scrim を敷く。'
      + '★文字に縁や影を付けずに可読性を上げるための「地」側の手当て＝グリフには一切装飾しない。',
    component: Letterbox,
  },
  {
    id: 'plate-swap.scanlines',
    style: 'plate-swap',
    name: 'ごく軽い走査線＋グレイン（TV/VHSの装置）',
    record: 'film-grain',
    description:
      '走査線（line/period）とグレイン（grain）を弱く常時敷く。★効果ではなく「装置がテレビである」ことを画に出す層。'
      + '強くすると素人動画のフィルタに見えるので弱く。グレインは決定論的（ちらつかない）。',
    component: Scanlines,
  },
  {
    id: 'plate-swap.field-punch',
    style: 'plate-swap',
    name: '打点＝単色ベタ面で1〜2フレーム抜く',
    record: 'negative-invert',
    description:
      'at（絶対秒）で指定した瞬間だけ全画面を単色ベタで抜く。★撃つ秒を明示する設計＝全編に焚けない'
      + '（全編がけは落差が死ぬ）。光過敏対策で1秒3回以下に収めること。',
    component: FieldPunch,
  },
  {
    id: 'plate-swap.crt-off',
    style: 'plate-swap',
    name: 'CRT落ち（横一本の線→点→黒）',
    record: 'glitch-cut',
    description:
      'ブラウン管の電源を切ったときの消え方。膨らむ→縦に潰れて横一本の光の線→中央の点→黒。'
      + '★装置がテレビの曲の終わり方。at で落ち始める秒、dur で落ちるのにかける秒。',
    component: CrtOff,
  },
];

registerStageFx(...PLATE_SWAP_STAGEFX);
