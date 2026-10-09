import React from 'react';
import { AbsoluteFill, Img, interpolate, Loop, staticFile, useCurrentFrame, useVideoConfig, Video } from 'remotion';
import { PALETTE, PosePopFx } from './PinkBounce';
import { cameraAt } from './Camera';
import { Grade, Scene, Section, SectionName } from './types';

// サビごとのポーズ順。同じ4ポーズでも巡り方を変えると「同じ動きの繰り返し」に見えない。
const POSE_ORDERS: number[][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

// サビでキャラが「腰でグルーヴ」して見えるダンスボブ。
// 実体は背景画像全体の変形だが、transform-origin を腰の高さ(50% 78%)に置くことで
// 上半身/頭が大きくスウェイし「女の子が踊ってる」ように読める。
// grooveRegions（秒・絶対タイム）内でのみ発火、境界0.6sでイーズイン/アウト。
export const grooveAt = (sec: number, regions: [number, number][] | undefined): number => {
  if (!regions) return 0;
  let g = 0;
  for (const [s, e] of regions) {
    if (sec >= s && sec <= e) {
      g = Math.max(g, Math.min(1, (sec - s) / 0.6, (e - sec) / 0.6));
    }
  }
  return g;
};

/** 今の秒がどのシーンか。無ければ undefined（＝background 1枚運用にフォールバック） */
export const sceneAt = (sec: number, scenes: Scene[] | undefined): Scene | undefined =>
  scenes?.find((s) => sec >= s.start && sec < s.end);

/**
 * シーンの切り替わりカット。区間境界＝音楽的なキメなので、フェードせずハードカットして
 * 直後に白フラッシュ＋わずかなズームパンチを乗せる（pink-bounce の言語＝KawaiiBurst の軽量版）。
 * これが無いと絵が「いつのまにか変わってた」になって、シーンを足した効果が出ない。
 */
const CutFlash: React.FC<{ age: number }> = ({ age }) => {
  if (age < 0 || age > 0.34) return null;
  const f = 1 - age / 0.34;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(circle at 50% 46%, #ffffff 0%, ${PALETTE.GLOW} 55%, #ffffff 100%)`,
        opacity: Math.pow(f, 1.6) * 0.85,
        mixBlendMode: 'screen',
      }}
    />
  );
};

/**
 * 区間ごとの色。「同じ絵の使い回し」感を、光と色の変化で割る。
 * 元絵が 1672×941 しかなく寄りのクロップは画が甘くなるので、場面差はここで作る。
 * Aメロ=夕方の店先 / サビ=一番鮮やか / ブレイク=高コントラストで危険 /
 * 落ちサビ=ハイキーで色を抜く（静寂）/ アウトロ=夜へ寄せて締める。
 */
const GRADES: Record<SectionName, Grade> = {
  intro:     { saturate: 0.94, brightness: 1.02, contrast: 0.98, tint: '#ffd9a8', tintOpacity: 0.10, vignette: 0.22 },
  verse:     { saturate: 1.0,  brightness: 1.0,  contrast: 1.0,  tint: '#ffb27a', tintOpacity: 0.07, vignette: 0.16 },
  prechorus: { saturate: 1.06, brightness: 1.02, contrast: 1.03, tint: '#ff8fc7', tintOpacity: 0.06, vignette: 0.12 },
  build:     { saturate: 1.12, brightness: 1.04, contrast: 1.06, tint: '#ff5fa2', tintOpacity: 0.08, vignette: 0.10 },
  chorus:    { saturate: 1.18, brightness: 1.05, contrast: 1.04, vignette: 0.06 },
  post:      { saturate: 1.2,  brightness: 1.06, contrast: 1.08, tint: '#3df5c4', tintOpacity: 0.05, vignette: 0.08 },
  breakdown: { saturate: 1.3,  brightness: 1.02, contrast: 1.22, hueRotate: -8, tint: '#ff0044', tintOpacity: 0.09, vignette: 0.3 },
  bridge:    { saturate: 0.6,  brightness: 1.12, contrast: 0.9,  tint: '#e9e0ff', tintOpacity: 0.2,  vignette: 0.05 },
  outro:     { saturate: 0.86, brightness: 0.96, contrast: 1.0,  tint: '#7b5cff', tintOpacity: 0.16, vignette: 0.28 },
};

const EMPTY_GRADE: Grade = {};

