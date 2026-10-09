import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FieldDef, FieldProps, registerFields } from '../../src/registry';
import { pal, seeded } from './engine';

/**
 * plate-swap の「面」（背景そのもの）。
 *
 * ★画像パスも色も**すべて params / palette から受け取る**。ここに焼き込まない。
 *   曲ごとに都市が別の街になり、ベタ面の色が黄でなくなるのが前提。
 *
 * 正本ルール: direction-library/records/flat-field-swap.md
 */

// ---------------------------------------------------------------- photo-city

/**
 * 写真的な地を層に割ってパララックスさせる面。
 * 参照実測（隣接0.1秒の領域別移動量）: 左端-7 / 中央-1 / 右端-5 px。
 * 単一の静止画では説明できず、層ごとに移動量が違った＝これを再現する層。
 *
 * layered=true。近景は**被写体の手前**に出す。後ろに全部置くと被写体が浮く。
 */
const PhotoCity: React.FC<FieldProps> = ({ local, params, palette, layer }) => {
  const { fps, width, height } = useVideoConfig();
  const t = local / fps;
  const p = {
    far: params.far as string | undefined,
    mid: params.mid as string | undefined,
    near: params.near as string | undefined,
    pan: (params.pan as number) ?? 1,
    /** 各層の高さ（画面高比）。幅基準だと 16:9 で下に地が抜ける */
    farH: (params.farH as number) ?? 1.12,
    midH: (params.midH as number) ?? 0.92,
    nearH: (params.nearH as number) ?? 0.78,
    /** 窓明かりの明滅の数。0で無効 */
    flicker: (params.flicker as number) ?? 90,
  };
  const L = (mul: number) => -t * width * 0.012 * mul * p.pan;

  if (layer === 'front') {
    // 近景だけ被写体の手前に
    return p.near ? (
      <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
        <Img
          src={staticFile(p.near)}
          style={{
            position: 'absolute',
            height: height * p.nearH,
            width: 'auto',
            left: L(1.6),
            bottom: -height * 0.12,
          }}
        />
      </AbsoluteFill>
    ) : null;
  }

  return (
    <AbsoluteFill style={{ background: pal(palette, 'sky'), overflow: 'hidden' }}>
      {p.far && (
        <Img
          src={staticFile(p.far)}
          style={{ position: 'absolute', height: height * p.farH, width: 'auto', left: L(0.25), top: -height * 0.06 }}
        />
      )}
      {p.mid && (
        <Img
          src={staticFile(p.mid)}
          style={{ position: 'absolute', height: height * p.midH, width: 'auto', left: L(0.7), bottom: -height * 0.05 }}
        />
      )}
      {p.flicker > 0 && <WindowFlicker n={p.flicker} local={local} color={pal(palette, 'glow')} />}
    </AbsoluteFill>
  );
};

/**
 * 窓明かりの明滅。
 * 参照は最良シフト後の残差>40 が面積の15.1%＝全面に散った明滅があった。
 * 静止画の都市が「生きている」ように見えるかはこれ1つで決まる。
 */
const WindowFlicker: React.FC<{ n: number; local: number; color: string }> = ({ n, local, color }) => {
  const { width, height } = useVideoConfig();
  const nodes = new Array(n).fill(0).map((_, i) => {
    const r = (k: number) => seeded(i * 12.9898 + k * 78.233);
    const period = Math.floor(14 + r(1) * 46);
    const on = (local + Math.floor(r(2) * period)) % period < 2;
    return { x: r(3) * width, y: height * (0.28 + r(4) * 0.66), s: 2 + r(5) * 5, on };
  });
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
      {nodes
        .filter((v) => v.on)
        .map((v, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: v.x,
              top: v.y,
              width: v.s,
              height: v.s * 1.6,
              background: color,
              filter: 'blur(0.6px)',
            }}
          />
        ))}
    </AbsoluteFill>
  );
};

// -------------------------------------------------------------- flat-skyline

