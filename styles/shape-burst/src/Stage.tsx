import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { PAL } from './ShapeBurst';
import { ENERGY as DATA, sampleEnergy as sample } from './energy';
import { InvertShapesMeta } from './types';
import { DUR, SEC } from './song';

/**
 * Stage — 多層パララックス背景。
 *
 * 1枚絵に scale を掛けるだけだと、寄るとボケる・奥行きが出ない・キャラが動かない。
 * そこでレイヤーを割り、1つのカメラを depth 係数で各層に分配する＝視差。
 *
 * レイヤー（奥→手前）と depth:
 *   1. bgFar        遠景の巨大雲プレート（キャラなし・フレームより大きい画） depth 0.20
 *   2. CloudBank    中景の雲（手続き的・シーンで出し入れ）                 depth 0.55
 *   3. Character    キャラ（表情差分 or 微動ループ連番）                   depth 1.00
 *   4. CloudNear    前景の綿（視差最速）                                   depth 1.55
 *   5. wash / flood 白ウォッシュ・白フラッシュ                             全面
 *
 * 緩急は input/energy.json の per-frame 信号（tools/02_energy.py 生成）:
 *   sec = セクション強度 0..1（ゆっくり）→ 彩度/コントラスト・白ウォッシュ量・雲の量
 *   hit = 打点 0..1（速く）            → 綿バースト
 * すべて手続き的（Math.random 不使用＝決定的にレンダーできる）。
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ez = (x: number) => 1 - Math.pow(1 - x, 3); // easeOutCubic
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/** 白フラッシュ（light-flood-wipe）は2回だけ（光過敏対策＝1秒3回以下）。 */
const FLOOD = [SEC.CHORUS1, SEC.FINAL];

// ---- 構図 --------------------------------------------------------------------------
// 歌詞は画面中央に出る＝中央バンドは文字の領域。キャラは片側に寄せ、引きを主軸にして
// 横に流れるカメラで見せる。
//
// z  = カメラのズーム加算（全層に効く＝視差もかかる）
// x,y= カメラのパン（全層・depth 倍）
// cx,cy = キャラレイヤーだけの追加オフセット(%) ＝ 中央から外すのはここ
// cz = キャラレイヤーだけのスケール倍率
type Shot = {
  z: number; x: number; y: number;
  cx: number; cy: number; cz: number;
  /** true のときキャラを顔アップ専用プレート（meta.charCloseup）で描く。 */
  closeup?: boolean;
};

const SHOTS: Record<string, Shot> = {
  // 引き＝主軸。キャラを左右いずれかの三分割点へ寄せ、反対側と中央を空ける。
  WIDE_L: { z: 0.00, x: 0, y: 0, cx: -20, cy: 2, cz: 0.84 },
  WIDE_R: { z: 0.00, x: 0, y: 0, cx: 20, cy: 2, cz: 0.84 },
  // 顔を見せる寄り。頭がプレート上端に接している立ち絵は拡大すると頭が切れるので、
  // 拡大ではなく横に寄せて作る。合計スケール（breathe×z×cz）を 0.97 以下に収める。
  NEAR_R: { z: 0.00, x: -2, y: 0, cx: 23, cy: 1.5, cz: 0.93 },
  NEAR_L: { z: 0.00, x: 2, y: 0, cx: -23, cy: 1.5, cz: 0.93 },
  // 最大の引き（negative-space）。小さく下へ置いて余白を最大化＝落ちサビ。
  FAR_C: { z: -0.04, x: 0, y: 0, cx: -9, cy: 7, cz: 0.70 },
  // 正面の引き。クレジット枠/Outro 用。
  WIDE_C: { z: 0.02, x: 0, y: 0, cx: 0, cy: 0, cz: 0.92 },
  // 本物の顔アップ。頭上に余白のある専用プレート（tools/pad_headroom.py で作る）へ差し替える。
  // キャラレイヤーは下端原点なので、頭上余白 p のとき合計スケール S < 1/(1-p) で頭頂が残る。
  FACE_R: { z: 0.04, x: -1, y: 0, cx: 15, cy: 1.0, cz: 0.98, closeup: true },
  FACE_L: { z: 0.04, x: 1, y: 0, cx: -15, cy: 1.0, cz: 0.98, closeup: true },
};
type ShotKey = keyof typeof SHOTS;

