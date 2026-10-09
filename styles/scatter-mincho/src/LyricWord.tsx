import React from 'react';
import { AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';
import { RuntimeLyric } from './types';
import { beatPulse, onBeat } from './beats';

// 採用版（デーモンロード本家寄せ）：白い極太明朝を画面各所にバラ撒き、
// 色収差＋横スメア(残像)グリッチを乗せる。複数語が同時に出てもOK。
const { fontFamily: MINCHO } = loadFont('normal', { weights: ['900'] });
// ▼ 配色は曲ごとのツマミ。既定は本家デーモンロード寄せ＝白文字＋赤グロー。
//   曲の世界観に合わせてここだけ差し替える（再着色しても他は触らない）。
//   例) 寒色: RED:'#ff3df0'(ピンク) CYAN:'#22e0ff' GLOW:'#3aa0ff'(ブルー)
const RED = '#ff2b2b'; // 色収差の片側＋グロー色（既定＝赤）
const CYAN = '#16f2ff'; // 色収差のもう片側＝シアン
const GLOW = RED; // 本体グロー色（既定は赤。寒色にしたい曲は別色を指定）

// 中央（キャラ）を避けた配置スロット。index で循環。
const SLOTS = [
  { x: 22, y: 28, rot: -3 },
  { x: 80, y: 20, rot: 2 },
  { x: 86, y: 54, rot: 0 },
  { x: 17, y: 58, rot: 3 },
  { x: 30, y: 82, rot: -2 },
  { x: 75, y: 80, rot: 1 },
];

export const LyricWord: React.FC<{
  lyric: RuntimeLyric;
  index: number;
  frame: number;
  beats: number[];
  stackIndex?: number;
  stackCount?: number;
}> = ({ lyric, index, frame, beats, stackIndex = 0, stackCount = 1 }) => {
  const { fps, width, height } = useVideoConfig();
  const local = frame - lyric.startFrame;
  const total = lyric.endFrame - lyric.startFrame;
  // 拍にハマるよう立ち上がりを速く（スナップイン）
  const appear = spring({ frame: local, fps, config: { damping: 14, mass: 0.4, stiffness: 320 }, durationInFrames: 6 });
  const out = interpolate(local, [total - 7, total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(appear, out);
  const pulse = beatPulse(frame, beats, 7);
  const g = onBeat(frame, beats, 0) || local < 2 ? 1 : 0; // 一瞬グリッチ

  const slot = SLOTS[index % SLOTS.length];
  const vertical = lyric.style === 'vertical';
  const chars = Array.from(lyric.text);
  // 基準サイズ＋長さに応じて画面に収まるよう縮小（長い塊は自然と小さく＝サイズ差も出る）
  const base = lyric.style === 'huge-flash' ? 300 : lyric.style === 'center' ? 200 : 140;
  const estW = chars.reduce((s, c) => s + (/[\x00-\x7F]/.test(c) ? 0.56 : 1.0), 0);
  const PAD = 70; // 画面端の余白(px)
  const lineH = vertical ? 1.05 : 0.95;
  // 画面に収まる上限から文字サイズを決定（横は横幅、縦は高さで律速）
  const fitW = (width - PAD * 2) / Math.max(1, vertical ? 1 : estW);
  const fitH = (height - PAD * 2) / Math.max(1, (vertical ? chars.length : 1) * lineH);
  const scaleMul = lyric.scale ?? 1;
  // はみ出し表示：明示フラグ、または huge-flash かつ大スケール（連呼の最後の一撃）はクランプ解除
  const overflow = lyric.overflow ?? (lyric.style === 'huge-flash' && scaleMul >= 1.5);
  // はみ出し時のサイズは「画面幅（縦書きは画面高さ）に対して相対」にして、
  // 両端が少しだけ（OVERSHOOT-1 の割合）はみ出る量に固定する。
  // これで 16:9 でも 9:16 でも“少しはみ出し”が同じ見え方になり、ショートでも読める。
  const OVERSHOOT = 1.14; // 全幅の14%＝両端に約7%ずつはみ出す
  const overflowSize = vertical
    ? (height * OVERSHOOT) / Math.max(1, chars.length * lineH)
    : (width * OVERSHOOT) / Math.max(1, estW);
  const size = overflow ? Math.max(28, overflowSize) : Math.max(28, Math.min(base * scaleMul, fitW, fitH));

  // 文字ボックスの推定サイズ（クランプ用）
  const boxW = vertical ? size * 1.15 : size * estW;
  const boxH = (vertical ? chars.length : 1) * size * lineH;
  // スロット中心(px)。pin='center' なら画面中央へ。
  const pinned = lyric.pin === 'center';
  const rawCx = pinned ? width / 2 : (slot.x / 100) * width;
  const rawCy = pinned ? height / 2 : (slot.y / 100) * height;
  const halfW = boxW / 2 + PAD;
  const halfH = boxH / 2 + PAD;
  const cx = boxW + PAD * 2 >= width ? width / 2 : Math.min(width - halfW, Math.max(halfW, rawCx));
  // 縦バンド振り分け：同時表示が複数ある時は重ならないよう高さ方向に均等配置（ピン留めは除外）。
  const bandCy = stackCount > 1 ? (height * (stackIndex + 1)) / (stackCount + 1) : rawCy;
  const cy =
    boxH + PAD * 2 >= height ? height / 2 : Math.min(height - halfH, Math.max(halfH, bandCy));

  const off = 3 + pulse * 4 + g * 14; // 色収差の横ズレ
  const smearStep = 4 + pulse * 5 + g * 26; // 残像の間隔（グリッチで大きく伸びる）
  const glow = 22 + pulse * 28;
  const enterX = interpolate(appear, [0, 1], [index % 2 ? 60 : -60, 0]);
  const jitterRot = g ? (((frame * 13) % 5) - 2) : 0;
  // ピン留め時の挙動：huge-flash（もう一本！）はパンチで拡大、それ以外（いまどこ）は静かにフェード。
  const calm = pinned && lyric.style !== 'huge-flash';
  const slideX = pinned ? 0 : enterX;
  const baseRot = pinned ? 0 : slot.rot;
  const jr = calm ? 0 : jitterRot;
  const pop = pinned && lyric.style === 'huge-flash' ? interpolate(appear, [0, 1], [0.5, 1], { extrapolateRight: 'clamp' }) : 1;

  const layer: React.CSSProperties = {
    fontFamily: MINCHO,
    fontWeight: 900,
    fontSize: size,
    letterSpacing: vertical ? '0.08em' : '0.03em',
    lineHeight: vertical ? 1.05 : 0.95,
    whiteSpace: 'nowrap',
    writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vertical ? 'upright' : 'mixed',
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: cx,
          top: cy,
          transform: `translate(-50%, -50%) translateX(${slideX}px) rotate(${baseRot + jr}deg) scale(${pop})`,
          opacity,
          display: 'inline-block',
        }}
      >
        {/* 白い横スメア(残像)：本体の後ろに尾を引く */}
        {[0.22, 0.13, 0.07].map((o, k) => (
          <div key={'s' + k} style={{ ...layer, position: 'absolute', left: 0, top: 0, color: '#fff', opacity: o, transform: `translateX(${smearStep * (k + 1)}px)`, filter: 'blur(0.6px)' }}>
            {lyric.text}
          </div>
        ))}
        {/* 色収差（赤/シアン） */}
        <div style={{ ...layer, position: 'absolute', left: 0, top: 0, color: RED, transform: `translateX(${-off}px)`, mixBlendMode: 'screen' }}>{lyric.text}</div>
        <div style={{ ...layer, position: 'absolute', left: 0, top: 0, color: CYAN, transform: `translateX(${off}px)`, mixBlendMode: 'screen' }}>{lyric.text}</div>
        {/* 本体（白） */}
        <div style={{ ...layer, position: 'relative', color: '#fff', textShadow: `0 0 ${glow}px ${GLOW}cc, 0 0 ${glow * 0.5}px ${RED}66, 0 2px 16px rgba(0,0,0,0.7)` }}>{lyric.text}</div>
      </div>
    </AbsoluteFill>
  );
};
