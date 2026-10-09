import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

// invert-shapes の背景＝暗い単色の下地＋ cover.png（曲ごとの1枚絵）。色は meta.bgColor で差し替える。
// invert-shapes core のネガポジ反転は歌詞レイヤの isolate 内で完結するので、背景は「金属と蛍光灯」に徹する。
const DEFAULT_BG = '#0d0b12';

type Region = { a: number; b: number };
const inRegion = (t: number, rs?: Region[]) => !!rs?.some((r) => t >= r.a && t < r.b);
// region 内での進行度 0→1（progressive-blackout 用）
const regionProgress = (t: number, rs?: Region[]) => {
  const r = rs?.find((x) => t >= x.a && t < x.b);
  return r ? (t - r.a) / Math.max(0.001, r.b - r.a) : 0;
};

/**
 * ★指定区間だけループ動画を敷く（区間外は何も出さない＝下の静止画が見える）。
 * 全編に動画を敷くと Breakdown / Bridge の「静」が消えて振り子が死ぬので、
 * 間奏など「動いていてほしい区間」だけに限定して使う。
 */
const RegionLoop: React.FC<{ src: string; clipSec: number; a: number; b: number }> = ({ src, clipSec, a, b }) => {
  const { fps } = useVideoConfig();
  const from = Math.max(0, Math.round(a * fps));
  const dur = Math.max(1, Math.round((b - a) * fps));
  const clip = Math.max(1, Math.round(clipSec * fps));
  const n = Math.ceil(dur / clip);
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      {Array.from({ length: n }, (_, i) => (
        <Sequence key={i} from={i * clip} durationInFrames={Math.min(clip, dur - i * clip)} layout="none">
          <AbsoluteFill>
            <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </AbsoluteFill>
        </Sequence>
      ))}
    </Sequence>
  );
};

