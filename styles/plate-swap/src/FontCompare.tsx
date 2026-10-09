import React from 'react';
import { AbsoluteFill } from 'remotion';
import { loadFont as fDela } from '@remotion/google-fonts/DelaGothicOne';
import { loadFont as fNoto } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as fZen } from '@remotion/google-fonts/ZenKakuGothicNew';
import { loadFont as fReggae } from '@remotion/google-fonts/ReggaeOne';
import { loadFont as fMochiy } from '@remotion/google-fonts/MochiyPopOne';
import { loadFont as fRock } from '@remotion/google-fonts/RocknRollOne';
import { loadFont as fPotta } from '@remotion/google-fonts/PottaOne';
import { loadFont as fYuji } from '@remotion/google-fonts/YujiSyuku';

/**
 * 書体候補の比較スウォッチ（判断用・作品では使わない）。
 * 筆文字は明るい地で線負けしやすいので、極太ゴシック/ポップ系と並べて比べる。
 * 同じ級数・同じ塗り（単色ベタ）・同じ地で並べて、線の太さと可読を実測する。
 */
// as const は readonly になり各ローダの subsets(mutable array) に代入できない
const opt = { subsets: ['japanese', 'latin'] as ('japanese' | 'latin')[], ignoreTooManyRequestsWarning: true };

const FACES = [
  { name: 'Yuji Syuku', ff: fYuji('normal', { ...opt }).fontFamily, w: 400 },
  { name: 'Dela Gothic One', ff: fDela('normal', { ...opt }).fontFamily, w: 400 },
  { name: 'Reggae One', ff: fReggae('normal', { ...opt }).fontFamily, w: 400 },
  { name: 'Noto Sans JP 900', ff: fNoto('normal', { ...opt, weights: ['900'] }).fontFamily, w: 900 },
  { name: 'Zen Kaku Gothic New 900', ff: fZen('normal', { ...opt, weights: ['900'] }).fontFamily, w: 900 },
  { name: 'Mochiy Pop One', ff: fMochiy('normal', { ...opt }).fontFamily, w: 400 },
  { name: 'RocknRoll One', ff: fRock('normal', { ...opt }).fontFamily, w: 400 },
  { name: 'Potta One', ff: fPotta('normal', { ...opt }).fontFamily, w: 400 },
];

const SAMPLE = 'サンプル';
const LATIN = 'Sample';

const Row: React.FC<{ f: typeof FACES[number] }> = ({ f }) => (
  <div style={{ display: 'flex', alignItems: 'center', height: 168, borderBottom: '1px solid #1b1d24' }}>
    <div style={{ width: 300, paddingLeft: 24, color: '#7b7f8c', font: '500 20px monospace' }}>{f.name}</div>
    {/* 都市（暗）の地に黄ベタ */}
    <div style={{ width: 470, background: '#14161c', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
      <span style={{ fontFamily: f.ff, fontWeight: f.w, fontSize: 96, color: '#E9C93E', lineHeight: 1 }}>{SAMPLE}</span>
    </div>
    {/* 黄ベタ面に黒抜き */}
    <div style={{ width: 380, background: '#E9C93E', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
      <span style={{ fontFamily: f.ff, fontWeight: f.w, fontSize: 96, color: '#141014', lineHeight: 1 }}>見本</span>
    </div>
    {/* 白の高キー面に黄（＝線負けが一番出る条件） */}
    <div style={{ width: 380, background: '#F2F1EE', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
      <span style={{ fontFamily: f.ff, fontWeight: f.w, fontSize: 76, color: '#E9C93E', lineHeight: 1 }}>{LATIN}</span>
    </div>
  </div>
);

export const FontCompare: React.FC = () => (
  <AbsoluteFill style={{ background: '#07080C' }}>
    {FACES.map((f) => (
      <Row key={f.name} f={f} />
    ))}
  </AbsoluteFill>
);
