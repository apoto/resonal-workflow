/** sky-keyvisual の3部品（ベクターライン / 破線ドット / 軌道サークル）。
 *  SkyKeyvisualStage からは呼んでいない（描き込まれた2Dイラスト背景の上では画面のノイズになるため）。
 *  背景が単純（単色グラデ等）なときに OverlayBack / OverlayFront を Stage に足して使う。
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PAL } from './Field';

/** ===== ③オーバーレイ（モーショングラフィックス）=====
 *  sky-keyvisual の3部品を「会場」の題材に読み替えたもの:
 *    軌道サークル → 時計の文字盤（落ちサビで逆回転）
 *    太い白ベクターライン → 床の誘導ライン（+ 非常口グリーンを1本だけ差す）
 *    斜めの破線ドット → 畳まれるケーブル / シャッターの筋
 *
 *  地が高明度なので線は「白」ではなく「濃いインク」で描く。
 */

/** 時計の文字盤（常時回転＝完全静止フレームを作らない） */
const ClockRings: React.FC<{ t: number; density: number; reverse?: boolean; ink: string }> = ({
  t, density, reverse, ink,
}) => {
  const dir = reverse ? -1 : 1;
  const rot = t * 9 * dir;            // 秒針相当（ゆっくり回り続ける）
  const rot2 = t * 2.2 * -dir;        // 外周は逆向きにゆっくり
  const rings = [230, 360, 500, 640];
  return (
    <AbsoluteFill style={{ opacity: 0.18 + density * 0.42 }}>
      <svg viewBox="0 0 1400 1400"
        style={{
          position: 'absolute', left: '50%', top: '50%', width: 1400, height: 1400,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        }}>
        {rings.map((r, i) => (
          <circle key={i} cx={700} cy={700} r={r} fill="none" stroke={ink}
            strokeWidth={i % 2 === 0 ? 2 : 4}
            strokeDasharray={i % 2 === 0 ? '2 24' : `${r * 1.05} ${r * 4.6}`}
            opacity={0.75} />
        ))}
      </svg>
      {/* 目盛り＝文字盤（60分割・5本ごとに長い） */}
      <svg viewBox="0 0 1400 1400"
        style={{
          position: 'absolute', left: '50%', top: '50%', width: 1400, height: 1400,
          transform: `translate(-50%, -50%) rotate(${rot2}deg)`,
        }}>
        {[...Array(60)].map((_, i) => {
          const big = i % 5 === 0;
          const a = (i / 60) * Math.PI * 2;
          const r0 = big ? 596 : 620;
          const r1 = 640;
          return (
            <line key={i}
              x1={700 + Math.cos(a) * r0} y1={700 + Math.sin(a) * r0}
              x2={700 + Math.cos(a) * r1} y2={700 + Math.sin(a) * r1}
              stroke={ink} strokeWidth={big ? 5 : 2} opacity={big ? 0.8 : 0.45} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** 斜めに走る破線（畳まれるケーブル / シャッターの筋） */
const RunningDashes: React.FC<{ t: number; density: number; ink: string; vertical?: boolean }> = ({
  t, density, ink, vertical,
}) => {
  const off = -(t * 190) % 460;
  const lines = vertical
    ? [{ p: 300, w: 5 }, { p: 980, w: 3 }, { p: 1600, w: 4 }]
    : [{ p: 210, w: 5 }, { p: 560, w: 3 }, { p: 880, w: 4 }];
  return (
    <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0, opacity: 0.15 + density * 0.35 }}>
      <g transform={vertical ? 'rotate(0 960 540)' : 'rotate(-13 960 540)'}>
        {lines.map((l, i) =>
          vertical ? (
            <line key={i} x1={l.p} y1={-200} x2={l.p} y2={1280} stroke={ink} strokeWidth={l.w}
              strokeDasharray="5 28" strokeDashoffset={off} opacity={0.6} />
          ) : (
            <line key={i} x1={-200} y1={l.p} x2={2200} y2={l.p} stroke={ink} strokeWidth={l.w}
              strokeDasharray="5 28" strokeDashoffset={off} opacity={0.6} />
          )
        )}
      </g>
    </svg>
  );
};

/** 画面を切る太いライン（1本だけ非常口グリーン） */
const VectorLines: React.FC<{ density: number; ink: string }> = ({ density, ink }) => {
  const n = Math.round(density * 3);
  const defs = [
    { x1: -100, y1: 880, x2: 2100, y2: 700, w: 14, c: ink, o: 0.85 },
    { x1: -100, y1: 250, x2: 2100, y2: 420, w: 8, c: ink, o: 0.5 },
    { x1: -100, y1: 1010, x2: 2100, y2: 960, w: 10, c: PAL.exit, o: 0.9 },
  ];
  return (
    <svg viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      {defs.slice(0, n).map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={l.c} strokeWidth={l.w} strokeLinecap="round" opacity={l.o * (0.35 + density * 0.65)} />
      ))}
    </svg>
  );
};

export const OverlayBack: React.FC<{
  t: number; density: number; reverse?: boolean; onDark: boolean;
}> = ({ t, density, reverse, onDark }) => {
  const ink = onDark ? '#ffffff' : PAL.ink;
  return (
    <AbsoluteFill>
      <ClockRings t={t} density={density} reverse={reverse} ink={ink} />
    </AbsoluteFill>
  );
};

export const OverlayFront: React.FC<{
  t: number; density: number; onDark: boolean; vertical?: boolean;
}> = ({ t, density, onDark, vertical }) => {
  const ink = onDark ? '#ffffff' : PAL.ink;
  return (
    <AbsoluteFill>
      <VectorLines density={density} ink={ink} />
      <RunningDashes t={t} density={density} ink={ink} vertical={vertical} />
    </AbsoluteFill>
  );
};