/**
 * 顔アップを短く差す秒。歌詞が画面幅いっぱいに出る所に置くと文字が顔に重なるので、
 * 歌詞の無い器楽の隙間に置く。
 */
const FACE_HITS: [number, ShotKey][] = [
  [SEC.INTERLUDE2 + 0.3, 'FACE_R'],
  [SEC.GAP + 0.3, 'FACE_L'],
];
const FACE_HOLD = 2.6;

/** 時刻 → 構図。同一構図を8小節以上続けない。 */
function shotAt(t: number): ShotKey {
  for (const [t0, k] of FACE_HITS) {
    if (t >= t0 && t < t0 + FACE_HOLD) return k;
  }
  if (t < SEC.VERSE1B) return 'WIDE_L';
  if (t < SEC.PRE1) return 'WIDE_R';
  if (t < SEC.CHORUS1) return 'NEAR_L';
  if (t < SEC.INTERLUDE1) {
    const k = Math.floor((t - SEC.CHORUS1) / 11) % 3;
    return (['NEAR_R', 'WIDE_L', 'NEAR_L'] as const)[k];
  }
  if (t < SEC.VERSE2) return 'WIDE_C';
  if (t < SEC.PRE2) {
    const k = Math.floor((t - SEC.VERSE2) / 11) % 3;
    return (['WIDE_R', 'NEAR_R', 'WIDE_L'] as const)[k];
  }
  if (t < SEC.INTERLUDE2) {
    const k = Math.floor((t - SEC.PRE2) / 11) % 3;
    return (['NEAR_L', 'WIDE_R', 'NEAR_R'] as const)[k];
  }
  if (t < SEC.BRIDGE) return 'WIDE_C';
  if (t < SEC.FINAL) return 'FAR_C';
  if (t < SEC.OUTRO) {
    const k = Math.floor((t - SEC.FINAL) / 8) % 4;
    return (['NEAR_R', 'WIDE_L', 'NEAR_L', 'WIDE_R'] as const)[k];
  }
  if (t < SEC.REPRISE) return 'WIDE_C';
  return 'NEAR_R';
}

/**
 * 横に流れるカメラ。区間ごとに向きを反転させ、セクション内で一定速度で流す。
 * 振幅は ±3% 程度＝酔わせない。
 */
function lateralDrift(t: number): number {
  const legs: [number, number, number][] = [
    // [開始秒, 終了秒, 速度(%/秒)]
    [0, SEC.VERSE1B, 0.30],
    [SEC.VERSE1B, SEC.PRE1, -0.34],
    [SEC.PRE1, SEC.CHORUS1, 0.42],
    [SEC.CHORUS1, SEC.INTERLUDE1, -0.26],
    [SEC.INTERLUDE1, SEC.VERSE2, 0.22],
    [SEC.VERSE2, SEC.PRE2, 0.20],
    [SEC.PRE2, SEC.INTERLUDE2, -0.24],
    [SEC.INTERLUDE2, SEC.BRIDGE, 0.30],
    [SEC.BRIDGE, SEC.FINAL, 0.12],
    [SEC.FINAL, SEC.OUTRO, -0.28],
    [SEC.OUTRO, SEC.GAP, 0.18],
    [SEC.GAP, DUR, 0.24],
  ];
  for (const [a, b, v] of legs) {
    if (t >= a && t < b) {
      const mid = (b - a) / 2;
      // 区間の中央を 0 にして ±に振る＝端で折り返さず、次の区間で向きが変わる
      return (t - a - mid) * v;
    }
  }
  return 0;
}

