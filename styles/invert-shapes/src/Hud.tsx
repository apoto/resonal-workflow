import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

const MONO = loadMono('normal', { weights: ['400', '700'], subsets: ['latin'], ignoreTooManyRequestsWarning: true })
  .fontFamily;

/**
 * HUDオーバーレイ。
 *
 * 使いどころ: **文字が無い区間（間奏・器楽ドロップ）に「数値と波形」という別種の情報を入れて画を持たせる。**
 * 採用は見た目でなく意味で決める（「計測器が異常を表示している画」が曲の題材と噛み合うときだけ）。
 *   意味的な接点が無い曲に飾りとして付けると浮くので、その場合は使わない。
 *
 * 守っていること:
 *  - 要素は**4つに絞る**（コーナーブラケット / ターゲットボックス / 縦目盛り＋数値 / 波形）＋キメの警告表示。全部盛りにしない
 *  - **色は1色に統一** → パレットに合わせて **紫 #8b3dff**（シアン/緑は使わない＝極彩色にしないため）
 *  - 不透明度 60〜80% ＋ 微グロー（「投影されている」質感）
 *  - **常時微動**（数値ローリング / レティクル呼吸 / 波形）＝1秒以上の完全静止を作らない
 *  - イベント同期: 拍でゲージが進み、区間の要所で WARNING が点滅（点滅は 6f ON / 6f OFF＝光過敏対策も満たす）
 */
const HUD = '#8b3dff';
const BPM = 138.3; // 曲の BPM に合わせる
const BAR = (60 / BPM) * 4;
const GRID0 = 0.85;

const Corner: React.FC<{ x: 'l' | 'r'; y: 't' | 'b'; s: number; w: number }> = ({ x, y, s, w }) => (
  <div
    style={{
      position: 'absolute',
      [x === 'l' ? 'left' : 'right']: '3.2%',
      [y === 't' ? 'top' : 'bottom']: '5.0%',
      width: s,
      height: s,
      borderTop: y === 't' ? `${w}px solid ${HUD}` : undefined,
      borderBottom: y === 'b' ? `${w}px solid ${HUD}` : undefined,
      borderLeft: x === 'l' ? `${w}px solid ${HUD}` : undefined,
      borderRight: x === 'r' ? `${w}px solid ${HUD}` : undefined,
    }}
  />
);

