import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Paper } from './Paper';
import { PAL } from './photocopy-zine';
import { TITLE_TEXT } from './scenes';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadCourier } from '@remotion/google-fonts/CourierPrime';

loadAnton();
loadCourier('normal', { weights: ['700'] });

/**
 * サムネ（1920×1080）。
 * タイトルのみ（input/project.json の title）・顔を隠さない・クレジットは入れない。
 */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: PAL.paper }}>
    <div style={{ position: 'absolute', inset: 0, filter: 'contrast(1.35) brightness(0.94)' }}>
      <Paper degrade={0.2} plate="plate_b.png" sheet={5} dot={7.6} objectPosition="center 18%" />
    </div>

    {/* タイトルは白い紙片に乗せて下1/3へ（顔を隠さない・MV本編と同じ切り貼り） */}
    <div
      style={{
        position: 'absolute',
        left: '3.6%',
        bottom: '6%',
        transform: 'rotate(-1.1deg)',
        backgroundColor: PAL.paper,
        padding: '1.4vh 2.6vh 2.2vh',
      }}
    >
      <div
        style={{
          fontFamily: '"Courier Prime", monospace',
          fontWeight: 700,
          fontSize: '2.4vh',
          letterSpacing: '0.34em',
          color: PAL.amber,
          marginBottom: '0.9vh',
        }}
      >
        GEN 07 / SHEET 037
      </div>
      <div
        style={{
          fontFamily: 'Anton, sans-serif',
          fontSize: '16vh',
          lineHeight: 0.84,
          letterSpacing: '0.01em',
          color: PAL.ink,
          transform: 'scaleX(0.88)',
          transformOrigin: 'left center',
          whiteSpace: 'pre',
        }}
      >
        {TITLE_TEXT.replace(' ', '\n')}
      </div>
    </div>
  </AbsoluteFill>
);