// ---- 表情スケジュール ------------------------------------------------------------------
// その表情の連番（meta.charSeqs）があれば連番を再生、無ければ差分静止画（meta.charPlates）。
export type ExprKey = 'base' | 'downcast' | 'sideglance' | 'fang' | 'closed';

const EXPR_CUES: { from: number; expr: ExprKey }[] = [
  { from: 0, expr: 'base' },
  { from: SEC.VERSE1B, expr: 'downcast' },
  { from: SEC.PRE1, expr: 'base' },
  { from: SEC.CHORUS1, expr: 'fang' },
  { from: SEC.INTERLUDE1, expr: 'base' },
  { from: SEC.VERSE2, expr: 'sideglance' },
  { from: SEC.PRE2, expr: 'fang' },
  { from: SEC.POST, expr: 'base' },
  { from: SEC.BRIDGE, expr: 'closed' },
  { from: SEC.FINAL, expr: 'fang' },
  { from: SEC.OUTRO, expr: 'base' },
  { from: SEC.REPRISE, expr: 'fang' },
];

function exprAt(t: number): ExprKey {
  let cur: ExprKey = 'base';
  for (const c of EXPR_CUES) {
    if (t >= c.from) cur = c.expr;
    else break;
  }
  return cur;
}

// ---- 雲エフェクトのシーン別キュー -----------------------------------------------------
//   mid  = 中景の雲の量 0..1
//   near = 前景の綿の量 0..1
//   dx   = 横方向の流速（%/秒。符号で向き）
// 区間の境界は補間する＝出入りが唐突にならない。
type CloudCue = { at: number; mid: number; near: number; dx: number };

const CLOUD_CUES: CloudCue[] = [
  { at: 0.0, mid: 0.30, near: 0.06, dx: 0.35 },
  { at: SEC.VERSE1B, mid: 0.42, near: 0.10, dx: 0.5 },
  { at: SEC.PRE1, mid: 0.62, near: 0.25, dx: 0.9 }, // ビルド＝雲が増えて速くなる
  { at: SEC.CHORUS1, mid: 0.85, near: 0.85, dx: 1.8 }, // サビ＝綿が舞う
  { at: SEC.INTERLUDE1, mid: 0.30, near: 0.08, dx: 0.4 }, // 間奏＝引く
  { at: SEC.VERSE2, mid: 0.26, near: 0.05, dx: -0.45 }, // 逆方向に流す（同じ画にしない）
  { at: SEC.PRE2, mid: 0.70, near: 0.35, dx: -1.0 },
  { at: SEC.INTERLUDE2, mid: 1.00, near: 1.00, dx: 2.2 }, // 最大密度
  { at: SEC.POST, mid: 0.70, near: 0.55, dx: 1.2 },
  { at: SEC.BRIDGE, mid: 0.10, near: 0.02, dx: 0.18 }, // 落ちサビ＝ほぼ消す（余白最大）
  { at: SEC.FINAL, mid: 0.95, near: 0.95, dx: 2.0 },
  { at: SEC.OUTRO, mid: 0.45, near: 0.20, dx: 0.6 },
  { at: SEC.GAP, mid: 0.22, near: 0.05, dx: 0.3 },
  { at: SEC.REPRISE, mid: 0.80, near: 0.70, dx: 1.6 },
  { at: DUR, mid: 0.80, near: 0.70, dx: 1.6 },
];

function cloudAt(t: number): { mid: number; near: number; dx: number } {
  let a = CLOUD_CUES[0];
  let b = CLOUD_CUES[CLOUD_CUES.length - 1];
  for (let i = 0; i < CLOUD_CUES.length - 1; i++) {
    if (t >= CLOUD_CUES[i].at && t < CLOUD_CUES[i + 1].at) {
      a = CLOUD_CUES[i];
      b = CLOUD_CUES[i + 1];
      break;
    }
  }
  // 区間内を 1.2秒でイーズしながら次の値へ寄せる（唐突な出現を避ける）
  const span = Math.max(b.at - a.at, 0.001);
  const p = ez(clamp01((t - a.at) / Math.min(span, 1.2)));
  return { mid: lerp(a.mid, b.mid, p), near: lerp(a.near, b.near, p), dx: lerp(a.dx, b.dx, p) };
}

