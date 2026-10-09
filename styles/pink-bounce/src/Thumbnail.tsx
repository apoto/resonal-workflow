import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Glyph } from './PinkBounce';
import { MOCHIY_POP } from './fonts';
import project from '../input/project.json';

// pink-bounce 独自サムネ意匠: カバー＋Mochiy Pop の2重フチタイトル1行（セリフ無し）。
// 下部に可読性のボトムグラデ。ピンク高キーの世界観をタイトルで締める。
const TITLE = project.title; // input/project.json
const SIZE = 150;

export const Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill>
      <Img src={staticFile('bg.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, transparent 55%, #40103055 82%, #40103099 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 56,
          transform: 'translateX(-50%) rotate(-1.5deg)',
          fontFamily: MOCHIY_POP,
          fontWeight: 800,
          fontSize: SIZE,
          whiteSpace: 'nowrap',
          display: 'flex',
        }}
      >
        {Array.from(TITLE).map((ch, i) => (
          <Glyph key={i} ch={ch} size={SIZE} neon={false} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