/**
 * 単色ベタ面＋シルエットのビル群。画像不要（SVG）。
 *
 * ★最初は1本ずつ高さを振った細い歯で作ったが、**音声波形に見えた**（実際そう見えた）。
 *   ビルは「平らな屋上を持つ幅のある塊」なので、幅を持つ矩形の並び＋屋上の塔屋で作る。
 */
const FlatSkyline: React.FC<FieldProps> = ({ params, palette }) => {
  const { width, height } = useVideoConfig();
  const p = {
    /** シルエットの高さ倍率。0 で面だけ */
    drip: (params.drip as number) ?? 1,
    /** true で下から立ち上げる（覆う→支える に意味が変わる） */
    fromBottom: Boolean(params.fromBottom),
    seed: (params.seed as number) ?? 0,
  };
  const r = (i: number) => seeded(i * 3.7 + p.seed * 91.3);
  const blocks: { x: number; w: number; h: number }[] = [];
  let bx = 0;
  for (let i = 0; bx < width; i++) {
    const w = width * (0.026 + r(i) * 0.055);
    const h = height * (0.1 + r(i + 77) * 0.3) * p.drip;
    blocks.push({ x: bx, w, h });
    bx += w;
  }
  const ink = pal(palette, 'ink');
  return (
    <AbsoluteFill style={{ background: pal(palette, 'field'), overflow: 'hidden' }}>
      <svg width={width} height={height} style={{ position: 'absolute' }}>
        <g transform={p.fromBottom ? `translate(0,${height}) scale(1,-1)` : undefined}>
          {blocks.map((b, i) => (
            <rect key={i} x={b.x} y={0} width={b.w + 1} height={b.h} fill={ink} />
          ))}
          {/* 屋上の塔屋・アンテナ。ビルらしさは天端の小さな出っ張りで出る */}
          {blocks.map((b, i) =>
            r(i + 301) > 0.55 ? (
              <rect
                key={`t${i}`}
                x={b.x + b.w * (0.2 + r(i + 401) * 0.5)}
                y={b.h}
                width={b.w * (0.1 + r(i + 501) * 0.18)}
                height={height * 0.035 * p.drip}
                fill={ink}
              />
            ) : null
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// -------------------------------------------------------------------- plain

/** 単色の高キー面（静の極）。フラット。グラデを入れると「ベタ面」でなくなり効果が消える。 */
const Plain: React.FC<FieldProps> = ({ params, palette }) => (
  <AbsoluteFill style={{ background: pal(palette, (params.key as 'paper' | 'sky' | 'field') ?? 'paper') }} />
);


// -------------------------------------------------------------- photo-plate

/**
 * photo-city は遠/中/近の3層パララックス専用（left/height が層前提）で、
 *   **生成した16:9の1枚絵を全画面で出す口が無かった**。
 *   カメラを止める設計（F4=固定）の曲では、パンもズームもしない静止した面が必要になる。
 *   pan/zoom は既定 0＝完全静止。動かしたい区間だけ params で足す。
 */
const PhotoPlate: React.FC<FieldProps> = ({ local, params }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const seq = params.seq as { dir: string; len: number; fps?: number } | undefined;
  const src = seq && seq.len > 0
    ? `${seq.dir}/${String(Math.floor((((local ?? frame) / fps) * (seq.fps ?? fps)) % seq.len) + 1).padStart(3, '0')}.png`
    : (params.src as string | undefined);
  const pan = (params.pan as number) ?? 0;        // 横に流す量（画面幅比）。既定0＝静止
  const zoom = (params.zoom as number) ?? 0;      // 尺の間に寄る量（倍率の増分）。既定0＝静止
  const p = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
  if (!src) return <AbsoluteFill />;
  const z = zoom >= 0 ? zoom * p : -zoom * (1 - p);
  const w = 100 * (1 + z) + Math.abs(pan) * 100;
  const panLeft = pan >= 0 ? -pan * 100 * p : pan * 100 * (1 - p);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          width: `${w}%`,
          height: `${100 * (1 + z)}%`,
          objectFit: 'cover',
          left: `${panLeft - (z * 100) / 2}%`,
          top: `${-(z * 100) / 2}%`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * 面を**歌い出しで差し替える**（`records/flat-field-swap`）。
 *
 * params: srcs（画像パスの配列）/ at（**絶対秒**の配列。srcs[i+1] へ切り替わる時刻）/ dip（切替の暗転秒）
 */
const PlateSwap: React.FC<FieldProps> = ({ local, sectionFrom, params }) => {
  const { fps } = useVideoConfig();
  const srcs = (params.srcs as string[] | undefined) ?? [];
  const at = (params.at as number[] | undefined) ?? [];
  const dip = (params.dip as number) ?? 0;
  if (srcs.length === 0) return null;

  const t = sectionFrom + local / fps;                 // 絶対秒に直す
  let i = 0;
  at.forEach((sec, k) => { if (t >= sec) i = k + 1; });
  const idx = Math.min(i, srcs.length - 1);

  // 切替の直後だけ軽く沈める（1フレームのハードカットだと目が痛い区間があるので任意）
  const last = idx === 0 ? -Infinity : at[idx - 1];
  const k = dip > 0 ? interpolate(t - last, [0, dip], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Img
        src={staticFile(srcs[idx])}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', left: 0, top: 0, opacity: k }}
      />
    </AbsoluteFill>
  );
};

/**
 * 1枚絵＋**画の光っている所そのものを明滅させる**。
 *
 * 実装: 素材画像を n 枚のレイヤーとして重ね、各レイヤーを別位相で揺らし、
 *   CSS mask（放射グラデーションの集合）で担当領域だけを通す。
 *   領域の中心は windows（機械検出した矩形の中心）を使うが、**描くのは矩形ではなくマスクの穴**。
 *
 * params:
 *   src / windows … 面の画像と、明滅の中心（画面比 [x,y,w,h]）
 *   amount        … 明滅の強さ（0..1・既定 0.45）
 *   rate          … 揺れの基準速度（既定 0.7）
 *   groups        … 位相を分けるレイヤー数（既定 5。増やすほど窓ごとにバラつく）
 *   feather       … マスクの柔らかさ（担当半径に対する比・既定 0.55）
 */
const TvFlicker: React.FC<FieldProps> = ({ local, params }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  /** 連番（Kling の面ループ）にも掛けられる＝イントロのような動く面も光らせられる */
  const seq = params.seq as { dir: string; len: number; fps?: number } | undefined;
  const src = seq && seq.len > 0
    ? `${seq.dir}/${String(Math.floor((((local ?? frame) / fps) * (seq.fps ?? fps)) % seq.len) + 1).padStart(3, '0')}.png`
    : (params.src as string | undefined);
  const wins = (params.windows as [number, number, number, number][] | undefined) ?? [];
  const amount = (params.amount as number) ?? 0.45;
  const rate = (params.rate as number) ?? 0.7;
  const groups = (params.groups as number) ?? 5;
  const feather = (params.feather as number) ?? 0.55;
  const t = (local ?? frame) / fps;
  if (!src) return <AbsoluteFill />;

  // 窓を groups 個の位相グループに分ける（seeded＝再レンダーで同じ絵）
  const buckets: string[][] = Array.from({ length: groups }, () => []);
  wins.forEach(([x, y, w, h], i) => {
    const cx = (x + w / 2) * 100;
    const cy = (y + h / 2) * 100;
    // 担当半径は窓の大きさから。羽根を付けて境目を出さない
    const r = Math.max(w, h) * (1 + feather) * 100;
    buckets[Math.floor(seeded(i * 7.3) * groups) % groups].push(
      `radial-gradient(ellipse ${r * 0.6}% ${r * 0.75}% at ${cx}% ${cy}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)`,
    );
  });

  const glow = (params.glow as number) ?? 0;
  const glowBlur = (params.glowBlur as number) ?? 14;
  const glowPulse = 0.88 + 0.12 * Math.sin(t * rate * 0.6 * Math.PI * 2);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#000' }}>
      <Img
        src={staticFile(src)}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', left: 0, top: 0 }}
      />
      {glow > 0 ? (
        <Img
          src={staticFile(src)}
          style={{
            position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', left: 0, top: 0,
            mixBlendMode: 'screen',
            opacity: glow * glowPulse,
            filter: `blur(${glowBlur}px) brightness(1.25) saturate(1.35)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {buckets.map((mask, gi) => {
        if (!mask.length) return null;
        const ph = seeded(gi * 3.7) * Math.PI * 2;
        const sp = rate * (0.6 + seeded(gi * 11.3) * 1.4);
        // 正弦2本を掛けて規則的すぎない揺れにする（単一の sin は点滅に見える）
        const v = 0.5 + 0.5 * Math.sin(t * sp * Math.PI * 2 + ph) * Math.sin(t * sp * 0.37 * Math.PI * 2 + ph * 1.7);
        const m = mask.join(',');
        return (
          <Img
            key={gi}
            src={staticFile(src)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              left: 0,
              top: 0,
              // ★光るのは「元の絵で光っている画素」だけ＝形は自動的にものの形に沿う
              mixBlendMode: 'screen',
              opacity: v * amount,
              maskImage: m,
              WebkitMaskImage: m,
              maskComposite: 'add',
              WebkitMaskComposite: 'source-over',
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const PLATE_SWAP_FIELDS: FieldDef[] = [
  {
    id: 'plate-swap.photo-city',
    style: 'plate-swap',
    name: '写真的な地の3層パララックス',
    record: 'parallax-layer-separation',
    layered: true,
    description:
      '遠/中/近の3層を別速度で流す。近景は被写体の手前に出て足元を隠す（layered）。画像パスは far/mid/near、揺れは flicker、速度は pan。窓明滅で静止画が生きて見える。',
    component: PhotoCity,
  },
  {
    id: 'plate-swap.photo-plate',
    style: 'plate-swap',
    name: '1枚絵をそのまま全画面',
    record: 'flat-field-swap',
    description:
      '生成した16:9の1枚絵を objectFit:cover で全画面に出す。src が画像パス。pan/zoom は既定0＝完全静止（カメラを止める設計の曲用）。'
      + '★`seq: {dir,len,fps}` を渡すと **Kling の面ループ（連番）を再生**する（キャラは Figure.seq / 面はこちら）。',
    component: PhotoPlate,
  },
  {
    id: 'plate-swap.tv-flicker',
    style: 'plate-swap',
    name: '1枚絵＋窓ごとのテレビの明滅',
    record: 'flat-field-swap',
    description:
      '素材の画そのものを screen で重ね、位相の違うグループごとに opacity を揺らす。'
      + '★光るのは**元の絵で光っている画素だけ**なので、形は自動的に「ものの形」に沿う（矩形が見えない）。'
      + 'windows は明滅の中心を決めるだけで、矩形は描かない。'
      + '★動画生成に投げず**コードで作る種類の動き**（Kling に同じ発注をしたら窓の輝度が1〜3/255しか動かなかった）。',
    component: TvFlicker,
  },
  {
    id: 'plate-swap.plate-swap',
    style: 'plate-swap',
    name: '面を歌い出しで差し替える',
    record: 'flat-field-swap',
    description:
      '16:9の1枚絵を複数持ち、at（絶対秒）で差し替える。切替は拍頭ではなく**歌い出しの実測秒**に合わせる（テンポが動く曲では小節グリッドがずれる）。dip>0 で切替直後を軽く沈める。',
    component: PlateSwap,
  },
  {
    id: 'plate-swap.flat-skyline',
    style: 'plate-swap',
    name: '単色ベタ面＋シルエットのビル群',
    record: 'flat-field-swap',
    description:
      '画像不要。palette の field 色でベタ塗り、ink 色で幅を持つビル群のシルエット。drip で高さ、fromBottom で下から立ち上げ。転換のキメに1小節だけ。',
    component: FlatSkyline,
  },
  {
    id: 'plate-swap.plain',
    style: 'plate-swap',
    name: '単色の高キー面（静の極）',
    record: 'flat-field-swap',
    description: 'palette の paper（既定）で塗るだけ。key で sky/field にも切替。図は小さく置く＝余白が主役。',
    component: Plain,
  },
];

registerFields(...PLATE_SWAP_FIELDS);
