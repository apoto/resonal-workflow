import React from 'react';
import { useVideoConfig } from 'remotion';
import { loadFont as loadMincho } from '@remotion/google-fonts/NotoSerifJP';
import { loadFont as loadSerif } from '@remotion/google-fonts/PlayfairDisplay';
import { RuntimeCrimsonGothic } from './types';

/**
 * crimson-gothic の1行を pattern に応じて描画する。
 * edge=左右端の縦書き明朝 / centerChar=中央巨大1文字 / centerBig=中央巨大＋色収差 / build=ビルドアップ。
 * 出入りは LyricVideo 側の [startFrame, endFrame) ハードカット。横波グリッチは CrimsonGothicStage が画面全体に適用。
 */
const { fontFamily: MINCHO } = loadMincho('normal', { weights: ['600'] });
const { fontFamily: SERIF } = loadSerif('normal', { weights: ['700', '900'] });

const RED = '#e01525';
const CYAN = '#16e0ff';

const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const hash = (n: number) => { const x = Math.sin(n * 91.37) * 4731.13; return x - Math.floor(x); };

export const CrimsonGothicWord: React.FC<{ lyric: RuntimeCrimsonGothic; frame: number; ink: string }> = ({ lyric, frame, ink }) => {
  const { fps } = useVideoConfig();
  const pattern = lyric.pattern ?? 'centerBig';
  const serif = lyric.serif ?? false;
  const color = lyric.color ?? ink;
  const fam = serif ? SERIF : MINCHO;
  const weight = serif ? 900 : 600;

  // ===== A: 左右端の縦書き明朝（静） =====
  if (pattern === 'edge') {
    const side = lyric.side ?? 'right';
    return (
      <div
        style={{
          position: 'absolute', top: '50%', [side]: '6%', transform: 'translateY(-50%)',
          fontFamily: MINCHO, fontWeight: 600, fontSize: lyric.size ?? 74, letterSpacing: '0.12em',
          writingMode: 'vertical-rl', textOrientation: 'upright', color, whiteSpace: 'nowrap',
        } as React.CSSProperties}
      >
        {lyric.text}
      </div>
    );
  }

  // ===== D: ビルドアップ（外側文字→中央で単語完成） =====
  if (pattern === 'build') {
    const local = frame - lyric.startFrame;
    const splitFrames = Math.round(0.5 * fps);
    const size = lyric.size ?? 480;
    const chars = Array.from(lyric.text);
    if (local < splitFrames && chars.length >= 2) {
      // 最初と最後の文字を左右に
      const first = chars[0];
      const last = chars[chars.length - 1];
      return (
        <>
          <div style={{ position: 'absolute', left: '30%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: fam, fontWeight: weight, fontSize: size, color }}>{first}</div>
          <div style={{ position: 'absolute', left: '70%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: fam, fontWeight: weight, fontSize: size, color }}>{last}</div>
        </>
      );
    }
    const tighten = easeOut((local - splitFrames) / 14);
    const ls = 0.6 - 0.55 * tighten;
    return (
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: fam, fontWeight: weight, fontSize: size, letterSpacing: `${ls}em`, color, whiteSpace: 'nowrap' }}>
        {lyric.text}
      </div>
    );
  }

  // ===== B/C: 中央巨大（1文字 or 単語）＋色収差＋ビート振動 =====
  const g = lyric.glitch ? 1 : lyric.chroma ? 0.45 : 0;
  const shake = lyric.glitch ? (hash(frame) * 2 - 1) * 10 : 0;
  const off = g * 14;
  const size = lyric.size ?? (pattern === 'centerChar' ? 620 : 520);
  const style: React.CSSProperties = {
    fontFamily: fam, fontWeight: weight, fontSize: size,
    letterSpacing: serif ? '0.04em' : '0.08em', lineHeight: 1, whiteSpace: 'nowrap',
  };
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translateX(${shake}px)` }}>
      {g > 0 && (
        <>
          <div style={{ ...style, position: 'absolute', left: 0, top: 0, color: RED, transform: `translateX(${-off}px)`, mixBlendMode: 'screen' }}>{lyric.text}</div>
          <div style={{ ...style, position: 'absolute', left: 0, top: 0, color: CYAN, transform: `translateX(${off}px)`, mixBlendMode: 'screen' }}>{lyric.text}</div>
        </>
      )}
      <div style={{ ...style, position: 'relative', color }}>{lyric.text}</div>
    </div>
  );
};
