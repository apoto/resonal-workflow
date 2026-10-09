import React, { useMemo, useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { mulberry32, range } from './rand';

const DEG = Math.PI / 180;
const BPM = 185;
const Z_NEAR = 6; // 回廊の手前端
const Z_FAR = -120; // 回廊の奥端（トンネル360度用に延長）
const ARCH_Z = [2, -14, -30, -46, -62, -78, -94, -110]; // 門の回廊（8連・等間隔）

// ---------- 赤ポピー畑（InstancedMesh・回廊に沿って散布） ----------
export const Poppies: React.FC = () => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = mulberry32(1337);
    const N = 2400;
    const arr: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < N; i++) {
      const x = range(r, -26, 26);
      const z = range(r, Z_FAR - 4, Z_NEAR + 8);
      if (Math.abs(x) < 2.5 && r() < 0.6) continue; // 回廊中央を少し空ける
      arr.push({ pos: [x, -1.92 + r() * 0.1, z], s: range(r, 0.14, 0.3) });
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const rr = mulberry32(99);
    data.forEach((d, i) => {
      q.setFromEuler(new THREE.Euler(rr() * 0.6, rr() * Math.PI * 2, rr() * 0.6));
      scl.set(d.s, d.s * 1.6, d.s);
      m.compose(new THREE.Vector3(...d.pos), q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <coneGeometry args={[0.55, 0.8, 5]} />
      <meshBasicMaterial color="#a80016" toneMapped={false} />
    </instancedMesh>
  );
};

// ---------- 岩（回廊の縁をローポリで） ----------
export const Rocks: React.FC = () => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = mulberry32(4242);
    const N = 110;
    const arr: { pos: [number, number, number]; s: number; rot: number }[] = [];
    for (let i = 0; i < N; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * range(r, 4, 22);
      const z = range(r, Z_FAR, Z_NEAR + 8);
      arr.push({ pos: [x, -1.9 + range(r, 0, 1.2), z], s: range(r, 0.8, 3.0), rot: r() * Math.PI });
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const rr = mulberry32(7);
    data.forEach((d, i) => {
      q.setFromEuler(new THREE.Euler(rr() * Math.PI, d.rot, rr() * Math.PI));
      m.compose(new THREE.Vector3(...d.pos), q, new THREE.Vector3(d.s, d.s * 0.8, d.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [data]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8a8f96" roughness={0.9} flatShading />
    </instancedMesh>
  );
};

// ---------- 光る白アーチ門（立体・穴から光が漏れる） ----------
const archShape = (() => {
  const w = 4.2;
  const legH = 7;
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.lineTo(-w, legH);
  s.absarc(0, legH, w, Math.PI, 0, true);
  s.lineTo(w, 0);
  s.lineTo(w - 1.3, 0);
  s.lineTo(w - 1.3, legH);
  s.absarc(0, legH, w - 1.3, 0, Math.PI, false);
  s.lineTo(-(w - 1.3), 0);
  s.lineTo(-w, 0);
  return s;
})();

// 石材マテリアル（自己発光は微量→ライトの陰影が乗る／flatShadingでローポリの面陰影）
const stone = (emissive = 0.14) => (
  <meshStandardMaterial color="#e9e2da" emissive="#4a0c12" emissiveIntensity={emissive} roughness={0.45} metalness={0.06} flatShading />
);
const LEG_X = 3.55; // 脚の中心X

const Arch: React.FC<{ z: number; glow?: number }> = ({ z, glow = 1 }) => (
  <group position={[0, -1.9, z]}>
    {/* 門枠：ベベル面取り＋厚み＋flatShadingで石の陰影 */}
    <mesh castShadow>
      <extrudeGeometry
        args={[archShape, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 }]}
      />
      {stone(0.16)}
    </mesh>
    {/* 足元の台座（左右） */}
    {[-LEG_X, LEG_X].map((x, i) => (
      <mesh key={`base${i}`} position={[x, 0.35, 1.2]} castShadow>
        <boxGeometry args={[2.5, 0.7, 3.6]} />
        {stone(0.08)}
      </mesh>
    ))}
    {/* 柱の横モールディング（帯・2段） */}
    {[2.1, 4.6].flatMap((y) =>
      [-LEG_X, LEG_X].map((x, j) => (
        <mesh key={`mold${y}-${j}`} position={[x, y, 1.2]}>
          <boxGeometry args={[2.5, 0.4, 3.7]} />
          {stone(0.1)}
        </mesh>
      ))
    )}
    {/* アーチ頂点の要石（キーストーン） */}
    <mesh position={[0, 11.0, 1.2]} rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[1.3, 1.3, 3.3]} />
      {stone(0.18)}
    </mesh>
    {/* ネオン発光する門の縁（Bloomで光る＝参考のネオンアーチ） */}
    <mesh position={[0, 0, 2.55]} scale={[1.02, 1.02, 1]}>
      <extrudeGeometry args={[archShape, { depth: 0.12, bevelEnabled: false }]} />
      <meshBasicMaterial color="#ff2440" toneMapped={false} />
    </mesh>
    {/* くぐる先の光 */}
    <pointLight position={[0, 6, 1.5]} color="#ff5a70" intensity={90 * glow} distance={34} decay={1.7} />
  </group>
);

export const ArchRow: React.FC = () => (
  <>
    {ARCH_Z.map((z, i) => (
      <Arch key={i} z={z} glow={i === 0 ? 1 : 0.85} />
    ))}
  </>
);

// ---------- 赤ポピー畑（花spriteのbillboard・三角コーンから置換） ----------
export const FlowerField: React.FC<{ texture: THREE.Texture | null }> = ({ texture }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = mulberry32(1337);
    const N = 2200;
    const arr: { pos: [number, number, number]; s: number; rotY: number; tilt: number }[] = [];
    for (let i = 0; i < N; i++) {
      const x = range(r, -26, 26);
      const z = range(r, Z_FAR - 4, Z_NEAR + 8);
      if (Math.abs(x) < 2.5 && r() < 0.6) continue;
      arr.push({ pos: [x, -1.75 + r() * 0.2, z], s: range(r, 0.5, 1.05), rotY: r() * Math.PI * 2, tilt: -1.15 + range(r, -0.25, 0.25) });
    }
    return arr;
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    data.forEach((d, i) => {
      e.set(d.tilt, d.rotY, 0); // 地面に寝かせ気味＋ランダム向き
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(...d.pos), q, new THREE.Vector3(d.s, d.s, d.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [data, texture]);
  if (!texture) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.4} side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
};

// ---------- 昇っていく白い光の粒子（灰・光・昇天のモチーフ） ----------
export const Motes: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const r = mulberry32(777);
    return Array.from({ length: 90 }, () => ({
      x: range(r, -20, 20), z: range(r, -40, 8),
      speed: range(r, 0.03, 0.09), phase: r() * 200,
      s: range(r, 0.05, 0.16), sway: range(r, 0.3, 1.0),
    }));
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    seeds.forEach((p, i) => {
      const y = -2 + ((frame * p.speed + p.phase) % 22); // ゆっくり上昇
      const x = p.x + Math.sin(frame * 0.02 + p.phase) * p.sway;
      m.compose(new THREE.Vector3(x, y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [frame, seeds]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seeds.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#fff0e0" toneMapped={false} transparent opacity={0.85}
        blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
};

// ---------- 前景で舞う花びら（フレーム駆動で降下＆回転） ----------
export const Petals: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const r = mulberry32(555);
    return Array.from({ length: 110 }, () => ({
      x: range(r, -11, 11),
      z: range(r, -3, 8),
      speed: range(r, 0.02, 0.06),
      phase: r() * 100,
      spin: range(r, 0.02, 0.08),
      s: range(r, 0.06, 0.16),
    }));
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    seeds.forEach((p, i) => {
      const y = 6 - ((frame * p.speed + p.phase) % 12);
      const drift = Math.sin(frame * 0.05 + p.phase) * 1.2;
      q.setFromEuler(new THREE.Euler(frame * p.spin, frame * p.spin * 1.3, p.phase));
      m.compose(new THREE.Vector3(p.x + drift, y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [frame, seeds]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seeds.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#e01030" side={THREE.DoubleSide} toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
};

// ---------- カメラ・リグ（4パターンのショーケース） ----------
type Shot = { pos: [number, number, number]; rot: [number, number, number]; fov: number };

const Rig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const beatFrames = (60 / BPM) * fps;

  // 拍頭で軽く沈む程度のスムーズな揺れ（音ハメの下地・控えめ）
  // ※音源が来たらここの amp を拍に同期して強める。今はスムーズ優先で弱め。
  const phase = frame % beatFrames;
  const amp = 0.035 * Math.exp(-phase / 6);
  const shX = Math.sin(frame * 1.3) * amp;
  const shY = Math.cos(frame * 1.0) * amp;

  let s: Shot;
  const lin = (a: number, b: number, lo: number, hi: number) =>
    interpolate(t, [a, b], [lo, hi], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  if (t < 3) {
    // ① Low-Angle Dutch Dive：低アングルで門へ突進
    const dutch = (10 + Math.sin(t * 1.2) * 3) * DEG;
    s = { pos: [-1 + shX, 1.2 + shY, lin(0, 3, 10, -8)], rot: [-3 * DEG, 0.02, dutch], fov: 60 };
  } else if (t < 6) {
    // ② Top-Down Spiral：真俯瞰で赤ポピー畑を旋回
    const lt = t - 3;
    const orbit = lt * 0.7;
    s = {
      pos: [Math.sin(orbit) * 4 + shX, lin(3, 6, 30, 22), -22 + Math.cos(orbit) * 4],
      rot: [-84 * DEG, 0, orbit * 0.7 * DEG],
      fov: 66,
    };
  } else if (t < 9) {
    // ③ Tunnel Z-Roll：門の回廊を高速で突き抜けながらZ回転
    const lt = t - 6;
    s = {
      pos: [shX * 0.5, 0.6 + shY * 0.5, lin(6, 9, 8, -76)],
      rot: [0, 0, (lt * 55) * DEG],
      fov: 72,
    };
  } else if (t < 12) {
    // ④ Snap Zoom：拍ごとに門へバシッと段階ズーム
    const steps = [8, 2.5, -2, -6.5];
    const idx = Math.min(steps.length - 1, Math.floor((t - 9) / 0.75));
    const dutch = (idx % 2 === 0 ? 12 : -12) * DEG;
    s = { pos: [shX, 1.0 + shY, steps[idx]], rot: [-2 * DEG, 0, dutch], fov: 58 };
  } else {
    // ⑤ Grand Establishing：回廊の手前から門列を奥へ荘厳に見せる
    const dutch = (-6 + Math.sin(t * 0.9) * 2) * DEG;
    s = { pos: [shX * 0.6, 3.4 + shY, lin(12, 15, 22, 13)], rot: [-5 * DEG, 0.01, dutch], fov: 64 };
  }

  return (
    <PerspectiveCamera makeDefault fov={s.fov} position={s.pos} rotation={s.rot} near={0.1} far={130} />
  );
};

// ---------- シーン ----------
export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // カット切替の瞬間に軽い白フラッシュ（カット感を出す）
  const cutTimes = [3, 6, 9, 12];
  const flash = cutTimes.reduce((acc, ct) => {
    const d = t - ct;
    return d >= 0 && d < 0.12 ? Math.max(acc, 1 - d / 0.12) : acc;
  }, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050203' }}>
      <ThreeCanvas width={1920} height={1080} gl={{ antialias: true }} style={{ backgroundColor: '#050203' }}>
        <fog attach="fog" args={['#3a040a', 6, 60]} />
        <ambientLight intensity={0.4} color="#ff4d4d" />
        <directionalLight position={[-6, 10, 4]} intensity={0.55} color="#ffb0a0" />
        <pointLight position={[0, 1.5, -6]} color="#ff1a2e" intensity={90} distance={45} decay={1.8} />
        <pointLight position={[0, 0.5, 6]} color="#c00018" intensity={40} distance={30} decay={2} />

        <Rig />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -30]}>
          <planeGeometry args={[140, 160]} />
          <meshStandardMaterial color="#160406" roughness={1} />
        </mesh>

        <Poppies />
        <Rocks />
        <ArchRow />
        <Petals frame={frame} />
      </ThreeCanvas>

      {/* ビネット */}
      <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 320px 90px rgba(0,0,0,0.9)' }} />
      {/* カット切替フラッシュ */}
      {flash > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none', backgroundColor: `rgba(255,240,235,${flash * 0.5})` }} />
      )}
    </AbsoluteFill>
  );
};
