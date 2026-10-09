import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { PAL, htPlate, rand, rand2 } from './photocopy-zine';

/**
 * Paper — photocopy-zine スタイルの「地」。3層で作る。
 *
 *  ① 紙地（生成りベタ＋繊維グレイン）
 *  ② ハーフトーン網点にした被写体プレート
 *  ③ コピー機の劣化（トナーのムラ・端の黒帯・スキャンのブレ）
 *
 * すべて degrade(0..1) で強度が上がる＝「コピーのコピー」が曲の進行で進む。
 */

export interface PaperProps {
  /** 版の劣化 0..1 */
  degrade: number;
  /** 網点にする画像（public/ 内）。null なら紙だけ */
  plate?: string | null;
  /** プレートの表示量 0..1（カットで抜き差しする） */
  plateOpacity?: number;
  /** プレートのスケール/位置（構図ジャンプ用） */
  plateTransform?: string;
  /** 紙の通し番号＝この値が変わると紙が差し替わる（傾き・位置・グレインの種が変わる） */
  sheet: number;
  /** 網点の粗さ（未使用。事前焼き込みのため） */
  dot?: number;
  /** 9:16 で顔を切らないための注視点 */
  objectPosition?: string;
  /** 0..1。1未満のとき、上から reveal の割合だけ刷られている（スキャンバー用） */
  reveal?: number;
}

/** 紙の繊維グレイン（SVG 乱流）。seed を変えると別の紙になる。 */
const Grain: React.FC<{ seed: number; amount: number }> = ({ seed, amount }) => (
  <svg
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: amount, mixBlendMode: 'multiply' }}
    aria-hidden
  >
    <filter id={`grain-${seed}`} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves={2} seed={seed} result="n" />
      <feColorMatrix
        in="n"
        type="matrix"
        values="0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.06  0 0 0 -1.1 1.05"
      />
    </filter>
    <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
  </svg>
);

/**
 * 網点プレート。事前に焼いた PNG を貼るだけ（tools/07_halftone_plates.py が生成）。
 * CSS で毎フレーム網点を合成すると全画面が毎フレーム書き変わり、書き出しが極端に重くなる。
 * 焼き込めば紙の動きは単なる平行移動になり、網点が紙と一緒に動く（物理的にも正しい）。
 */
const Halftone: React.FC<{
  src: string;
  transform?: string;
  /** 9:16 で顔を切らないための注視点（縦ショート共通ルール） */
  objectPosition?: string;
}> = ({ src, transform, objectPosition }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', mixBlendMode: 'multiply', transform }}>
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: objectPosition ?? 'center center',
      }}
    />
  </div>
);

export const Paper: React.FC<PaperProps> = ({
  degrade,
  plate,
  plateOpacity = 1,
  plateTransform,
  sheet,
  dot,
  objectPosition,
  reveal = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 紙ごとの個体差（決定的）
  const tilt = rand2(sheet * 7.13) * (0.35 + degrade * 0.9); // deg
  const offX = rand2(sheet * 3.77) * (2 + degrade * 10);
  const offY = rand2(sheet * 5.31) * (2 + degrade * 8);

  // スキャナのブレ（1秒に1回くらい、1フレームだけ横に飛ぶ）
  const jitterSeed = Math.floor(frame / 6);
  const jitter = rand(jitterSeed * 1.7 + sheet) < 0.06 + degrade * 0.1
    ? rand2(jitterSeed * 2.9) * (1.5 + degrade * 5)
    : 0;

  const grainAmount = 0.24 + degrade * 0.42;

  return (
    <AbsoluteFill style={{ backgroundColor: PAL.paper, overflow: 'hidden' }}>
      {/* 紙そのもの（わずかに傾いて置かれている＝1枚の紙をスキャンした感じ） */}
      <AbsoluteFill
        style={{
          transform: `translate(${offX + jitter}px, ${offY}px) rotate(${tilt}deg) scale(1.06)`,
          backgroundColor: PAL.paper,
        }}
      >
        {plate && plateOpacity > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: plateOpacity,
              // スキャンバーが通過した所（上側）だけが刷られている
              clipPath: reveal >= 1 ? undefined : `inset(0 0 ${(1 - reveal) * 100}% 0)`,
            }}
          >
            <Halftone
              src={htPlate(plate, degrade)}
              transform={plateTransform}
              objectPosition={objectPosition}
            />
          </div>
        ) : null}

        <Grain seed={(sheet % 97) + 1} amount={grainAmount} />

        {/* トナーのムラ（縦の帯）＝劣化するほど濃く */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            mixBlendMode: 'multiply',
            opacity: 0.06 + degrade * 0.18,
            backgroundImage: `repeating-linear-gradient(${90 + tilt}deg,
              rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${18 + rand(sheet) * 26}px,
              rgba(0,0,0,0.16) ${19 + rand(sheet) * 26}px, rgba(0,0,0,0) ${21 + rand(sheet) * 26}px)`,
          }}
        />

        {/* 原稿の端＝コピー機のフタが閉まりきらない所にできる黒い帯 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            mixBlendMode: 'multiply',
            opacity: 0.16 + degrade * 0.26,
            background: `linear-gradient(90deg, rgba(0,0,0,${0.34 + degrade * 0.3}) 0px, rgba(0,0,0,0) ${22 + degrade * 30}px),
                         linear-gradient(270deg, rgba(0,0,0,${0.2 + degrade * 0.24}) 0px, rgba(0,0,0,0) ${16 + degrade * 26}px)`,
          }}
        />
      </AbsoluteFill>

      {/* 紙の外＝スキャナの下地（わずかに暗い） */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          boxShadow: `inset 0 0 ${120 + degrade * 90}px rgba(0,0,0,${0.16 + degrade * 0.2})`,
        }}
      />
      {/* 静止フレームを作らないための微ドリフト（骨格ルール: 完全静止フレーム禁止） */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          opacity: 0.05,
          mixBlendMode: 'multiply',
          transform: `translateY(${Math.round(Math.sin(((Math.floor(frame / 6) * 6) / fps) * 0.7) * 6)}px)`,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)',
        }}
      />
    </AbsoluteFill>
  );
};