/** 区間の入り/出でグレードを 0.8 秒クロスフェードして、色が「パッ」と変わらないようにする */
const gradeAt = (sec: number, section: Section | undefined): Grade => {
  if (!section) return EMPTY_GRADE;
  const g = GRADES[section.name] ?? EMPTY_GRADE;
  const k = Math.max(0, Math.min(1, (sec - section.start) / 0.8, (section.end - sec) / 0.8));
  const mix = (v: number | undefined, neutral: number) => neutral + ((v ?? neutral) - neutral) * k;
  return {
    saturate: mix(g.saturate, 1),
    brightness: mix(g.brightness, 1),
    contrast: mix(g.contrast, 1),
    hueRotate: mix(g.hueRotate, 0),
    tint: g.tint,
    tintOpacity: mix(g.tintOpacity, 0),
    vignette: mix(g.vignette, 0),
  };
};

export const Background: React.FC<{
  src: string;
  poses?: string[];
  groove?: number; // 0..1 ダンス強度（サビ）
  biteRegions?: [number, number][];
  bpm?: number;
  songSec?: number; // 曲の絶対秒（拍同期用）
  section?: Section;
  scene?: Scene;
  /** 9:16 なら true（scene.vertical を優先して使う） */
  vertical?: boolean;
}> = ({ src, poses, groove = 0, biteRegions, bpm = 120, songSec = 0, section, scene, vertical }) => {
  const { fps, width, height } = useVideoConfig();

  // カメラは Camera.ts に集約。サビは4小節ごとに手が変わり（単調さの解消）、
  // サビ以外も常時ケンバーンズ＋拍ポンプで動く（完全静止の解消）。
  const cam = cameraAt({
    sec: songSec,
    bpm,
    groove,
    section,
    ampScale: width < 1400 ? 0.62 : 1,
    frameW: width,
    frameH: height,
  });

  const beat = (songSec * bpm) / 60;
  const grade = gradeAt(songSec, section);

  // ---- シーン解決: サビ(poses)以外はその区間の絵1枚を出す ----
  // scene が無い曲は従来どおり background 1枚（後方互換）。
  const sceneSrc = scene && !scene.poses ? (vertical ? scene.vertical ?? scene.src : scene.src) : undefined;
  const cutAge = scene ? songSec - scene.start : 99;

  // サビ開始後、最初の2拍境界まで元絵を固定。その後は2拍ごとに4ポーズを進める。
  // グローバルframeではなく曲の絶対秒から求めるため、本編とShortで位相が一致する。
  const poseSources = sceneSrc ? [sceneSrc] : poses && poses.length > 0 ? poses : [src];
  let poseIndex = 0;
  let switchFrame = 99;
  let switchStep = 0;
  let poseFxActive = false;
  for (let regionIndex = 0; regionIndex < (biteRegions?.length ?? 0); regionIndex++) {
    const [start, end] = biteRegions![regionIndex];
    if (songSec < start || songSec > end) continue;
    const blockFloat = beat / 2;
    const firstBoundaryBlock = Math.ceil((start * bpm) / 120 - 1e-7);
    if (blockFloat >= firstBoundaryBlock) {
      const block = Math.floor(blockFloat + 1e-7);
      switchStep = block - firstBoundaryBlock + 1;
      // サビごとに食べる順番を変える（同じ4ポーズの同じ周回を3回見せると飽きる）。
      const order = POSE_ORDERS[regionIndex % POSE_ORDERS.length];
      poseIndex = order[switchStep % order.length] % poseSources.length;
      const boundarySec = (block * 120) / bpm;
      // 終端直前に新ポーズを一瞬だけ出すと残像に見える。最後の拍境界で元絵へ戻して締める。
      if (end - boundarySec < 0.5) poseIndex = 0;
      const phase = Math.max(0, blockFloat - block);
      switchFrame = phase * (120 / bpm) * fps;
      poseFxActive = switchFrame <= 10;
    }
    switchStep += regionIndex * 100;
    break;
  }

  const snap = poseFxActive
    ? interpolate(switchFrame, [0, 1, 4, 6], [1, 0.78, 0.16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const snapRot = [-0.35, 0.28, -0.22, 0.35][poseIndex] ?? 0;
  const fxScale = width < 1400 ? 0.82 : 1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          // 腰ピボットは「腰で振る」手のときだけ。寄り/ダッチアングルの手では画面中心を軸にする。
          transformOrigin: cam.hipPivot ? '50% 78%' : '50% 52%',
          filter: `saturate(${grade.saturate}) brightness(${grade.brightness}) contrast(${grade.contrast}) hue-rotate(${grade.hueRotate}deg)`,
          // カット直後だけ 4% 余分に寄って戻る＝ハードカットに衝撃を足す（ズームパンチ）
          transform: `translate(${cam.x}px, ${cam.y - 4 * snap}px) rotate(${cam.rot + snapRot * snap}deg) scale(${cam.scale * (1 + (cutAge >= 0 && cutAge < 0.3 ? (1 - cutAge / 0.3) * 0.04 : 0)) * (scene?.zoom ?? 1)}) scaleX(${1 + 0.016 * snap}) scaleY(${1 - 0.01 * snap})`,
        }}
      >
        {poseSources.map((poseSrc, i) => {
          const visible = i === 0 || i === poseIndex;
          const opacity = i === 0 || i === poseIndex ? 1 : 0;
          return (
            <Img
              key={poseSrc}
              src={staticFile(poseSrc)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                visibility: visible ? 'visible' : 'hidden',
                opacity,
              }}
            />
          );
        })}
      </AbsoluteFill>
      {/* 区間の色かぶり（時間帯の変化）。歌詞より下のレイヤーなので可読性は落ちない。 */}
      {grade.tint && (grade.tintOpacity ?? 0) > 0.002 && (
        <AbsoluteFill style={{ backgroundColor: grade.tint, opacity: grade.tintOpacity, mixBlendMode: 'soft-light' }} />
      )}
      {(grade.vignette ?? 0) > 0.002 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 46%, transparent 42%, rgba(60,10,50,${grade.vignette}) 100%)`,
          }}
        />
      )}
      {/* 高キーのパステルウォッシュ（ごく薄く） */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, #ffffff14 0%, #ffe9f41f 100%)`,
        }}
      />
      {/* Y2Kっぽい薄いドット網。固定だと「止まった画」を強調するので斜めにゆっくり流す。
          backgroundPosition だと毎フレーム再ラスタライズになるので特大レイヤーを transform で動かす。 */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: -68,
            top: -68,
            right: -68,
            bottom: -68,
            backgroundImage: `radial-gradient(${PALETTE.OUTLINE_IN}18 2px, transparent 2px)`,
            backgroundSize: '34px 34px',
            transform: `translate3d(${(songSec * 7) % 34}px, ${(songSec * 4.5) % 34}px, 0)`,
            opacity: 0.28,
          }}
        />
      </AbsoluteFill>
      <PosePopFx
        active={poseFxActive}
        poseIndex={poseIndex}
        switchFrame={switchFrame}
        switchStep={switchStep}
        fps={fps}
        scale={fxScale}
      />
      {/* シーン切替の白フラッシュ（絵が「いつのまにか変わってた」を防ぐ） */}
      <CutFlash age={cutAge} />
    </AbsoluteFill>
  );
};

