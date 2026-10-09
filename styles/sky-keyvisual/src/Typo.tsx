import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadJP } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { PAL } from './Field';

/** 白地では見えず、暗い被写体の上でだけ効く分離ハロー */
const HALO = 'drop-shadow(0 0 16px rgba(255,255,255,0.95)) drop-shadow(0 0 6px rgba(255,255,255,0.9))';
import type { RuntimeLyric } from './types';

const { fontFamily: JP } = loadJP('normal', { weights: ['900'], subsets: ['japanese', 'latin'] });
const { fontFamily: ANTON } = loadAnton();

/** ===== タイポ =====
 *  塗りは単色ベタ（縁・落ち影を足すとカラオケ字幕になる）。地が高明度なので色は濃いインク側。
 *  暗い被写体の上でだけ効く白ハロー（HALO）で分離する。
 *  日本語は Noto Sans JP 900（Dela Gothic One は密な漢字が白つぶれする）。
 *  英語のキメ（bomb）は Anton を横0.63圧縮＝condensed-poster-type。
 */

const isLatin = (s: string) => /^[\x20-\x7E！]+$/.test(s);

export const Typo: React.FC<{ line: RuntimeLyric; onDark: boolean; short?: boolean }> = ({ line, onDark, short }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // 縦(9:16)では height 基準だと文字が巨大になる。幅を基準にする。
  const U = short ? width : height;
  const local = frame - line.startFrame;
  const dur = line.endFrame - line.startFrame;
  if (local < 0 || local > dur) return null;

  const ink = onDark ? '#ffffff' : PAL.ink;
  const inT = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
  const outT = interpolate(local, [dur - 5, dur], [1, 0], { extrapolateLeft: 'clamp' });
  const alpha = Math.min(inT, outT);
  const latin = isLatin(line.text);

  // --- bomb: 画面いっぱいの極太。サビ頭のタイトル語 ---
  if (line.mode === 'bomb') {
    const pop = spring({ frame: local, fps, config: { damping: 200, mass: 0.5 } });
    const sc = interpolate(pop, [0, 1], [1.18, 1]);
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: alpha }}>
        <div
          style={{
            fontFamily: latin ? ANTON : JP,
            fontWeight: 900,
            fontSize: latin ? U * 0.2 : U * 0.15,
            color: ink,
            letterSpacing: latin ? '0.03em' : '-0.02em',
            transform: `scaleX(${latin ? 0.63 : 0.92}) scaleY(${1.9 * sc}) `,
            filter: onDark ? undefined : HALO,
            lineHeight: 0.82,
            whiteSpace: 'nowrap',
          }}
        >
          {line.text}
        </div>
      </AbsoluteFill>
    );
  }

  // --- stack: 1拍1ワードで積む。掛け合いの応酬 ---
  if (line.mode === 'stack') {
    const slot = line.slot ?? 0;
    const pop = spring({ frame: local, fps, config: { damping: 14, mass: 0.4 } });
    const y = height * (slot === 0 ? 0.3 : 0.56);
    const x = slot === 0 ? width * 0.22 : width * 0.62;
    return (
      <AbsoluteFill style={{ opacity: alpha }}>
        <div
          style={{
            position: 'absolute', left: x, top: y,
            transform: `translate(-50%, -50%) scale(${interpolate(pop, [0, 1], [0.7, 1])}) rotate(${slot === 0 ? -3 : 3}deg)`,
            fontFamily: latin ? ANTON : JP,
            fontWeight: 900,
            fontSize: latin ? U * 0.11 : U * 0.17,
            color: ink,
            whiteSpace: 'nowrap',
            letterSpacing: latin ? '0.02em' : '-0.03em',
            filter: onDark ? undefined : HALO,
          }}
        >
          {line.text}
        </div>
      </AbsoluteFill>
    );
  }

  // --- small: 会話行。小さく下寄せ ---
  if (line.mode === 'small') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', opacity: alpha, paddingBottom: height * 0.1 }}>
        <div style={{ fontFamily: JP, fontWeight: 900, fontSize: U * 0.052, color: ink, letterSpacing: '0.02em', filter: onDark ? undefined : HALO }}>
          {line.text}
        </div>
      </AbsoluteFill>
    );
  }

  // --- swap: 語単位の逐次入れ替え（既定） ---
  // 空白で語に割り、語ごとに数フレームずらして出す＝塊が居座らない
  const words = line.text.split(/\s+/).filter(Boolean);
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end', alignItems: 'center', opacity: alpha,
        paddingBottom: height * 0.13,   // キャラの胴に重ねない＝床の上で読ませる
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.5em', maxWidth: width * (short ? 0.9 : 0.82), filter: onDark ? undefined : HALO }}>
        {words.map((w, i) => {
          const wp = spring({ frame: local - i * 2, fps, config: { damping: 18, mass: 0.35 } });
          return (
            <span
              key={i}
              style={{
                fontFamily: isLatin(w) ? ANTON : JP,
                fontWeight: 900,
                fontSize: U * (line.scale ?? 1) * 0.085,
                color: ink,
                letterSpacing: '-0.02em',
                transform: `translateY(${interpolate(wp, [0, 1], [16, 0])}px)`,
                opacity: wp,
                whiteSpace: short ? 'normal' : 'nowrap',
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
