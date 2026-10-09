import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { getStyle } from '../styles/registry';
import { config } from '../../input/song.config';
import project from '../../input/project.json';

// サムネ: 前景カバー（明るめ）＋ スタイルのタイトル表現。タイトル文言は config.thumbnail。
export const Thumbnail: React.FC = () => {
  const style = getStyle(config.style);
  const t = config.thumbnail ?? { title: '', sub: project.artist };
  return (
    <AbsoluteFill style={{ backgroundColor: '#05010E' }}>
      <Img src={staticFile('bg.png')} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.08) contrast(1.05) brightness(1.02)' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #3DE1FF14 0%, transparent 26%, transparent 58%, #05010Ecc 100%)' }} />
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, #00000000 0px, #00000000 2px, #00000033 3px, #00000000 4px)', opacity: 0.35 }} />
      <style.ThumbTitle title={t.title} sub={t.sub} />
    </AbsoluteFill>
  );
};
