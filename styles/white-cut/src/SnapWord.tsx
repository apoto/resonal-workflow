import React from 'react';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';
import { RuntimeSnap } from './types';

/**
 * white-cut の1フレーズ＝中央配置・黒明朝・縦書き（英語キメのみ横書き）・広い字間・「」付き。
 * モーションは無し（静）。出入りは LyricVideo 側の [startFrame, endFrame) によるハードカット。
 * glitch 行のときだけ出現直後に色収差（横波は LyricVideo 側で画面全体に適用）。
 */
const { fontFamily: MINCHO } = loadFont('normal', { weights: ['500'] });

const RED = '#ff2b2b';
const CYAN = '#16f2ff';

export const SnapWord: React.FC<{ lyric: RuntimeSnap; frame: number; fps: number; ink: string }> = ({
  lyric,
  frame,
  fps,
  ink,
}) => {
  const vertical = lyric.vertical ?? true;
  const label = lyric.quote ? `「${lyric.text}」` : lyric.text;
  const size = lyric.size ?? (vertical ? 80 : 58);

  // glitch行：出現後 ~0.2秒だけ色収差が走り収束
  const glitchFrames = Math.max(4, Math.round(0.22 * fps));
  const g = lyric.glitch ? Math.max(0, 1 - (frame - lyric.startFrame) / glitchFrames) : 0;
  const off = g * 10;

  const style: React.CSSProperties = {
    fontFamily: MINCHO,
    fontWeight: 500,
    fontSize: size,
    letterSpacing: vertical ? '0.18em' : '0.36em',
    writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vertical ? 'upright' : 'mixed',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
      {g > 0 && (
        <>
          <div style={{ ...style, position: 'absolute', left: 0, top: 0, color: RED, transform: `translateX(${-off}px)`, mixBlendMode: 'multiply' }}>{label}</div>
          <div style={{ ...style, position: 'absolute', left: 0, top: 0, color: CYAN, transform: `translateX(${off}px)`, mixBlendMode: 'multiply' }}>{label}</div>
        </>
      )}
      <div style={{ ...style, position: 'relative', color: ink }}>{label}</div>
    </div>
  );
};