// ---- カメラ（唯一の真実。各層は depth を掛けて動かす） ------------------------------------
type Cam = { scale: number; x: number; y: number };
/** キャラレイヤーだけに掛ける追加変換（中央から外すのはここ）。 */
type CharXf = { cx: number; cy: number; cz: number; closeup?: boolean };

function useCamera(frame: number, frameOffset: number, sec: number, hit: number): Cam & CharXf {
  const t = (frame + frameOffset) / DATA.fps;
  const shot = SHOTS[shotAt(t)];
  const breathe = 1.04 + Math.sin(frame / 100) * 0.014; // 完全静止させない

  // build 区間は寄りを加速（寄りすぎると顔が中央バンドへ戻って歌詞と当たるので控えめ）
  let build = 0;
  if (t >= SEC.PRE1 && t < SEC.CHORUS1) build = ez((t - SEC.PRE1) / (SEC.CHORUS1 - SEC.PRE1)) * 0.08;
  else if (t >= SEC.PRE2 && t < SEC.PRE2 + 12) build = ez((t - SEC.PRE2) / 12) * 0.06;

  // 落ちサビ / Outro は pull-out（余白を最大に）
  let pull = 0;
  if (t >= SEC.BRIDGE && t < SEC.FINAL) pull = -0.10 * ez(clamp01((t - SEC.BRIDGE) / 3));
  if (t >= SEC.OUTRO && t < SEC.GAP) pull = -0.08 * ez(clamp01((t - SEC.OUTRO) / 5));

  // 拍打点のズームやシェイクは入れない＝動きはキャラ（連番）とエフェクト側に任せる。
  // カメラに残すのは呼吸(breathe)＋ゆっくりした横流し(drift)だけ。
  const drift = Math.max(-3.2, Math.min(3.2, lateralDrift(t)));

  return {
    scale: breathe + shot.z + build + pull,
    x: shot.x + drift + Math.sin(frame / 26) * 0.35,
    y: shot.y + Math.cos(frame / 31) * 0.3,
    cx: shot.cx,
    cy: shot.cy,
    cz: shot.cz,
    closeup: shot.closeup,
  };
}

/**
 * depth 付きレイヤー。
 * depth<1 = 奥（カメラより動かない）／depth>1 = 手前（カメラより大きく動く）＝これが視差。
 * zoomBias は「その層をどれだけ大きく敷くか」＝パンの余地。
 */
