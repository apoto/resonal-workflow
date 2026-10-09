import React, { useMemo, useState, useEffect } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, delayRender, continueRender } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Poppies, Rocks } from './Scene';

// ネオン発光ゴシック門（石柱＋発光アーチ縁）
const neonArchShape = (() => {
  const w = 4.4, legH = 8, s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(-w, legH); s.absarc(0, legH, w, Math.PI, 0, true);
  s.lineTo(w, 0); s.lineTo(w - 0.5, 0); s.lineTo(w - 0.5, legH);
  s.absarc(0, legH, w - 0.5, 0, Math.PI, false); s.lineTo(-(w - 0.5), 0); s.lineTo(-w, 0);
  return s;
})();

const NeonArch: React.FC<{ z: number }> = ({ z }) => (
  <group position={[0, -1.9, z]}>
    {/* 発光する門の縁（bloomで光る） */}
    <mesh>
      <extrudeGeometry args={[neonArchShape, { depth: 0.5, bevelEnabled: false }]} />
      <meshBasicMaterial color="#ff2a55" toneMapped={false} />
    </mesh>
    {/* 石柱（左右・つや消し白石） */}
    {[-4.9, 4.9].map((x, i) => (
      <mesh key={i} position={[x, 4, 0.2]} castShadow>
        <boxGeometry args={[1.6, 9.5, 1.6]} />
        <meshStandardMaterial color="#cfc7c0" roughness={0.7} metalness={0.1} />
      </mesh>
    ))}
    <pointLight position={[0, 6, 2]} color="#ff3366" intensity={140} distance={40} decay={1.6} />
  </group>
);

// 前景の大きなボケ花（DOFで前ボケ）
const FrontPoppies: React.FC = () => {
  const data = useMemo(() => [
    { p: [-7, -1, 7], s: 2.6 }, { p: [8, -1.3, 6], s: 3.0 }, { p: [-3, -1.5, 8], s: 2.0 },
  ] as { p: [number, number, number]; s: number }[], []);
  return (
    <>
      {data.map((d, i) => (
        <mesh key={i} position={d.p} rotation={[-1.2, 0, i]}>
          <circleGeometry args={[d.s, 8]} />
          <meshStandardMaterial color="#d40018" emissive="#5a0008" emissiveIntensity={0.5} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
};

const CharacterStatic: React.FC<{ texture: THREE.Texture | null }> = ({ texture }) =>
  texture ? (
    <mesh position={[0, 3.1, 6]}>
      <planeGeometry args={[10 * 0.667, 10]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} alphaTest={0.15} />
    </mesh>
  ) : null;

export const CineTest: React.FC = () => {
  const frame = useCurrentFrame();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const h = delayRender('cine-char');
    new THREE.TextureLoader().load(staticFile('char_seq/001.png'),
      (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); continueRender(h); },
      undefined, () => continueRender(h));
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050106' }}>
      <ThreeCanvas width={1920} height={1080} gl={{ antialias: true }} style={{ backgroundColor: '#050106' }}>
        <fog attach="fog" args={['#2a0210', 8, 70]} />
        <ambientLight intensity={0.3} color="#ff5577" />
        <directionalLight position={[-6, 12, 4]} intensity={0.5} color="#ffc0c8" />
        <pointLight position={[0, 5, -3]} color="#ff2a44" intensity={55} distance={38} decay={1.8} />
        <pointLight position={[0, 3, 10]} color="#ff88aa" intensity={22} distance={20} decay={2} />

        <PerspectiveCamera makeDefault fov={52} position={[0, 3.0, 15]} rotation={[-3.5 * Math.PI / 180, 0, 0]} near={0.1} far={140} />

        {/* 濡れた反射床 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -25]}>
          <planeGeometry args={[200, 220]} />
          <MeshReflectorMaterial mirror={0.55} resolution={1024} blur={[400, 120]} mixBlur={1.2}
            roughness={0.35} depthScale={0.4} color="#1a0206" metalness={0.4} />
        </mesh>

        <NeonArch z={2} />
        <NeonArch z={-16} />
        <Poppies />
        <Rocks />
        <FrontPoppies />
        <CharacterStatic texture={tex} />

        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.45} luminanceSmoothing={0.9} mipmapBlur radius={0.6} />
          <Vignette eskil={false} offset={0.28} darkness={0.82} />
        </EffectComposer>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