export const Background: React.FC<{
  src?: string;
  video?: string;
  videoSec?: number;
  color?: string;
  /** 秒（ショートは startSec 分だけ進めた曲内時刻を渡す） */
  t?: number;
  calmRegions?: Region[];
  faceRegions?: Region[];
  /** 蛍光灯フリッカーを効かせる区間（Intro） */
  flickerUntil?: number;
  /** 動画背景を出す区間（ここ以外は静止画） */
  videoRegions?: Region[];
  /** カメラワーク区間 */
  cameraMoves?: {
    a: number; b: number;
    kind: 'pan-up' | 'push-in' | 'pull-out' | 'drift' | 'pan-focus' | 'pull-focus';
    amount?: number; fromY?: number; toY?: number; fromScale?: number; toScale?: number;
  }[];
  /** ビルドアップ区間（明るさが徐々に上がる） */
  buildRegions?: Region[];
  /** 電光の強さ 0-1（イナズマと同時にカメラを跳ねさせる） */
  spark?: number;
}> = ({
  src, video, videoSec, color, t = 0, calmRegions, faceRegions,
  flickerUntil = 14.06, videoRegions, cameraMoves, buildRegions, spark = 0,
}) => {
  const frame = useCurrentFrame();
  const { height: VH } = useVideoConfig();   // 縦(1920)でも正しく効かせる
  const base = color ?? DEFAULT_BG;

  // ---- カメラワーク（records: push-in / pull-out / vanishing-point-rush の思想）----
  // 既定は微ドリフト（cut-entry-drift＝完全静止フレーム禁止の保険）
  let scale = 1.03 + Math.sin(frame / 130) * 0.012;
  let tx = Math.sin(frame / 190) * 8;
  let ty = 0;
  const mv = cameraMoves?.find((m) => t >= m.a && t < m.b);
  if (mv) {
    const u = (t - mv.a) / Math.max(0.001, mv.b - mv.a); // 0→1
    const amt = mv.amount ?? 1;
    if (mv.kind === 'pan-up') {
      // 下→上へゆっくり。寄りは一定（静かだが「動いている」を作る）
      scale = 1.10;
      ty = (0.5 - u) * 110 * amt;
      tx = Math.sin(frame / 210) * 5;
    } else if (mv.kind === 'push-in') {
      // ★ビルドアップ: p³ で後半に急加速して寄る（期待感）
      const e = u * u * u;
      scale = 1.02 + 0.20 * e * amt;
      ty = -e * 40 * amt;
      tx = Math.sin(frame / 120) * (3 + e * 10);
    } else if (mv.kind === 'pan-focus') {
      // ★被写体の一点から別の一点へ「寄りながら移動」（例: 足元→顔）
      //   ty = (0.5 - fy) * 1080 で、画像の相対位置 fy を画面中央に持ってくる
      //   （transform が scale→translate の順なので translate は scale 後の座標系で効く）
      const e = u * u;                      // 後半やや加速＝ビルドアップの期待感
      // ★黒帯が出ない条件: H=1080*s に対し H*(1-fy)>=540 かつ H*fy>=540
      //   （translate は scale の後に効くので必要な余白は scale 倍される）
      const s0 = mv.fromScale ?? 2.00;
      const s1 = mv.toScale ?? 2.30;
      const y0 = mv.fromY ?? 0.70;
      const y1 = mv.toY ?? 0.22;
      scale = s0 + (s1 - s0) * e;
      ty = (0.5 - (y0 + (y1 - y0) * e)) * VH;
      tx = Math.sin(frame / 200) * 4;
    } else if (mv.kind === 'pull-focus') {
      // ★Drop頭でドンと引いてから、指定の一点へ寄る（例: 終点はバストアップ）
      const back = Math.exp(-u * 6);        // 頭で最大の引き
      const s0 = mv.fromScale ?? 1.05;
      const s1 = mv.toScale ?? 2.40;
      const y0 = mv.fromY ?? 0.50;
      const y1 = mv.toY ?? 0.22;
      const e = 1 - back;                   // 引き切ってから寄っていく
      scale = s0 + (s1 - s0) * e;
      ty = (0.5 - (y0 + (y1 - y0) * e)) * VH;
      tx = Math.sin(frame / 170) * 5;
    } else if (mv.kind === 'pull-out') {
      // ★Drop頭でドンと引く → 以後ゆっくり寄り直す（落差を作る）
      const back = Math.exp(-u * 7);          // 頭で最大
      scale = 1.30 - 0.26 * back - 0.02 * (1 - u);
      ty = back * 24;
      tx = Math.sin(frame / 150) * 6;
    }
  }
  // ★イナズマが走ると同時にカメラが跳ねる。上へ弾いてすぐ戻る
  if (spark > 0.01) {
    scale += spark * 0.035;
    ty -= spark * 26;
  }

  // 静区間は段階的に暗く（progressive-blackout）
  const calm = inRegion(t, calmRegions);
  const calmP = regionProgress(t, calmRegions);
  // ★ビルドアップは逆＝徐々に明るくする（期待感）
  const build = inRegion(t, buildRegions);
  const buildP = regionProgress(t, buildRegions);
  // サビ/間奏は顔を見せる＝スクリムを外す（常時全開にすると顔が消える）
  const face = inRegion(t, faceRegions);

  const brightness = calm
    ? 0.62 - 0.22 * calmP
    : build
      ? 0.58 + 0.34 * buildP        // ★ビルド: 暗→明で持ち上げる
      : face
        ? 0.86
        : 0.70;
  const scrim = face ? 0.12 : build ? 0.42 - 0.30 * buildP : calm ? 0.34 : 0.58;
  const wash = face ? 0.0 : build ? 0.10 * (1 - buildP) : 0.10;

  // 切れかけの蛍光灯（Intro のみ・1秒3回以下＝光過敏対策）
  const flick =
    t < flickerUntil
      ? 1 + (Math.sin(t * 5.1) > 0.86 ? 0.30 : 0) - (Math.sin(t * 2.3) > 0.94 ? 0.22 : 0)
      : 1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: base }}>
      {/* 静止画は常に下に敷く（動画区間の外はこれが見える） */}
      {src ? (
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
            // 金属＝彩度を落として明暗のコントラストを立てる（極彩色にしない）
            filter: `saturate(0.80) contrast(1.10) brightness(${brightness * flick})`,
          }}
        />
      ) : null}
      {/* ★動画は指定区間だけ静止画の上に重ねる（間奏など「動いていてほしい所」限定） */}
      {video && videoRegions?.length
        ? videoRegions.map((r, i) => (
            <AbsoluteFill
              key={i}
              style={{
                filter: `saturate(0.80) contrast(1.10) brightness(${brightness * flick})`,
                transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
              }}
            >
              <RegionLoop src={video} clipSec={videoSec ?? 5} a={r.a} b={r.b} />
            </AbsoluteFill>
          ))
        : null}

      {/* 粒子（常時併走＝完全静止フレーム禁止の保険）。乾いた冬の埃。 */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {Array.from({ length: 26 }).map((_, i) => {
          const sp = 0.10 + ((i * 37) % 11) / 46;
          const x = ((i * 79) % 100) + Math.sin((frame + i * 24) / 96) * 2.2;
          const y = (100 - ((frame * sp + i * 41) % 118)) % 118;
          const s = 1 + ((i * 13) % 5) * 0.5;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: s,
                height: s,
                borderRadius: '50%',
                background: '#f2f4f8',
                opacity: 0.05 + ((i * 7) % 9) / 90,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* 黒ヴィネット（金属の暗がり） */}
      <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 44%, transparent 26%, ${base}E6 100%)` }} />
      {/* 中央スクリム: 歌詞の可読性。energy駆動でサビは外す */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(62% 46% at 50% 52%, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,0) 100%)`,
        }}
      />
      {wash > 0 ? <AbsoluteFill style={{ background: `rgba(6,5,10,${wash})` }} /> : null}
    </AbsoluteFill>
  );
};
