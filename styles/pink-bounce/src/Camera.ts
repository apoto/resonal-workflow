import { Section, SectionName } from './types';

/**
 * カメラ／グルーヴ。
 *  - サビ: 4小節ごとに別の「寄せ方」へ切り替える4手のローテーション（sway → bounce → push → tiltsnap）。
 *  - サビ以外: 常時のケンバーンズ（長周期パン＋ズーム）＋区間別の拍ポンプ＝完全静止させない。
 *
 * ここは transform だけを返す純関数。描画は Background / SectionFx が受け取って適用する。
 */

export const BEATS_PER_BAR = 4;
export const barSec = (bpm: number) => (60 / bpm) * BEATS_PER_BAR;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const seeded = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 拍の頭で1.0→拍末へ減衰する0..1。キメの一撃の基準。 */
export const beatEnv = (sec: number, bpm: number, decay = 6): number => {
  const phase = ((sec * bpm) / 60) % 1;
  return Math.exp(-phase * decay);
};

/** 小節頭で1.0→減衰する0..1。 */
export const barEnv = (sec: number, bpm: number, decay = 5): number => {
  const phase = (sec / barSec(bpm)) % 1;
  return Math.exp(-phase * decay);
};

export const sectionAt = (sec: number, sections: Section[] | undefined): Section | undefined =>
  sections?.find((s) => sec >= s.start && sec < s.end);

export type Cam = {
  scale: number;
  x: number;
  y: number;
  rot: number;
  /** サビの腰ピボットを使うか（transform-origin の切替用） */
  hipPivot: boolean;
};

// ---- 区間ごとの「動きの温度」。単調さの正体は全区間が同じ値だったこと。 ----
type SectionTune = {
  pump: number;       // 拍ごとのズームポンプ量
  drift: number;      // ケンバーンズの振れ幅倍率
  driftZoom: number;  // 長周期ズームの幅
  shake: number;      // 拍ごとの微振動(px)
  roll: number;       // 長周期ロール(deg)
};

const TUNE: Record<SectionName, SectionTune> = {
  intro:     { pump: 0.006, drift: 0.7, driftZoom: 0.030, shake: 0,   roll: 0.5 },
  verse:     { pump: 0.009, drift: 1.0, driftZoom: 0.038, shake: 0.6, roll: 0.8 },
  prechorus: { pump: 0.014, drift: 1.2, driftZoom: 0.030, shake: 1.4, roll: 1.0 },
  build:     { pump: 0.020, drift: 1.4, driftZoom: 0.026, shake: 2.6, roll: 1.2 },
  chorus:    { pump: 0.022, drift: 0.9, driftZoom: 0.024, shake: 1.0, roll: 0.6 },
  post:      { pump: 0.026, drift: 1.1, driftZoom: 0.028, shake: 2.0, roll: 1.0 },
  breakdown: { pump: 0.034, drift: 1.3, driftZoom: 0.034, shake: 5.0, roll: 1.6 },
  bridge:    { pump: 0.007, drift: 1.1, driftZoom: 0.044, shake: 0,   roll: 1.2 },
  outro:     { pump: 0.005, drift: 0.8, driftZoom: 0.050, shake: 0,   roll: 0.9 },
};

const DEFAULT_TUNE: SectionTune = TUNE.verse;

/** サビの4手ローテーション。4小節ごとに次の手へ。 */
export type GrooveMove = 'sway' | 'bounce' | 'push' | 'tiltsnap';
const MOVES: GrooveMove[] = ['sway', 'bounce', 'push', 'tiltsnap'];

/** そのサビ区間の何小節目か＋今の手。Background のポーズ順の変化にも使う。 */
export const grooveState = (sec: number, bpm: number, section: Section | undefined) => {
  const start = section?.start ?? 0;
  const bar = Math.floor((sec - start) / barSec(bpm));
  const moveIndex = Math.floor(bar / 4);
  return {
    bar,
    move: MOVES[((moveIndex % MOVES.length) + MOVES.length) % MOVES.length],
    /** 今の手に入ってから何小節目か（0..3）＋小節内の進行(0..1) */
    moveBar: bar - moveIndex * 4,
    movePhase: clamp01(((sec - start) / barSec(bpm) - moveIndex * 4) / 4),
  };
};

/**
 * サビのグルーヴ transform（groove=0..1 でブレンドする前の生の値）。
 * 4手それぞれ「体の使い方」が違う＝見ていて飽きない。
 */
const grooveTransform = (sec: number, bpm: number, move: GrooveMove, movePhase: number): Cam => {
  const beat = (sec * bpm) / 60;
  const half = Math.sin(beat * Math.PI);       // 2拍で1往復（腰の左右）
  const bob = Math.abs(Math.sin(beat * Math.PI));
  const bEnv = beatEnv(sec, bpm, 7);

  switch (move) {
    // 腰の左右振り（従来の動き）。基準の1手として残す。
    case 'sway':
      return { scale: 1 + 0.09, x: half * 12, y: bob * 10, rot: half * 1.8, hipPivot: true };

    // 縦ノリ。左右をほぼ殺して沈み込みを2倍以上に、拍頭で潰れる。
    case 'bounce':
      return {
        scale: 1 + 0.07 + bEnv * 0.03,
        x: half * 3,
        y: bob * 24 - bEnv * 6,
        rot: half * 0.5,
        hipPivot: true,
      };

    // 4小節かけて寄っていき、最後の1拍で引く。サビ内に「溜め」を作る。
    case 'push': {
      const inSec = movePhase < 0.88 ? movePhase / 0.88 : 1 - (movePhase - 0.88) / 0.12;
      return {
        scale: 1 + 0.04 + clamp01(inSec) * 0.13,
        x: half * 6 + (movePhase - 0.5) * 26,
        y: bob * 8,
        rot: (movePhase - 0.5) * 2.4,
        hipPivot: false,
      };
    }

    // 2拍ごとに左右へ傾きをハードに切り替える（ダッチアングルのスナップ）。
    case 'tiltsnap': {
      const step = Math.floor(beat / 2);
      const dir = step % 2 === 0 ? 1 : -1;
      const settle = clamp01((beat / 2 - step) / 0.18); // 切替直後だけオーバーシュート
      const over = 1 + (1 - settle) * 0.5;
      return {
        scale: 1 + 0.10 + bEnv * 0.02,
        x: dir * -20 * over,
        y: bob * 6,
        rot: dir * 3.0 * over,
        hipPivot: false,
      };
    }
  }
};