const Layer: React.FC<{
  cam: Cam;
  depth: number;
  zoomBias?: number;
  /** その層だけの固定オフセット(%)。プレートの「見せたい範囲」を選ぶのに使う。 */
  bias?: [number, number];
  /**
   * true で拡大縮小の原点を下端中央にする（キャラレイヤー用）。
   * 下辺で断ち切られた立ち絵を中心原点で縮小すると、断ち切り線が画面内に浮いて見えるため。
   */
  originBottom?: boolean;
  children: React.ReactNode;
}> = ({ cam, depth, zoomBias = 1, bias = [0, 0], originBottom = false, children }) => {
  const s = zoomBias * (1 + (cam.scale - 1) * depth);
  const x = cam.x * depth + bias[0];
  const y = cam.y * depth + bias[1];
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${s.toFixed(4)}) translate(${x.toFixed(3)}%, ${y.toFixed(3)}%)`,
        transformOrigin: originBottom ? '50% 100%' : '50% 50%',
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ---- 雲/綿のパフ群（手続き的・決定的） ------------------------------------------------
// 中景(mid)は大きく淡くゆっくり、前景(near)は小さめで速く不透明。
const Puffs: React.FC<{
  frame: number;
  amount: number; // 0..1
  dx: number; // 横流速（%/秒）
  seed: number;
  baseR: number; // 半径(px)
  rise: number; // 上昇量（%）
  opacity: number;
  blur: number;
}> = ({ frame, amount, dx, seed, baseR, rise, opacity, blur }) => {
  if (amount < 0.02) return null;
  const n = Math.max(1, Math.round(amount * 9));
  const t = frame / DATA.fps;
  const items = [];
  for (let i = 0; i < n; i++) {
    const ph = ((i * 137.5 + seed * 61) % 360) / 360; // 黄金角で散らす
    const cyc = ((t * (0.06 + amount * 0.1) + ph) % 1 + 1) % 1;
    // 横位置は流速で動かし、画面外に出たら反対側から戻す
    const x = (((ph * 100 + t * dx * 6) % 116) + 116) % 116 - 8;
    const y = 96 - cyc * rise;
    const wob = Math.sin(t * 0.7 + i) * 1.4;
    const s = (0.65 + cyc * 0.7) * (0.75 + amount * 0.6);
    const r = baseR * s;
    // 横位置は modulo で巻き戻るので、画面端に近いほど薄くして継ぎ目を隠す
    const edge = clamp01(Math.min(x + 8, 108 - x) / 14);
    const op = clamp01(Math.sin(cyc * Math.PI)) * opacity * (0.5 + amount * 0.6) * edge;
    if (op < 0.012) continue;
    items.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y + wob}%`,
          width: r,
          height: r,
          marginLeft: -r / 2,
          marginTop: -r / 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff ${28 + amount * 22}%, #ffffff00 72%)`,
          opacity: op,
          filter: `blur(${blur}px)`,
        }}
      />
    );
  }
  return <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>{items}</AbsoluteFill>;
};

/** 打点で弾ける綿（Drop/サビ限定＝全編がけにすると落差が死ぬ）。 */
const PuffBurst: React.FC<{ frame: number; sec: number; hit: number }> = ({ frame, sec, hit }) => {
  if (sec < 0.5) return null;
  const puffs = [];
  const n = 3 + Math.round(sec * 3);
  for (let i = 0; i < n; i++) {
    const ph = i * 137.5;
    const cyc = ((frame * (0.9 + sec * 1.1) + ph) % 90) / 90;
    const x = 8 + ((i * 37) % 84);
    const y = 88 - cyc * 100;
    const s = (0.5 + cyc * 1.5) * (0.7 + sec * 0.8) * (1 + hit * 0.5);
    // sin の山で包む＝周期の頭で塊が唐突に出現しない
    const op = Math.sin(clamp01(cyc) * Math.PI) * 0.5 * (0.35 + sec * 0.4);
    const r = 150 * s;
    puffs.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: r,
          height: r,
          marginLeft: -r / 2,
          marginTop: -r / 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff ${20 + sec * 20}%, #ffffff00 70%)`,
          opacity: op,
          filter: 'blur(6px)',
        }}
      />
    );
  }
  return <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>{puffs}</AbsoluteFill>;
};

/**
 * キャラレイヤー。
 * - その表情の連番（meta.charSeqs）があれば連番を再生（呼吸/まばたき等の微動ループ）。
 * - それ以外は表情差分の静止画（meta.charPlates）。
 * 表情の切替はハードカット（shape-burst の語彙＝フェードしない）。
 */
