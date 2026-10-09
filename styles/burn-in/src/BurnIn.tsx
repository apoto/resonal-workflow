import React from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';
import { BurnInData, GLine } from './types';

/**
 * burn-in 文字エンジン。
 * 核: 純黒×中央白明朝ハードカット／消えた行が補色（シアン⇄マゼンタ）ゴーストとして
 * 焼き残り蓄積／囁きギミック＝ネガ反転→完全暗転（ゴーストだけの世界）→Dropスラムでリセット。
 * 光過敏対策: 点滅はギミック毎に反転1回+白フラッシュ1回のみ（1秒3回以下）。
 */

const { fontFamily: SERIF } = loadFont('normal', {
  weights: ['600', '900'],
  subsets: ['japanese', 'latin'],
  ignoreTooManyRequestsWarning: true,
});

export const BG = '#020204';
const INK = '#F2F6FF';
const CYAN = '#00E5FF';
const MAGENTA = '#FF2BD1';
const GHOST_LIFE = 7.5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** 画面幅に応じたフォント実寸（縦ショートでは行が収まるよう自動クランプ） */
const useFontPx = () => {
  const { width } = useVideoConfig();
  const portrait = width < 1200;
  const base = (width / 1920) * (portrait ? 1.45 : 1);
  return (line: GLine) => {
    const desired = (line.size ?? 72) * base;
    const chars = Math.max(1, Array.from(line.text).length);
    const maxFit = (width * 0.94) / (chars * 1.12); // letterSpacing 0.08em 込みの概算
    return Math.min(desired, maxFit);
  };
};

const baseTextStyle = (line: GLine, px: number): React.CSSProperties => ({
  position: 'absolute',
  left: `${line.x ?? 50}%`,
  top: `${line.y ?? 50}%`,
  fontFamily: SERIF,
  fontWeight: line.kind === 'slam' ? 900 : 600,
  fontSize: px,
  letterSpacing: line.kind === 'slam' ? '0.02em' : '0.08em',
  whiteSpace: 'nowrap',
  lineHeight: 1.25,
});

// ---- 本体（白・ハードカット） ----
const LiveText: React.FC<{ line: GLine; now: number; fps: number; px: number }> = ({
  line,
  now,
  fps,
  px,
}) => {
  const lc = now - line.t;
  const settle = clamp01((lc * fps) / 4);
  const scale = (line.kind === 'slam' ? 1.35 : 1.05) - (line.kind === 'slam' ? 0.35 : 0.05) * easeOutCubic(settle);
  const split = (1 - settle) * 7;
  const pulse = line.kind === 'slam' ? 4 + Math.sin(lc * Math.PI * 2.5) * 2 : 0;
  const shadow =
    line.kind === 'slam'
      ? `${-pulse}px 0 0 ${CYAN}, ${pulse}px 0 0 ${MAGENTA}, 0 0 46px rgba(220,240,255,0.35)`
      : split > 0.3
        ? `${-split}px 0 0 ${CYAN}, ${split}px 0 0 ${MAGENTA}`
        : `0 0 18px rgba(210,230,255,0.25)`;
  return (
    <div
      style={{
        ...baseTextStyle(line, px),
        transform: `translate(-50%, -50%) scale(${scale})`,
        color: INK,
        textShadow: shadow,
      }}
    >
      {line.text}
    </div>
  );
};

// ---- 署名＝補色ゴースト（消えた後に焼き残り蓄積） ----
const GhostText: React.FC<{
  line: GLine;
  now: number;
  blackout: boolean;
  resets: number[];
  px: number;
}> = ({ line, now, blackout, resets, px }) => {
  const t1 = line.t + line.hold;
  if (now < t1) return null;
  // Drop リセット: リセット時刻より前に消えた行のゴーストは、その時刻以降消す
  for (const r of resets) {
    if (now >= r && t1 <= r) return null;
  }
  const age = now - t1;
  if (age > GHOST_LIFE) return null;
  const decay = 1 - easeOutCubic(clamp01(age / GHOST_LIFE));
  const strength = line.kind === 'chorus' || line.kind === 'slam' ? 0.6 : 0.45;
  const base = strength * decay;
  const boost = blackout ? Math.min(1, base * 2.6 + 0.18) : base;
  const off = 7 + age * 1.5;
  const common: React.CSSProperties = {
    ...baseTextStyle(line, px),
    filter: `blur(${1.2 + age * 0.5}px)`,
    mixBlendMode: 'screen',
  };
  return (
    <>
      <div
        style={{
          ...common,
          transform: `translate(calc(-50% - ${off}px), calc(-50% - ${off * 0.55}px))`,
          color: CYAN,
          opacity: boost,
        }}
      >
        {line.text}
      </div>
      <div
        style={{
          ...common,
          transform: `translate(calc(-50% + ${off}px), calc(-50% + ${off * 0.55}px))`,
          color: MAGENTA,
          opacity: boost,
        }}
      >
        {line.text}
      </div>
    </>
  );
};