// 完全静止の縦背景（ShortVideoDance のサビ前用）。
// breathe ズームすら入れない: 直後に切り替わるダンス動画の初期フレーム＝この画像そのものなので、
// スケールが 1 で一致していれば切替カットが視覚的に消える（サビ頭で「踊り出す」ように見える）。
export const StillBackground: React.FC<{ src: string }> = ({ src }) => {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, #ffffff14 0%, #ffe9f41f 100%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${PALETTE.OUTLINE_IN}18 2px, transparent 2px)`,
          backgroundSize: '34px 34px',
          opacity: 0.28,
        }}
      />
    </AbsoluteFill>
  );
};

// 動画ループ背景（ダンスのループ素材）。
// <OffthreadVideo> は黒コマが混じることがあるので <Video>＋all-intra 再エンコード素材を使う。
// スケールは定数（呼吸ズームなし）— 動画自体が動くので変形を足すと酔う。
export const VideoBackground: React.FC<{
  src: string;
  loopFrames: number; // all-intra再エンコード後の正確なフレーム数（末尾=先頭なら-1して渡す）
}> = ({ src, loopFrames }) => {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Loop durationInFrames={loopFrames} layout="none">
        <Video
          src={staticFile(src)}
          muted
          // currentTime=0ちょうどへのシークは空白フレームになる（ループ周回の先頭が毎回抜ける）。
          // 末尾フレーム=先頭フレームの素材なので、1フレームずらして1..loopFramesを使えば絵は同じ。
          startFrom={1}
          delayRenderTimeoutInMilliseconds={120000}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </Loop>
      {/* 静止画版と同じオーバーレイで質感を揃える */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, #ffffff14 0%, #ffe9f41f 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${PALETTE.OUTLINE_IN}18 2px, transparent 2px)`,
          backgroundSize: '34px 34px',
          opacity: 0.28,
        }}
      />
    </AbsoluteFill>
  );
};
