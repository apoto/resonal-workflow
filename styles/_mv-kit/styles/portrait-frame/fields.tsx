import React from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { FieldDef, FieldProps, registerFields } from '../../src/registry';
import { Tone, pal, toneFilter } from './engine';

/**
 * portrait-frame の「面」。
 *
 * ★動画パスも画像パスも色も**すべて params / palette から受け取る**。ここに焼き込まない。
 * 正本ルール: direction-library/records/flat-field-swap.md（面を小節頭で丸ごと入れ替える）
 */

// ------------------------------------------------------------------ video

/**
 * 短尺動画をループさせる面。portrait-frame の核（plate-swap との差分がここ）。
 *
 * ★tail_image で作った素材は始点≒終点（実測 継ぎ目差 1.2〜1.5）なので、
 *   やむを得ずループする場合はそちらを使う。
 *
 * ★`transparent` を付けないと OffthreadVideo はアルファを落とす。
 *   ここは背景なのでアルファ不要だが、前景に使う派生を作るときは注意。
 */
const VideoField: React.FC<FieldProps> = ({ local, params, palette }) => {
  const { fps, width, height } = useVideoConfig();
  const p = {
    src: params.src as string | undefined,
    /** 素材の実尺（秒）。ループ長の決定に使う */
    sec: (params.sec as number) ?? 5,
    rate: (params.rate as number) ?? 1,
    /** ゆっくりした寄り。1.0 で等倍のまま */
    zoom: (params.zoom as number) ?? 1.06,
    /** 面を白へ寄せる量（0〜1）。高明度パレットで面が重いときに使う */
    wash: (params.wash as number) ?? 0,
    blur: (params.blur as number) ?? 0,
    /** 面だけに掛けるトーン（mono/blue/deep/ice）。素材を増やさずに画変わりを作る */
    tone: params.tone as Tone | undefined,
  };
  const t = local / fps;

  if (!p.src) return <AbsoluteFill style={{ background: pal(palette, 'ground') }} />;

  // 面はゆっくり寄り続ける（静止画に見せないため／cut-entry-drift と同じ思想）
  const scale = p.zoom + t * 0.004;

  return (
    <AbsoluteFill style={{ background: pal(palette, 'ground'), overflow: 'hidden' }}>
      <Loop durationInFrames={Math.max(1, Math.round((p.sec / p.rate) * fps))} layout="none">
        <OffthreadVideo
          src={staticFile(p.src)}
          muted
          playbackRate={p.rate}
          style={{
            position: 'absolute',
            width: width * scale,
            height: height * scale,
            left: (width - width * scale) / 2,
            top: (height - height * scale) / 2,
            objectFit: 'cover',
            filter: [toneFilter(p.tone), p.blur > 0 ? `blur(${p.blur}px)` : undefined]
              .filter(Boolean).join(' ') || undefined,
          }}
        />
      </Loop>
      {p.wash > 0 && (
        <AbsoluteFill style={{ background: pal(palette, 'ground'), opacity: p.wash }} />
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ plate

/**
 * 静止画プレートを 微速のズーム＋パンで動かす面。
 * Kling を使わずに「動いている面」を無料で増やすための層＝portrait-frame のコスト設計の本体
 * （skill mv-styles §11 の調達分担表: 静止プレートは codex 生成＋微速ズーム/パン）。
 *
 * ★完全静止フレーム禁止（mv-production.md 骨格検査）なので、zoom/pan のどちらかは必ず動かす。
 */
const PlateField: React.FC<FieldProps> = ({ local, params, palette, durationInFrames }) => {
  const p = {
    src: params.src as string | undefined,
    /** 開始/終了のズーム。push-in なら from<to、pull-out なら from>to */
    from: (params.from as number) ?? 1.02,
    to: (params.to as number) ?? 1.14,
    /** パン方向（画面幅比）。0 で寄りだけ */
    panX: (params.panX as number) ?? 0.02,
    panY: (params.panY as number) ?? 0,
    wash: (params.wash as number) ?? 0,
    tone: params.tone as Tone | undefined,
  };
  const prog = durationInFrames > 1 ? local / (durationInFrames - 1) : 0;
  const scale = p.from + (p.to - p.from) * prog;
  // ★寸法は親の枠に対する % で持つ（useVideoConfig は縦ショートの 1080x1920 を返し、16:9 の world で幅が足りず端が見切れた）
  const pct = (v: number) => `${v * 100}%`;

  if (!p.src) return <AbsoluteFill style={{ background: pal(palette, 'ground') }} />;

  return (
    <AbsoluteFill style={{ background: pal(palette, 'ground'), overflow: 'hidden' }}>
      <Img
        src={staticFile(p.src)}
        style={{
          position: 'absolute',
          width: pct(scale),
          height: pct(scale),
          left: pct((1 - scale) / 2 - p.panX * prog),
          top: pct((1 - scale) / 2 - p.panY * prog),
          objectFit: 'cover',
          filter: toneFilter(p.tone),
        }}
      />
      {p.wash > 0 && <AbsoluteFill style={{ background: pal(palette, 'ground'), opacity: p.wash }} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ solid

/** 単色の面。白飛び明けや章の間に1〜2秒だけ挟む「無」の面。 */
const SolidField: React.FC<FieldProps> = ({ params, palette }) => (
  <AbsoluteFill style={{ background: pal(palette, (params.tone as string) ?? 'ground') }} />
);

const defs: FieldDef[] = [
  {
    id: 'portrait-frame.video',
    style: 'portrait-frame',
    name: '動画の面',
    record: 'flat-field-swap',
    description:
      '短尺動画を Remotion の <Loop> で回す面。portrait-frame の核。1周をセクションより長くしてループの継ぎ目を出さない（rate で調整）。',
    component: VideoField,
  },
  {
    id: 'portrait-frame.plate',
    style: 'portrait-frame',
    name: '静止プレート（微速ズーム/パン）',
    record: 'cut-entry-drift',
    description:
      '静止画を微速のズーム＋パンで動かす面。動画生成を使わずに面を増やすための層。完全静止フレーム禁止の担保も兼ねる。',
    component: PlateField,
  },
  {
    id: 'portrait-frame.solid',
    style: 'portrait-frame',
    name: '単色の面',
    record: 'flat-field-swap',
    description: '単色。白飛び明けや章の切れ目に1〜2秒挟む「無」の面。',
    component: SolidField,
  },
];

registerFields(...defs);
export const portraitFrameFields = defs;
