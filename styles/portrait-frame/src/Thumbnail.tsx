import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/DMSerifDisplay';
import project from '../input/project.json';

/**
 * YouTube サムネイル（1920×1080）。
 *
 * 型:
 *   ・**タイトルのみ**（セリフは入れない）
 *   ・フォントは **DM Serif Display 固定**
 *   ・**被写体の顔を隠さない**＝タイトルは顔より下に置く
 */
const { fontFamily } = loadFont();

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: '#f2f5f8' }}>
    <Img
      src={staticFile('cover.png')}
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
    />
    {/* 白基調なので暗いグラデは使わず、下辺だけ淡く締めて文字を浮かせる */}
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(to top, rgba(242,245,248,0.92) 0%, rgba(242,245,248,0.55) 26%, transparent 48%)',
      }}
    />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '7%' }}>
      <div
        style={{
          fontFamily,
          fontSize: 214,
          letterSpacing: 6,
          color: '#1a2530',
          lineHeight: 1,
          textShadow: '0 6px 26px rgba(242,245,248,0.9)',
        }}
      >
        {project.title}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
