import React, { useMemo, useState, useEffect } from 'react';
import {
  AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, delayRender, continueRender,
} from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { ThreeCanvas } from '@remotion/three';
import { PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { loadFont } from '@remotion/google-fonts/NotoSerifJP';
import * as THREE from 'three';
import { FlowerField, Rocks, ArchRow, Petals, Motes } from './Scene';
import timeline from './timeline.json';
import { Credits, DEFAULT_CREDITS } from './Credits';
import project from '../input/project.json';

const { fontFamily } = loadFont('normal', { weights: ['700', '900'], subsets: ['japanese', 'latin'] });
const DEG = Math.PI / 180;

type SectionKind =
  | 'intro' | 'verseChar' | 'build' | 'drop' | 'interlude'
  | 'breakdown' | 'buildup' | 'finaldrop' | 'outro';
type CutKind =
  | 'dive' | 'spiral' | 'tunnel' | 'snap' | 'establish' | 'character' | 'outroEnv'
  | 'punchIn' | 'dollyLow' | 'overheadDescend' | 'sideTrack' | 'orbitClose' | 'charPunch' | 'craneUp'
  | 'charFull' | 'charTrackIn' | 'charBustR' | 'charBustL' | 'charFace' | 'charFeet';
type Cut = { t0: number; t1: number; kind: CutKind };

const sections = timeline.sections as { kind: SectionKind; t0: number; t1: number }[];
const lyrics = timeline.lyrics as { t: number; end: number; text: string }[];
// 冒頭クレジット（文言は input/project.json、秒は Credits.tsx の DEFAULT_CREDITS）
const credits = DEFAULT_CREDITS;
// この文字列を含む歌詞行をフック扱い（赤・特大）にする
export const HOOK_TEXT = project.title;
// public/char_seq/ の連番枚数（tools/greenscreen_to_seq.sh が最後に表示する SEQ_LEN）
export const SEQ_LEN = 300;

// セクション → 具体カット列（Dropごとに別セット・Verseも分割して単調さを消す）
const CUTS: Cut[] = (() => {
  const cuts: Cut[] = [];
  const push = (t0: number, t1: number, kind: CutKind) => cuts.push({ t0, t1, kind });
  const cycle = (kinds: CutKind[], t0: number, t1: number, seg: number) => {
    let t = t0, i = 0;
    while (t < t1 - 0.01) { push(t, Math.min(t + seg, t1), kinds[i % kinds.length]); t += seg; i++; }
  };
  // 重み付きでキャラの見せ方を並べる（画角バリエ・カットインを混ぜて飽きさせない）
  const charScene = (t0: number, t1: number, plan: [CutKind, number][]) => {
    const total = plan.reduce((a, [, w]) => a + w, 0);
    let tt = t0;
    plan.forEach(([k, w]) => { const seg = (t1 - t0) * w / total; push(tt, Math.min(tt + seg, t1), k); tt += seg; });
  };
  let verseIdx = 0;
  for (const s of sections) {
    const d = s.t1 - s.t0;
    switch (s.kind) {
      case 'intro': push(s.t0, s.t0 + 8, 'establish'); push(s.t0 + 8, s.t1, 'dollyLow'); break;
      case 'verseChar':
        verseIdx++;
        // 1番と2番で順序を変える。長いゆっくり寄り＋横/あおりの顔カットインで多彩に（同じズームの繰り返しをしない）
        charScene(s.t0, s.t1, verseIdx === 1
          ? [['charTrackIn', 3.2], ['charBustR', 1.6], ['charFull', 1.8], ['charFeet', 1.3], ['charBustL', 1.8]]
          : [['charFull', 1.8], ['charFace', 1.6], ['charTrackIn', 3.2], ['charBustL', 1.6], ['charFull', 1.6]]);
        break;
      // ビルド＝溜め：門にゆっくり寄る→キャラの顔アップ（Dropの回転トンネルとは別演出＝溜めと爆発の対比）
      case 'build': push(s.t0, s.t0 + d * 0.45, 'dollyLow'); push(s.t0 + d * 0.45, s.t1, 'charFace'); break;
      case 'drop': cycle(['tunnel', 'punchIn', 'sideTrack', 'spiral', 'snap'], s.t0, s.t1, 3.2); break;
      case 'interlude': push(s.t0, s.t0 + d * 0.5, 'overheadDescend'); push(s.t0 + d * 0.5, s.t1, 'tunnel'); break;
      // 落ちサビ＝静の見せ場：ゆったり全身＋静かな横顔（カメラは大きく動かさない）
      case 'breakdown': charScene(s.t0, s.t1, [['charFull', 3.0], ['charBustR', 1.6], ['charFull', 2.4]]); break;
      case 'buildup': push(s.t0, s.t1, 'establish'); break;
      // ラスサビ＝環境ぶん回しに新しいキャラ構図（バストアップ/顔/全身）を散りばめる
      case 'finaldrop': cycle(['tunnel', 'charBustL', 'spiral', 'charFace', 'punchIn', 'charFull', 'snap', 'charBustR'], s.t0, s.t1, 2.9); break;
      case 'outro': push(s.t0, s.t0 + d * 0.5, 'outroEnv'); push(s.t0 + d * 0.5, s.t1, 'craneUp'); break;
    }
  }
  return cuts;
})();
// 2番Verse/Drop用に別セットへ差し替え（同じ種類の繰り返しを避ける）
(() => {
  let dropIdx = 0;
  for (const s of sections) {
    if (s.kind === 'drop') {
      dropIdx++;
      if (dropIdx === 2) { // Drop2 は俯瞰/周回＋キャラ構図を混ぜる
        const set: CutKind[] = ['overheadDescend', 'charBustR', 'orbitClose', 'charFace', 'snap', 'charBustL'];
        for (const c of CUTS) if (c.t0 >= s.t0 && c.t1 <= s.t1) {
          c.kind = set[Math.round((c.t0 - s.t0) / 3.2) % set.length];
        }
      }
    }
  }
})();

const sectionAt = (t: number) => sections.find((s) => t >= s.t0 && t < s.t1) ?? sections[sections.length - 1];
const cutAt = (t: number) => {
  const cut = CUTS.find((c) => t >= c.t0 && t < c.t1) ?? CUTS[CUTS.length - 1];
  return { cut, local: (t - cut.t0) / Math.max(0.001, cut.t1 - cut.t0) };
};

// カメラ位置からキャラ（門前 x0,z8）の狙った高さを確実に見る回転を計算
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _up = new THREE.Vector3(0, 1, 0);
const lookAtRot = (pos: [number, number, number], targetY: number, roll = 0): [number, number, number] => {
  _m.lookAt(_v.set(pos[0], pos[1], pos[2]), _v.clone().set(0, targetY, 8), _up);
  _e.setFromRotationMatrix(_m);
  return [_e.x, _e.y, _e.z + roll];
};

type Shot = { pos: [number, number, number]; rot: [number, number, number]; fov: number };
const shotFor = (kind: CutKind, local: number, t: number, sh: [number, number]): Shot => {
  const [shX, shY] = sh;
  const L = (lo: number, hi: number) => interpolate(local, [0, 1], [lo, hi]);
  switch (kind) {
    case 'dive': return { pos: [-1 + shX, 1.2 + shY, L(10, -8)], rot: [-3 * DEG, 0.02, (10 + Math.sin(t * 1.2) * 3) * DEG], fov: 60 };
    case 'spiral': { const o = local * 2.1; return { pos: [Math.sin(o) * 4 + shX, L(30, 22), -22 + Math.cos(o) * 4], rot: [-84 * DEG, 0, o * 0.7 * DEG], fov: 66 }; }
    // 回転し続けたまま門をくぐり、キャラ(z-92,顔≈y5.6)の"顔"へ寄っていく（等速で1周＝到達時は正立）
    case 'tunnel': return {
      pos: [shX * 0.4, interpolate(local, [0, 0.55, 1], [0.6, 2.4, 5.2]), interpolate(local, [0, 0.7, 1], [10, -60, -86])],
      rot: [0, 0, local * 360 * DEG], // 止めずに回転し続ける
      fov: interpolate(local, [0, 0.7, 1], [72, 64, 42]),
    };
    case 'snap': { const steps = [7, 2.5, -1, -4.5]; const i = Math.min(3, Math.floor(local * 4)); return { pos: [shX, 1 + shY, steps[i]], rot: [-2 * DEG, 0, (i % 2 === 0 ? 7 : -7) * DEG], fov: 60 }; }
    case 'establish': return { pos: [shX * 0.6, 3.4 + shY, L(22, 13)], rot: [-5 * DEG, 0.01, (-6 + Math.sin(t * 0.9) * 2) * DEG], fov: 64 };
    case 'outroEnv': return { pos: [shX * 0.6, 3.6 + shY, L(13, 26)], rot: [-6 * DEG, 0.01, (-6 + Math.sin(t * 0.7) * 2) * DEG], fov: 66 };
    case 'character': return { pos: [shX * 0.3, 3.4 + shY * 0.4, L(18, 15.5)], rot: [-3 * DEG, 0.005, (-1.5 + Math.sin(t * 0.5) * 0.8) * DEG], fov: 56 };
    // --- 追加パターン ---
    case 'punchIn': return { pos: [shX, 2.4 + shY, L(11, 8.5)], rot: [-4 * DEG, 0, (Math.sin(t) * 1.5) * DEG], fov: L(64, 44) }; // ゆるやかなズーム
    case 'dollyLow': return { pos: [shX, 0.2 + shY * 0.5, L(9, -10)], rot: [7 * DEG, 0.01, (5 + Math.sin(t) * 1.5) * DEG], fov: 62 }; // ロー煽りドリー
    case 'overheadDescend': return { pos: [Math.sin(local * 0.9) * 2 + shX, L(40, 15), -18 + Math.cos(local * 0.9) * 2], rot: [-88 * DEG, 0, local * 18 * DEG], fov: 68 }; // 真俯瞰から静かに下降
    case 'sideTrack': return { pos: [L(-12, 12) + shX, 3 + shY, 8], rot: [-3 * DEG, interpolate(local, [0, 1], [0.35, -0.35]), (Math.sin(t) * 2) * DEG], fov: 62 }; // 横トラッキング
    case 'orbitClose': { const o = local * 0.7 * Math.PI + 0.5; return { pos: [Math.cos(o) * 12 + shX, 3 + shY, -6 + Math.sin(o) * 12], rot: [-4 * DEG, interpolate(local, [0, 1], [-0.4, 0.4]), (Math.sin(t) * 2) * DEG], fov: 60 }; } // 近接周回
    case 'charPunch': return { pos: [shX * 0.25, L(3.8, 4.5) + shY * 0.3, L(15, 11.5)], rot: [-5 * DEG, 0.005, (Math.sin(t * 0.6) * 0.8) * DEG], fov: L(50, 38) }; // キャラを全身→顔へ寄り
    case 'craneUp': return { pos: [shX * 0.4, L(3, 15), L(8, 19)], rot: [interpolate(local, [0, 1], [-4, -26]) * DEG, 0.01, (-4 + Math.sin(t * 0.8) * 1.5) * DEG], fov: 64 }; // クレーン上昇引き
    // --- キャラの構図バリエ（正面固定＝pitch/yaw=0で2Dを歪ませない。camX/Y平行移動＋ズームで構図）---
    // キャラ(門前z=8): 顔≈y5.2 / 胸≈y3.8 / 足元≈y-0.5 / 全身 -1〜6
    case 'charFull': return { pos: [shX * 0.2, 2.6 + shY * 0.3, 16], rot: [0, 0, Math.sin(t * 0.3) * 0.4 * DEG], fov: 56 }; // 全身・中央
    case 'charTrackIn': return { pos: [shX * 0.15, L(2.6, 4.3), L(18, 12)], rot: [0, 0, 0], fov: L(56, 42) }; // 全身→バストへ連続で寄る
    case 'charBustR': return { pos: [L(-2.6, -1.6), 4.4 + shY * 0.2, 13], rot: [0, 0, 0], fov: 42 }; // バストアップ・右寄せ（頭で左からトラックイン）
    case 'charBustL': return { pos: [L(2.6, 1.6), 4.4 + shY * 0.2, 13], rot: [0, 0, 0], fov: 42 }; // バストアップ・左寄せ
    case 'charFace': return { pos: [shX * 0.1, 5.2, L(12.8, 12)], rot: [0, 0, 0], fov: 34 }; // 顔アップ・ゆっくり寄り
    case 'charFeet': return { pos: [shX * 0.1, 1.4, 12.5], rot: [0, 0, 0], fov: 40 }; // すね〜スカート周辺（接地面は映さない＝浮きを避ける）
  }
};

const Rig: React.FC<{ bass: number }> = ({ bass }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // 音ハメ：低音でごく控えめに（酔わない範囲・荘厳さ優先）
  const amp = 0.012 + bass * 0.07;
  const shX = Math.sin(frame * 1.0) * amp;
  const shY = Math.cos(frame * 0.8) * amp;
  const { cut, local } = cutAt(t);
  const s = shotFor(cut.kind, local, t, [shX, shY]);
  return <PerspectiveCamera makeDefault fov={s.fov} position={s.pos} rotation={s.rot} near={0.1} far={130} />;
};

export const useSeqTexture = (src: string | null): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) return;
    const handle = delayRender(`tex ${src}`);
    new THREE.TextureLoader().load(src,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; setTex(t); continueRender(handle); },
      undefined, (e) => { console.error('tex load failed', src, e); continueRender(handle); });
  }, [src]);
  return tex;
};

