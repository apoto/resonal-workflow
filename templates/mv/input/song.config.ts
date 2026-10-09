// ============================================================
// 曲コンフィグ（振り付け）。既定は「曲の長さ・拍・音の強さ」から自動で割る＝手で書かなくても動く。
//   区間   : 8小節ごとに区切り、音の強さ（energy.json）で 強/中/弱 に分ける
//   強区間 : 明るく・放射・ズームパンチ。弱→強に上がる頭が「ドロップ」（直前にトンネル→白飛び）
//   弱区間 : ゆっくりした呼吸の光
//   ショート: 最初のドロップの2小節前から約30秒（ドロップが無ければ一番強い区間から）
// 手で直すときは下の export の値を書き換える（README「振り付けを手で直す」）。
// ============================================================
import type { SongConfig, Shot, Cut } from '../src/engine/types';
import lyrics from './lyrics.json';
import project from './project.json';
import beatsData from './beats.json';
import energy from './energy.json';

const DUR: number = lyrics.meta.duration;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (a: number, b: number, sec: number, edge = 0.8) => clamp01(Math.min((sec - a) / edge, (b - sec) / edge, 1));

// ---- 小節と区間 ----
const BEATS: number[] = (beatsData as { beats: number[] }).beats.filter((b) => b < DUR);
const PERIOD: number = (beatsData as { period?: number }).period || 0.5;
const BAR = PERIOD * 4;
const bars: number[] = BEATS.length >= 8 ? BEATS.filter((_, i) => i % 4 === 0) : Array.from({ length: Math.ceil(DUR / 2) }, (_, i) => i * 2);
const SEC: number[] = (energy as { sec: number[] }).sec;
const FPS: number = (energy as { fps?: number }).fps || 30;
const meanEnergy = (a: number, b: number) => {
  const xs = SEC.slice(Math.floor(a * FPS), Math.ceil(b * FPS));
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0.5; // energy が無ければ全部「中」
};
type Level = 'high' | 'mid' | 'low';
type Section = { start: number; end: number; level: Level };
const SECTIONS: Section[] = (() => {
  const edges = [0, ...bars.filter((_, i) => i > 0 && i % 8 === 0)].filter((t, i, a) => i === 0 || t - a[i - 1] > 0.5 && t < DUR - 0.5);
  edges.push(DUR);
  return edges.slice(0, -1).map((start, i) => {
    const end = edges[i + 1]; const e = meanEnergy(start, end);
    return { start, end, level: e >= 0.62 ? 'high' : e < 0.35 ? 'low' : 'mid' };
  });
})();
const HIGH = SECTIONS.filter((s) => s.level === 'high');
const DROPS = SECTIONS.filter((s, i) => s.level === 'high' && i > 0 && SECTIONS[i - 1].level !== 'high').map((s) => s.start);

// ---- カメラ割: 4小節ずつ割り、焦点を順に振る ----
const FOCUS: [number, number, number][] = [[50, 50, 1.1], [42, 44, 1.6], [58, 42, 1.5], [50, 60, 1.3], [46, 40, 2.0]];
const levelAt = (t: number): Level => (SECTIONS.find((s) => t >= s.start && t < s.end) ?? SECTIONS[0]).level;
const makeShots = (from: number, to: number, vertical: boolean): Shot[] => {
  const cuts = [from, ...bars.filter((b, i) => i % 4 === 0 && b > from + 0.5 && b < to - 0.5), to];
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1]; const lv = levelAt(start);
    const [px, py, s] = FOCUS[i % FOCUS.length]; const [nx, ny, ns] = FOCUS[(i + 1) % FOCUS.length];
    return {
      start, end, vertical, kf: [{ t: 0, px, py, s }, { t: end - start, px: nx, py: ny, s: ns }],
      intensity: lv === 'high' ? 0.05 : lv === 'mid' ? 0.025 : 0.01,
      shake: lv === 'high' ? 0.3 : 0, bounce: lv === 'high' ? 1 : 0,
    };
  });
};
const INTRO_END = SECTIONS[0].end;

