import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';
import * as THREE from 'three';
import { FlowerField, Rocks, ArchRow, Petals, Motes } from './Scene';
import { useSeqTexture, Character3D, HOOK_TEXT, SEQ_LEN } from './MainScene';

const { fontFamily } = loadFont('normal', { weights: ['700', '900'], subsets: ['japanese', 'latin'] });
const DEG = Math.PI / 180;

// Drop1（サビ）の切り出し区間（曲内の秒）
export const SHORT_START = 24.0;
export const SHORT_END = 36.0;
const S = SHORT_START;

// ショート専用の歌詞（曲内の秒・意味単位。\n で改行）
const shortLyrics = [
  { t: S + 0, end: S + 2, text: 'Sample' },
  { t: S + 2, end: S + 4, text: 'Short line one\nshort line two' },
  { t: S + 4, end: S + 7, text: 'Short line three' },
  { t: S + 7, end: S + 9, text: 'Sample' },
  { t: S + 9, end: S + 12, text: 'Short line four\nshort line five' },
];

type Shot = { pos: [number, number, number]; rot: [number, number, number]; fov: number; showChar: boolean };
// 縦9:16・キャラ中心。ts=曲内秒。フレーズごとに構図を変える（酔わない範囲で）
const shotShort = (ts: number, t: number): Shot => {
  const seg = (a: number, b: number) => ts >= S + a && ts < S + b;
  const wob = Math.sin(t * 0.5) * 0.6 * DEG;
  if (seg(0, 2)) return { pos: [0, 4.4, 13], rot: [0, 0, wob], fov: 46, showChar: true }; // バストアップ
  if (seg(2, 4)) return { pos: [0, 3.2, 17], rot: [0, 0, wob], fov: 54, showChar: true }; // 全身
  if (seg(4, 7)) { // 縦トンネル疾走（キャラなし）
    const lp = interpolate(ts, [S + 4, S + 7], [0, 1]);
    return { pos: [0, 0.8, interpolate(lp, [0, 1], [10, -78])], rot: [0, 0, lp * 300 * DEG], fov: 74, showChar: false };
  }
  if (seg(7, 9)) return { pos: [0, 5.2, 12.5], rot: [0, 0, wob], fov: 34, showChar: true }; // 顔アップ
  // 締め＝全身ゆっくり寄り
  const lp = interpolate(ts, [S + 9, SHORT_END], [0, 1], { extrapolateRight: 'clamp' });
  return { pos: [0, interpolate(lp, [0, 1], [3.4, 4.2]), interpolate(lp, [0, 1], [17, 13.5])], rot: [0, 0, wob], fov: 48, showChar: true };
};

const ShortRig: React.FC<{ shot: Shot }> = ({ shot }) => (
  <PerspectiveCamera makeDefault fov={shot.fov} position={shot.pos} rotation={shot.rot} near={0.1} far={130} />
);

export const ShortScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ts = SHORT_START + frame / fps; // 曲内の秒
  const t = frame / fps;
  const shot = shotShort(ts, t);

  const charTexture = useSeqTexture(shot.showChar ? staticFile(`char_seq/${String((Math.floor(frame) % SEQ_LEN) + 1).padStart(3, '0')}.png`) : null);
  const poppyTexture = useSeqTexture(staticFile('poppy.png'));

  const line = shortLyrics.find((l) => ts >= l.t && ts < l.end);
  const isHook = line ? line.text.includes(HOOK_TEXT) : false;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050203' }}>
      <Audio src={staticFile('audio.wav')} startFrom={Math.round(SHORT_START * fps)} endAt={Math.round(SHORT_END * fps)} />

      {/* 環境レイヤー（Bloom付き） */}
      <ThreeCanvas width={1080} height={1920} gl={{ antialias: true }} style={{ backgroundColor: '#050203' }}>
        <fog attach="fog" args={['#3a040a', 6, 62]} />
        <ambientLight intensity={0.4} color="#ff4d4d" />
        <directionalLight position={[-6, 10, 4]} intensity={0.55} color="#ffb0a0" />
        <pointLight position={[0, 1.5, -6]} color="#ff1a2e" intensity={90} distance={45} decay={1.8} />
        <pointLight position={[0, 0.5, 6]} color="#c00018" intensity={40} distance={30} decay={2} />
        <pointLight position={[0, 9, -2]} color="#ffcf7a" intensity={35} distance={30} decay={1.6} />
        <ShortRig shot={shot} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -50]}>
          <planeGeometry args={[200, 260]} />
          <MeshReflectorMaterial mirror={0.5} resolution={512} blur={[400, 120]} mixBlur={1.2} roughness={0.4} depthScale={0.5} color="#160406" metalness={0.4} />
        </mesh>
        <FlowerField texture={poppyTexture} />
        <Rocks />
        <ArchRow />
        <Petals frame={frame} />
        <Motes frame={frame} />
        <EffectComposer>
          <Bloom intensity={0.85} luminanceThreshold={0.45} luminanceSmoothing={0.9} mipmapBlur radius={0.6} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.001, 0.001]} radialModulation={false} modulationOffset={0} />
          <Vignette eskil={false} offset={0.28} darkness={0.85} />
        </EffectComposer>
      </ThreeCanvas>

      {/* キャラレイヤー */}
      {shot.showChar && (
        <ThreeCanvas width={1080} height={1920} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0, backgroundColor: 'transparent' }}>
          <ShortRig shot={shot} />
          <Character3D texture={charTexture} pos={[0, 3.0, 8]} h={9} tint="#ffdccf" />
        </ThreeCanvas>
      )}

      {/* 歌詞＝画面上部に特大（顔に被せない） */}
      {line && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', pointerEvents: 'none', paddingTop: '7%' }}>
          <div style={{
            fontFamily, fontWeight: 900, fontSize: isHook ? 118 : 96, color: isHook ? '#ff1030' : '#fff5f0',
            textAlign: 'center', letterSpacing: '0.04em', lineHeight: 1.25, padding: '0 5%', whiteSpace: 'pre-line',
            textShadow: '4px 0 0 rgba(255,0,40,0.5), -4px 0 0 rgba(0,180,255,0.45), 0 0 30px rgba(255,40,60,0.85)',
          }}>{line.text}</div>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 260px 70px rgba(0,0,0,0.9)' }} />
    </AbsoluteFill>
  );
};