export const Character3D: React.FC<{ texture: THREE.Texture | null; pos: [number, number, number]; h: number; tint: string }> = ({ texture, pos, h, tint }) => {
  if (!texture) return null;
  return (
    <mesh position={pos} frustumCulled={false}>
      <planeGeometry args={[h * 0.667, h]} />
      {/* color を map に乗算＝うっすら暖色を乗せて3Dの赤い世界と馴染ませる（白世界は素の白） */}
      <meshBasicMaterial map={texture} color={tint} transparent alphaTest={0.2} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

// 元のシンプルな赤白明朝キネティック（サビ=赤特大＋グロー＋色収差）
const Lyrics: React.FC<{ placement: 'lower' | 'center' | 'big'; chroma: number; isWhite: number }> = ({ placement, chroma, isWhite }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const line = lyrics.find((l) => t >= l.t && t < l.end);
  if (!line) return null;
  const appear = frame - line.t * fps;
  const pop = spring({ frame: appear, fps, config: { damping: 14, mass: 0.4 }, durationInFrames: 10 });
  const isHook = line.text.includes(HOOK_TEXT);
  const big = placement === 'big' || isHook;
  const size = big ? 96 : placement === 'lower' ? 58 : 72;
  const white = isWhite > 0.4; // 落ちサビの白世界だけ文字色を可読に
  const color = isHook ? (white ? '#8a1424' : '#ff1030') : (white ? '#4a3814' : '#fff5f0');
  const cx = 3 + chroma * 8;
  const shadow = white
    ? '0 2px 10px rgba(255,255,255,0.55)'
    : `${cx}px 0 0 rgba(255,0,40,0.55), -${cx}px 0 0 rgba(0,180,255,0.5), 0 0 ${isHook ? 24 : 16}px rgba(255,40,60,0.8)`;
  return (
    <AbsoluteFill style={{ justifyContent: placement === 'lower' ? 'flex-end' : 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{
        fontFamily, fontWeight: isHook ? 900 : 700, fontSize: size, color,
        textAlign: 'center', letterSpacing: '0.08em', lineHeight: 1.3, whiteSpace: 'nowrap',
        marginBottom: placement === 'lower' ? '7%' : undefined, padding: '0 4%',
        transform: `scale(${0.9 + pop * 0.1})`, opacity: Math.min(1, pop * 1.5),
        textShadow: shadow,
      }}>{line.text}</div>
    </AbsoluteFill>
  );
};

export const MainScene: React.FC<{ audioSrc: string; hideLyrics?: boolean }> = ({ audioSrc, hideLyrics }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { cut } = cutAt(t);
  const sec = sectionAt(t);

  // 低音の強さ（0..1）＝音ハメの駆動源
  const audioData = useAudioData(audioSrc);
  const bass = useMemo(() => {
    if (!audioData) return 0;
    const v = visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 });
    return Math.min(1, ((v[0] + v[1] + v[2]) / 3) * 3.2);
  }, [audioData, frame, fps]);

  const isTunnel = cut.kind === 'tunnel';
  const isCharCut = cut.kind.startsWith('char');
  const charVisible = isCharCut || isTunnel;
  const charPos: [number, number, number] = isTunnel ? [0, 3.2, -92] : [0, 3.0, 8]; // 門前は手前・センターへ
  const charH = isTunnel ? 11 : 9;
  const seqIdx = (Math.floor(frame) % SEQ_LEN) + 1;
  const charSrc = charVisible ? staticFile(`char_seq/${String(seqIdx).padStart(3, '0')}.png`) : null;
  const charTexture = useSeqTexture(charSrc);
  const poppyTexture = useSeqTexture(staticFile('poppy.png'));

  const isDrop = sec.kind === 'drop' || sec.kind === 'finaldrop';
  // カット頭の軽いインパクト（白フラッシュのみ・控えめ／ネガ反転は廃止）
  const cutHit = useMemo(() => {
    const c = CUTS.find((c) => t >= c.t0 && t < c.t1);
    if (!c) return 0;
    const d = t - c.t0;
    return d >= 0 && d < 0.09 ? 1 - d / 0.09 : 0;
  }, [t]);
  const whiteFlash = isDrop ? cutHit * 0.2 : 0;
  const chroma = 0.0005 + bass * 0.0028 + (isDrop ? 0.0012 : 0);
  // 落ちサビ＝彼岸に渡る白世界（モノクロ＋明度上げ）へフェード
  const whiteWorld = sec.kind === 'breakdown'
    ? interpolate(t, [sec.t0, sec.t0 + 2.5, sec.t1 - 3, sec.t1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  const placement: 'lower' | 'center' | 'big' =
    isCharCut ? 'lower' : isDrop ? 'big' : 'center';

  return (
    <AbsoluteFill style={{ backgroundColor: '#050203' }}>
      <Audio src={audioSrc} />

      <AbsoluteFill style={{ filter: whiteWorld > 0.01 ? `grayscale(${whiteWorld * 0.5}) sepia(${whiteWorld * 0.45}) brightness(${1 + whiteWorld * 0.5}) contrast(${1 - whiteWorld * 0.06})` : undefined }}>
        <ThreeCanvas width={1920} height={1080} gl={{ antialias: true }} style={{ backgroundColor: '#050203' }}>
          <fog attach="fog" args={['#3a040a', 6, 62]} />
          <ambientLight intensity={0.4} color="#ff4d4d" />
          <directionalLight position={[-6, 10, 4]} intensity={0.55} color="#ffb0a0" />
          <pointLight position={[0, 1.5, -6]} color="#ff1a2e" intensity={90} distance={45} decay={1.8} />
          <pointLight position={[0, 0.5, 6]} color="#c00018" intensity={40} distance={30} decay={2} />
          {/* 金の聖性：門の上から差す暖色の光 */}
          <pointLight position={[0, 9, -2]} color="#ffcf7a" intensity={35} distance={30} decay={1.6} />
          <Rig bass={bass} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -50]}>
            <planeGeometry args={[200, 260]} />
            <MeshReflectorMaterial mirror={0.5} resolution={512} blur={[400, 120]} mixBlur={1.2}
              roughness={0.4} depthScale={0.5} color="#160406" metalness={0.4} />
          </mesh>
          <FlowerField texture={poppyTexture} />
          <Rocks />
          <ArchRow />
          <Petals frame={frame} />
          <Motes frame={frame} />

          <EffectComposer>
            <Bloom intensity={0.85} luminanceThreshold={0.45} luminanceSmoothing={0.9} mipmapBlur radius={0.6} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[chroma, chroma]} radialModulation={false} modulationOffset={0} />
            <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.25} />
            <Vignette eskil={false} offset={0.3} darkness={0.8} />
          </EffectComposer>
        </ThreeCanvas>

        {charVisible && (
          <ThreeCanvas width={1920} height={1080} gl={{ antialias: true, alpha: true }}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'transparent' }}>
            <Rig bass={bass} />
            <Character3D texture={charTexture} pos={charPos} h={charH} tint={whiteWorld > 0.4 ? '#c7bcae' : '#ffdccf'} />
          </ThreeCanvas>
        )}
      </AbsoluteFill>

      {/* 彼岸の白世界を作り込む：光の柱＋ゴッドレイ＋ステンドグラスの色光 */}
      {whiteWorld > 0.01 && (
        <>
          {/* 黄金のゴッドレイ（上から斜めに差す暖かい光・キャラの顔を白飛びさせないよう控えめ＆中心をずらす） */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld, mixBlendMode: 'screen',
            background: 'radial-gradient(120% 80% at 34% -10%, rgba(255,214,138,0.5), rgba(255,190,110,0.18) 42%, rgba(255,190,110,0) 62%)' }} />
          {/* 斜めの光柱（教会の窓から差す金の柱） */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.55, mixBlendMode: 'screen',
            background: 'linear-gradient(160deg, rgba(255,224,150,0.6) 0%, rgba(255,210,130,0.15) 32%, rgba(255,210,130,0) 55%)' }} />
          {/* 光の筋（ゴッドレイの線条・上から扇状に差す） */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.6, mixBlendMode: 'screen',
            background: 'repeating-linear-gradient(102deg, rgba(255,228,160,0) 0px, rgba(255,228,160,0.32) 2px, rgba(255,228,160,0.05) 12px, rgba(255,228,160,0) 34px)',
            WebkitMaskImage: 'radial-gradient(130% 95% at 46% -12%, #000 0%, rgba(0,0,0,0.5) 40%, transparent 70%)',
            maskImage: 'radial-gradient(130% 95% at 46% -12%, #000 0%, rgba(0,0,0,0.5) 40%, transparent 70%)' }} />
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.4, mixBlendMode: 'screen',
            background: 'repeating-linear-gradient(96deg, rgba(255,235,180,0) 0px, rgba(255,235,180,0.22) 1px, rgba(255,235,180,0) 7px, rgba(255,235,180,0) 52px)',
            WebkitMaskImage: 'radial-gradient(130% 95% at 50% -12%, #000 0%, transparent 68%)',
            maskImage: 'radial-gradient(130% 95% at 50% -12%, #000 0%, transparent 68%)' }} />
          {/* 全体を暖める金のウォッシュ */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.28, mixBlendMode: 'soft-light',
            background: 'linear-gradient(180deg, rgba(255,200,120,0.9), rgba(255,180,120,0.4))' }} />
          {/* ステンドグラスの色ガラス光（金の中に青赤を点じる＝聖性） */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.3, mixBlendMode: 'overlay',
            background: 'conic-gradient(from 205deg at 45% 8%, rgba(220,60,70,0.55), rgba(60,110,210,0.55), rgba(245,205,110,0.6), rgba(180,60,140,0.5), rgba(220,60,70,0.55))' }} />
          {/* 縦の光条（ステンドグラスの桟） */}
          <AbsoluteFill style={{ pointerEvents: 'none', opacity: whiteWorld * 0.16, mixBlendMode: 'overlay',
            background: 'repeating-linear-gradient(100deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 46px, rgba(0,0,0,0.5) 49px)' }} />
        </>
      )}

      {!hideLyrics && <Lyrics placement={placement} chroma={bass} isWhite={whiteWorld} />}

      {/* 冒頭クレジット（全MV必須）。ポストエフェクトの外＝2Dオーバーレイ層に置く（色収差で潰れないため） */}
      <Credits cards={credits} sec={frame / fps} />

      {whiteFlash > 0 && <AbsoluteFill style={{ pointerEvents: 'none', backgroundColor: `rgba(255,240,235,${whiteFlash})` }} />}
      <AbsoluteFill style={{ pointerEvents: 'none', boxShadow: 'inset 0 0 320px 90px rgba(0,0,0,0.9)' }} />
    </AbsoluteFill>
  );
};