// ---- echo（間奏の残響。ゴーストのみ・ふわっと明滅） ----
const EchoText: React.FC<{ line: GLine; now: number; px: number }> = ({ line, now, px }) => {
  if (now < line.t || now >= line.t + line.hold) return null;
  const p = (now - line.t) / line.hold;
  const op = Math.sin(Math.PI * p) * 0.42;
  const off = 8 + p * 6;
  const common: React.CSSProperties = {
    ...baseTextStyle(line, px),
    filter: 'blur(2px)',
    mixBlendMode: 'screen',
  };
  return (
    <>
      <div style={{ ...common, transform: `translate(calc(-50% - ${off}px), -50%)`, color: CYAN, opacity: op }}>
        {line.text}
      </div>
      <div style={{ ...common, transform: `translate(calc(-50% + ${off}px), -50%)`, color: MAGENTA, opacity: op }}>
        {line.text}
      </div>
    </>
  );
};

// ---- 囁き（ドアップ中=白くっきり／通常=視認ぎりぎり） ----
const WhisperText: React.FC<{ line: GLine; now: number; px: number; bright?: boolean }> = ({
  line,
  now,
  px,
  bright,
}) => {
  if (now < line.t || now >= line.t + line.hold) return null;
  const p = (now - line.t) / line.hold;
  if (bright) {
    const op = Math.min(1, Math.sin(Math.PI * clamp01(p)) * 1.6);
    return (
      <div
        style={{
          ...baseTextStyle(line, px * 1.25),
          transform: 'translate(-50%, -50%)',
          letterSpacing: '0.5em',
          color: `rgba(245,250,255,${op})`,
          textShadow: '0 2px 24px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)',
        }}
      >
        {line.text}
      </div>
    );
  }
  const op = Math.min(0.3, Math.sin(Math.PI * clamp01(p)) * 0.38);
  return (
    <div
      style={{
        ...baseTextStyle(line, px),
        transform: 'translate(-50%, -50%)',
        letterSpacing: '0.5em',
        color: `rgba(190,205,235,${op})`,
      }}
    >
      {line.text}
    </div>
  );
};

// ---- 全体 ----
const BLINK = 5 / 30; // Drop直前の「瞬き」全黒（秒）