/**
 * 回転＋移動しても背景の外周が見えないための最小スケール。
 * transform は `translate() rotate() scale()`＝スケール→回転→移動の順に効くので、
 * 回転で必要になる寄りと、移動ぶんの余白を足して要求スケールを出す。
 * tiltsnap / push は従来より深く傾ける（＝端が出やすい）ので、振り幅ではなくここで機械的に保証する。
 */
const coverScale = (rotDeg: number, tx: number, ty: number, W: number, H: number): number => {
  const r = (Math.abs(rotDeg) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const needW = c + (H / W) * s + (2 * Math.abs(tx)) / W;
  const needH = c + (W / H) * s + (2 * Math.abs(ty)) / H;
  return Math.max(needW, needH);
};

/**
 * 全編のカメラ。groove（サビ強度0..1）が0でも**必ず動いている**のがこの関数の要点。
 */
export const cameraAt = (opts: {
  sec: number;
  bpm: number;
  groove: number;
  section: Section | undefined;
  /** 縦(9:16)は同じpx振れ幅だと効きすぎるので絞る */
  ampScale?: number;
  frameW?: number;
  frameH?: number;
}): Cam => {
  const { sec, bpm, groove, section } = opts;
  const amp = opts.ampScale ?? 1;
  const W = opts.frameW ?? 1920;
  const H = opts.frameH ?? 1080;
  // 腰ピボット時は回転中心が画面中心から下へ26%ずれる＝その分だけ中心が振られるので余白を積む。
  const pivotSlack = 0.02;
  const guard = (cam: Cam): Cam => ({
    ...cam,
    scale: Math.max(cam.scale, coverScale(cam.rot, cam.x, cam.y, W, H) * 1.006 + (cam.hipPivot ? pivotSlack : 0)),
  });
  const tune = (section && TUNE[section.name]) ?? DEFAULT_TUNE;

  // ---- 常時のケンバーンズ: 素数っぽく噛み合わない周期を重ねて「同じ動きの反復」に見せない ----
  const zoom = 1.03 + tune.driftZoom * (0.5 - 0.5 * Math.cos((sec / 21.7) * Math.PI * 2));
  const driftX = (Math.sin((sec / 31.3) * Math.PI * 2) * 26 + Math.sin((sec / 12.1) * Math.PI * 2) * 9) * tune.drift * amp;
  const driftY = (Math.sin((sec / 27.4) * Math.PI * 2 + 1.3) * 16 + Math.sin((sec / 9.7) * Math.PI * 2) * 6) * tune.drift * amp;
  const driftRot = Math.sin((sec / 37.1) * Math.PI * 2) * tune.roll;

  // ---- 拍ポンプ＋微振動: 静止区間でも曲に反応させる ----
  const pump = beatEnv(sec, bpm, 8) * tune.pump;
  const bar = barEnv(sec, bpm, 4);
  const shakeSeed = Math.floor((sec * bpm) / 60);
  const shake = tune.shake * bar * amp;
  const shakeX = (seeded(shakeSeed * 3.7) - 0.5) * 2 * shake;
  const shakeY = (seeded(shakeSeed * 8.1) - 0.5) * 2 * shake;

  // ---- 区間頭のウィップ: 切り替わった瞬間に0.28秒だけ滑り込む ----
  const sinceStart = section ? sec - section.start : 99;
  const whip = sinceStart < 0.28 ? 1 - sinceStart / 0.28 : 0;
  const whipDir = section ? (seeded(section.start) > 0.5 ? 1 : -1) : 1;

  const base: Cam = {
    scale: zoom + pump + bar * tune.pump * 0.5,
    x: driftX + shakeX + whip * whipDir * 52 * amp,
    y: driftY + shakeY,
    rot: driftRot + whip * whipDir * -1.1,
    hipPivot: false,
  };

  if (groove <= 0) return guard(base);

  // ---- サビ: 4手ローテーションを groove でブレンド ----
  const { move, movePhase } = grooveState(sec, bpm, section);
  const g = grooveTransform(sec, bpm, move, movePhase);
  const mix = (a: number, b: number) => a + (b - a) * groove;
  return guard({
    scale: mix(base.scale, base.scale * g.scale + pump),
    x: mix(base.x, g.x * amp + driftX * 0.4 + shakeX),
    y: mix(base.y, g.y * amp + driftY * 0.3 + shakeY),
    rot: mix(base.rot, g.rot + driftRot * 0.3),
    hipPivot: groove > 0.5 && g.hipPivot,
  });
};