// ---- ショート ----
const SHORT_LEN = Math.min(DUR, Math.max(BAR, Math.floor(30 / BAR) * BAR));
const loudest = [...SECTIONS].sort((a, b) => meanEnergy(b.start, b.end) - meanEnergy(a.start, a.end))[0];
const SHORT_START = Math.max(0, Math.min(DUR - SHORT_LEN, DROPS.length ? DROPS[0] - BAR * 2 : loudest.start));
const SHORT_END = SHORT_START + SHORT_LEN;

// ---- クレジット: 歌の無い冒頭か末尾の長い方に等分で置く ----
const N = project.credits.length;
const LINES = lyrics.lines as { t: number; hold: number }[];
const firstSing = LINES.length ? LINES[0].t : DUR;
const lastSing = LINES.length ? LINES[LINES.length - 1].t + LINES[LINES.length - 1].hold : 0;
const CREDIT_WIN: [number, number] = (() => {
  const intro: [number, number] = [0.5, Math.min(firstSing - 0.5, 0.5 + N * 3.3)];
  const outro: [number, number] = [lastSing + 0.5, Math.min(DUR - 0.5, lastSing + 0.5 + N * 3.3)];
  const best = intro[1] - intro[0] >= outro[1] - outro[0] ? intro : outro;
  // どちらにも収まらない曲は冒頭に重ねる（クレジットはスクリム付きで歌詞の上でも読める）
  return best[1] - best[0] >= 1.5 * N ? best : [0.5, Math.min(DUR, 0.5 + N * 2.5)];
})();
const CREDIT_STEP = (CREDIT_WIN[1] - CREDIT_WIN[0]) / N;

export const config: SongConfig = {
  meta: {
    duration: DUR, fps: lyrics.meta.fps, width: lyrics.meta.width, height: lyrics.meta.height,
    audio: lyrics.meta.audio, shortScale: lyrics.meta.shortScale,
  },
  lines: lyrics.lines as SongConfig['lines'],
  style: project.look,
  shots16: [
    { start: 0, end: INTRO_END, kf: [{ t: 0, px: 46, py: 40, s: 2.0 }, { t: INTRO_END, px: 50, py: 50, s: 1.0 }] },
    ...makeShots(INTRO_END, DUR, false),
  ],
  shotsShort: makeShots(SHORT_START, SHORT_END, true),
  short: { start: SHORT_START, end: SHORT_END },
  dropHits: DROPS,
  lightAt: (sec: number) => ({
    rainbow: 0.85 * Math.max(0, ...HIGH.map((s) => ramp(s.start, s.end, sec, 0.6))),
    tunnelP: Math.max(0, ...DROPS.map((d) => (sec >= d - BAR * 2 && sec < d ? clamp01((sec - (d - BAR * 2)) / (BAR * 2)) : 0))),
  }),
  moodBright: HIGH.map((s) => [s.start, s.end] as [number, number]),
  whiteouts: DROPS.map((d): Cut => ({ at: d - 0.4, rise: 1.0, hold: 0.4, fall: 0.7 })),
  blackouts: [],
  credits: project.credits.map((text, i) => ({ text, from: CREDIT_WIN[0] + i * CREDIT_STEP, to: CREDIT_WIN[0] + (i + 1) * CREDIT_STEP })),
  fx: {
    breathes: SECTIONS.filter((s) => s.level === 'low').map((s) => ({ from: s.start, to: s.end })),
    blooms: HIGH.map((s) => ({ from: s.start, to: s.end, base: 0.03, amp: 0.14 })),
    lensHits: DROPS,
  },
  eye: { wide: [50, 40], vert: [50, 40] }, // トンネルの収束点（画像内 %）。被写体の目に合わせると締まる
  thumbnail: { title: project.title, sub: project.artist },
  bgLoop: (project as { bgLoop?: SongConfig['bgLoop'] }).bgLoop,
  scenes: (project as { scenes?: SongConfig['scenes'] }).scenes,
};