export const BurnInStage: React.FC<{ data: BurnInData; now: number }> = ({ data, now }) => {
  const { fps } = useVideoConfig();
  const fontPx = useFontPx();
  const gs = data.meta.gimmicks ?? [];
  // 囁きウィンドウ＝明るいキャラのドアップ＋囁き一言だけ。
  // 最後の BLINK 秒だけ全黒（＝目を閉じた瞬き）→白フラッシュ→Dropスラム。
  const gWin = gs.find((g) => now >= g.blackoutStart && now < g.blackoutEnd);
  const closeup = gWin !== undefined && now < gWin.blackoutEnd - BLINK;
  const blink = gWin !== undefined && now >= gWin.blackoutEnd - BLINK;
  const blackout = gWin !== undefined; // ライブ歌詞は窓の間ずっと消す
  const negaFlash =
    gs.some((g) => now >= g.invert && now < g.blackoutStart) ||
    (data.meta.finalInvert !== undefined && now >= data.meta.finalInvert && now < data.meta.finalInvert + 0.25);
  const resets = gs.map((g) => g.blackoutEnd);
  const FLASH = 4 / fps;
  const flashG = gs.find((g) => now >= g.blackoutEnd && now < g.blackoutEnd + FLASH);
  const whiteFlashOpacity = flashG ? 1 - (now - flashG.blackoutEnd) / FLASH : 0;
  const closeupZoom = gWin ? 2.05 + 0.18 * clamp01((now - gWin.blackoutStart) / (gWin.blackoutEnd - gWin.blackoutStart)) : 2.05;

  // 背景の焼きつき（キャラ画像）: verse=気配だけ / サビ・Drop=少し浮かぶ / 暗転=いちばん見える
  const inEnergy = (data.meta.energyZones ?? []).some(([a, b]) => now >= a && now < b);
  const breathe = Math.sin(now * 0.55) * 0.012;
  const bgOpacity = (blackout ? 0.16 : inEnergy ? 0.11 : 0.05) + breathe;

  // 残像実験シーケンス（インストDrop）: 引き明るく注視→ネガ反転→暗転で疑似残像フェード
  const st = data.meta.stare;
  const stStaring = st !== undefined && now >= st.start && now < st.invertAt;
  const stInverted = st !== undefined && now >= st.invertAt && now < st.cutAt;
  const stGhosting = st !== undefined && now >= st.cutAt && now < st.ghostUntil;
  const stActive = stStaring || stInverted;
  const stP = st ? clamp01((now - st.start) / (st.cutAt - st.start)) : 0;
  const stGhostFade = st && stGhosting ? 1 - (now - st.cutAt) / (st.ghostUntil - st.cutAt) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>
      {/* 背景=キャラの焼きつき（うっすら・呼吸）。囁きウィンドウ中はドアップに置き換え */}
      {data.meta.backgroundImage && !gWin && !stActive && !stGhosting ? (
        <AbsoluteFill>
          <Img
            src={staticFile(data.meta.backgroundImage)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: Math.max(0, bgOpacity),
              filter: 'blur(3px) saturate(1.25)',
            }}
          />
        </AbsoluteFill>
      ) : null}
      {/* 囁きの瞬間＝明るいキャラのドアップ（ゆっくり寄る）。blink で全黒 */}
      {data.meta.backgroundImage && closeup ? (
        <AbsoluteFill>
          <Img
            src={staticFile(data.meta.backgroundImage)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${closeupZoom})`,
              transformOrigin: '50% 30%',
              filter: 'brightness(1.18) saturate(1.15)',
            }}
          />
        </AbsoluteFill>
      ) : null}
      {/* 残像実験シーケンス: 引きの明るいキャラ（注視点つき）→ネガ反転→暗転後は疑似残像がフェード */}
      {data.meta.backgroundImage && (stActive || stGhosting) ? (
        <AbsoluteFill>
          <Img
            src={staticFile(data.meta.backgroundImage)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scale(1)',
              transformOrigin: '50% 40%',
              opacity: stGhosting ? stGhostFade * 0.6 : 1,
              filter: stGhosting
                ? 'hue-rotate(180deg) blur(3px) saturate(1.2)'
                : stInverted
                  ? 'invert(1) brightness(1.05)'
                  : `brightness(${1.0 + 0.25 * stP}) saturate(1.2)`,
              mixBlendMode: stGhosting ? 'screen' : 'normal',
            }}
          />
        </AbsoluteFill>
      ) : null}
      {/* 残像レイヤー（背面・蓄積）。囁きウィンドウ/残像実験中は出さない */}
      {!gWin && !stActive && (
        <AbsoluteFill>
          {data.lyrics.map((l, i) => {
            const kind = l.kind ?? 'normal';
            if (kind === 'whisper') return null;
            if (kind === 'echo') return <EchoText key={i} line={l} now={now} px={fontPx(l)} />;
            return <GhostText key={i} line={l} now={now} blackout={false} resets={resets} px={fontPx(l)} />;
          })}
        </AbsoluteFill>
      )}
      {/* 本体（囁きウィンドウ中は消す） */}
      {!blackout && (
        <AbsoluteFill>
          {data.lyrics.map((l, i) => {
            const kind = l.kind ?? 'normal';
            if (kind === 'whisper' || kind === 'echo') return null;
            if (now < l.t || now >= l.t + l.hold) return null;
            return <LiveText key={i} line={l} now={now} fps={fps} px={fontPx(l)} />;
          })}
        </AbsoluteFill>
      )}
      {/* 囁き（ドアップ中は白でくっきり、それ以外は視認ぎりぎり。blink中は非表示） */}
      {!blink && (
        <AbsoluteFill>
          {data.lyrics.map((l, i) =>
            (l.kind ?? 'normal') === 'whisper' ? (
              <WhisperText key={i} line={l} now={now} px={fontPx(l)} bright={closeup} />
            ) : null
          )}
        </AbsoluteFill>
      )}
      {/* ネガ反転（囁きの瞬間・終端の一発） */}
      {negaFlash && <AbsoluteFill style={{ backgroundColor: '#ffffff', mixBlendMode: 'difference' }} />}
      {/* Drop 頭の白フラッシュ */}
      {whiteFlashOpacity > 0 && (
        <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: whiteFlashOpacity }} />
      )}
    </AbsoluteFill>
  );
};