const Character: React.FC<{ meta: InvertShapesMeta; t: number; frame: number; closeup?: boolean }> = ({
  meta,
  t,
  closeup = false,
}) => {
  const expr = exprAt(t);
  const plates = meta.charPlates ?? {};
  const seqs = meta.charSeqs ?? {};

  if (closeup && meta.charCloseup) {
    return <Img src={staticFile(meta.charCloseup)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  const seq = seqs[expr];
  if (seq && seq.len > 0) {
    const sfps = seq.fps ?? DATA.fps;
    const idx = Math.floor((t * sfps) % seq.len);
    const name = `${seq.dir}/${String(idx + 1).padStart(3, '0')}.png`;
    return <Img src={staticFile(name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  const src = plates[expr] ?? plates.base;
  if (!src) return null;
  return <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
};

export const Stage: React.FC<{ meta: InvertShapesMeta; vertical?: boolean; frameOffset?: number }> = ({
  meta,
  vertical = false,
  frameOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { sec, hit } = sample(frame, frameOffset);
  const t = (frame + frameOffset) / DATA.fps;
  const cam = useCamera(frame, frameOffset, sec, hit);
  const base = meta.bgColor ?? PAL.BG;
  const cloud = cloudAt(t);

  const far = (vertical ? meta.bgFarVertical ?? meta.bgFar : meta.bgFar) ?? (vertical ? meta.bgVertical : meta.bg);

  // ---- 高明度のまま緩急を作る（calm は「暗く」ではなく「白く飛ばす」。サビでは 0 まで抜く）----
  const wash = 0.22 * clamp01(1 - sec / 0.62);
  const sat = 0.90 + sec * 0.34;
  const contrast = 0.97 + sec * 0.12;
  const bright = 1.05 - sec * 0.04;

  let flood = 0;
  for (const f of FLOOD) {
    const dt = t - f;
    if (dt >= -0.05 && dt < 0.35) flood = Math.max(flood, 1 - clamp01((dt + 0.05) / 0.4));
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: base }}>
      {/* 1) 遠景。depth 0.20 ＝ほとんど動かない＝奥に見える。
             zoomBias は「プレートのどれだけの範囲を見るか」。大きすぎると隅が全部フレーム外になる。
             bias でプレートの見せたい側（雲の濃い側など）へ寄せる。 */}
      {far ? (
        <Layer cam={cam} depth={0.20} zoomBias={1.26} bias={[0, -5.5]}>
          <Img
            src={staticFile(far)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `brightness(${bright.toFixed(3)}) saturate(${sat.toFixed(3)}) contrast(${contrast.toFixed(3)})`,
            }}
          />
        </Layer>
      ) : null}

      {/* 2) 中景の雲＝シーンで量と流速が変わる */}
      <Layer cam={cam} depth={0.55} zoomBias={1.2}>
        <Puffs frame={frame + frameOffset} amount={cloud.mid} dx={cloud.dx} seed={3} baseR={430} rise={58} opacity={0.5} blur={16} />
      </Layer>

      {/* 3) キャラ。カメラ主体（depth 1.0）＋構図ごとの片寄せ(cx/cy)と縮尺(cz)。 */}
      <Layer cam={cam} depth={1.0} zoomBias={cam.cz} bias={[cam.cx, cam.cy]} originBottom>
        <Character meta={meta} t={t} frame={frame + frameOffset} closeup={cam.closeup} />
      </Layer>

      {/* 4) 前景の綿。depth 1.55 ＝カメラより大きく動く＝手前に見える */}
      <Layer cam={cam} depth={1.55} zoomBias={1.0}>
        <Puffs frame={frame + frameOffset} amount={cloud.near} dx={cloud.dx * 2.1} seed={11} baseR={230} rise={112} opacity={0.62} blur={7} />
      </Layer>

      {/* 5) 白ウォッシュ（calm ほど強い＝静を「白く」表現する。暗くしない） */}
      <AbsoluteFill style={{ background: base, opacity: wash }} />

      {/* 打点で弾ける綿（Drop のみ） */}
      <PuffBurst frame={frame + frameOffset} sec={sec} hit={hit} />

      {/* light-flood-wipe（2回だけ） */}
      {flood > 0.01 && <AbsoluteFill style={{ background: '#ffffff', opacity: clamp01(flood) * 0.92 }} />}
    </AbsoluteFill>
  );
};