export const Hud: React.FC<{
  regions?: { a: number; b: number; intensity?: number }[];
  /** 曲内時刻（秒） */
  t: number;
  scale?: number;
  /** HUD右下に出す監視ラベル（曲名など）。省略時は出さない */
  label?: string;
}> = ({ regions, t, scale = 1, label: monitorLabel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reg = regions?.find((r) => t >= r.a && t < r.b);
  if (!reg) return null;

  const intensity = reg.intensity ?? 1;
  // 区間の入り/出りで 10f かけて build-in / build-out（smash-cut後の再描画＝レコード「編集」節）
  const fadeIn = Math.min(1, (t - reg.a) / (10 / fps));
  const fadeOut = Math.min(1, (reg.b - t) / (10 / fps));
  const alpha = 0.74 * intensity * Math.max(0, Math.min(fadeIn, fadeOut));
  if (alpha <= 0.01) return null;

  // 常時微動: レティクルの呼吸（±1.5px）
  const breathe = Math.sin(frame / 9) * 1.5;
  // 数値ローリング（2〜3fごと更新）
  const tick = Math.floor(frame / 3);
  const volt = (12.0 + ((tick * 37) % 90) / 10).toFixed(1);
  const ohm = ((tick * 17) % 40) + 60;
  const hz = 40 + ((tick * 7) % 60);
  // 拍でゲージが進む
  const beat = Math.floor((t - GRID0) / (BAR / 4));
  const gauge = ((beat % 16) + 1) / 16;
  // ターゲットボックスはじわじわ縮み、2小節ごとにスナップで開き直す
  const barPhase = ((t - GRID0) / (BAR * 2)) % 1;
  const box = 30 - 7 * barPhase; // %（画面中央からの半径）
  // WARNING は 6f ON / 6f OFF
  const warn = Math.floor(frame / 6) % 2 === 0;

  const label: React.CSSProperties = {
    fontFamily: MONO,
    fontWeight: 400,
    color: HUD,
    fontSize: 11 * scale,
    letterSpacing: '0.2em',
  };
  const value: React.CSSProperties = {
    fontFamily: MONO,
    fontWeight: 700,
    color: HUD,
    fontSize: 22 * scale,
    letterSpacing: '0.06em',
  };

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: alpha,
        // 微グロー＝発光体に見せる
        filter: `drop-shadow(0 0 ${6 * scale}px ${HUD}) drop-shadow(0 0 ${18 * scale}px ${HUD}66)`,
      }}
    >
      {/* ① コーナーブラケット（四隅） */}
      <Corner x="l" y="t" s={54 * scale} w={Math.max(1, 2 * scale)} />
      <Corner x="r" y="t" s={54 * scale} w={Math.max(1, 2 * scale)} />
      <Corner x="l" y="b" s={54 * scale} w={Math.max(1, 2 * scale)} />
      <Corner x="r" y="b" s={54 * scale} w={Math.max(1, 2 * scale)} />

      {/* ② ターゲットボックス（被写体をロックオン。じわじわ縮み、2小節でスナップ） */}
      <div
        style={{
          position: 'absolute',
          left: `${50 - box * 0.42}%`,
          right: `${50 - box * 0.42}%`,
          top: `${50 - box * 0.92 + breathe * 0.05}%`,
          bottom: `${50 - box * 0.92 - breathe * 0.05}%`,
          border: `${Math.max(1, 1.5 * scale)}px solid ${HUD}`,
          opacity: 0.85,
        }}
      >
        {/* 角のかぎ括弧（ボックスの4隅を強調） */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <div
            key={c}
            style={{
              position: 'absolute',
              width: 16 * scale,
              height: 16 * scale,
              [c[0] === 't' ? 'top' : 'bottom']: -Math.max(1, 1.5 * scale),
              [c[1] === 'l' ? 'left' : 'right']: -Math.max(1, 1.5 * scale),
              borderTop: c[0] === 't' ? `${Math.max(2, 4 * scale)}px solid ${HUD}` : undefined,
              borderBottom: c[0] === 'b' ? `${Math.max(2, 4 * scale)}px solid ${HUD}` : undefined,
              borderLeft: c[1] === 'l' ? `${Math.max(2, 4 * scale)}px solid ${HUD}` : undefined,
              borderRight: c[1] === 'r' ? `${Math.max(2, 4 * scale)}px solid ${HUD}` : undefined,
            }}
          />
        ))}
      </div>

      {/* ③ 左の縦目盛り＋数値（電圧・抵抗） */}
      <div style={{ position: 'absolute', left: '6.5%', top: '28%', bottom: '28%', width: 2, background: `${HUD}55` }}>
        {Array.from({ length: 17 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${(i / 16) * 100}%`,
              left: 0,
              width: i % 4 === 0 ? 18 * scale : 9 * scale,
              height: 1,
              background: HUD,
              opacity: i / 16 <= gauge ? 1 : 0.3,
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: 26 * scale, top: `${(1 - gauge) * 100}%`, ...value }}>{volt}<span style={{ fontSize: 13 * scale }}>kV</span></div>
        <div style={{ position: 'absolute', left: 26 * scale, top: '-8%', ...label }}>CHARGE</div>
      </div>

      {/* 右: 抵抗と周波数 */}
      <div style={{ position: 'absolute', right: '6.5%', top: '30%', textAlign: 'right' }}>
        <div style={label}>RESISTANCE</div>
        <div style={value}>{ohm}.0<span style={{ fontSize: 13 * scale }}>MΩ</span></div>
        <div style={{ ...label, marginTop: 14 * scale }}>FREQ</div>
        <div style={value}>{hz}<span style={{ fontSize: 13 * scale }}>Hz</span></div>
      </div>

      {/* ④ 下部の波形（sin合成・常時走る） */}
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: '6.5%', right: '6.5%', bottom: '11%', height: `${9 * scale}%` }}
      >
        <polyline
          fill="none"
          stroke={HUD}
          strokeWidth={2}
          points={Array.from({ length: 120 }, (_, i) => {
            const x = (i / 119) * 1200;
            const ph = frame / 4 + i / 3.2;
            const y =
              60 +
              Math.sin(ph) * 22 +
              Math.sin(ph * 2.7) * 11 +
              (i % 17 === 0 ? Math.sin(frame / 2) * 16 : 0);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ')}
        />
      </svg>

      {/* ⑤ キメの警告表示（6f ON / 6f OFF） */}
      <div style={{ position: 'absolute', left: '6.5%', bottom: '5.5%', display: 'flex', gap: 12 * scale, alignItems: 'center' }}>
        <div style={{ ...label, opacity: warn ? 1 : 0.18, border: `${Math.max(1, 1.5 * scale)}px solid ${HUD}`, padding: `${4 * scale}px ${9 * scale}px` }}>
          ⚠ DO NOT TOUCH
        </div>
        {monitorLabel ? <div style={{ ...label, opacity: 0.75 }}>{monitorLabel} / MONITORING</div> : null}
      </div>
    </AbsoluteFill>
  );
};
