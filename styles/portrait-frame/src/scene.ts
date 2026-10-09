import { SceneSpec } from '../../_mv-kit/src';
import project from '../input/project.json';

/**
 * portrait-frame の見本 SceneSpec（ダミーの歌詞・区間）。
 * **曲ごとに変わるのはこのファイルと public/ だけ**（スタイルパック styles/_mv-kit/styles/portrait-frame は触らない）。
 *
 * 時間はビート格子に乗せる。120BPM = 1小節 2.0秒。
 */
const BAR = 2.0;
const bar = (n: number) => n * BAR;
const DUR = bar(16);

export const scene: SceneSpec = {
  meta: {
    title: project.title,
    fps: 30,
    width: 1920,
    height: 1080,
    duration: DUR,
    audio: '', // 無音で動く。曲では public/ に置いた音源名（例 'audio.wav'）
    bpm: 120,
  },
  style: 'portrait-frame',
  stage: {
    fill: '#f2f5f8',
    /** 白＋淡色＋影のグレー、差し色は1点だけ */
    palette: {
      ground: '#f2f5f8',
      pale: '#cfe3f2',
      shade: '#9aa8b4',
      accent: '#1d3f63',
      ink: '#1a2530',
    },
    /** 常時レイヤー。完全静止フレームを作らないため、雪・霧・グレインは全編動かす */
    ambient: [
      { id: 'portrait-frame.grain', t: 0, hold: DUR, params: { amount: 0.055 } },
      { id: 'portrait-frame.mist', t: 0, hold: DUR, params: { amount: 0.34, speed: 0.05 } },
      { id: 'portrait-frame.snow', t: 0, hold: DUR, params: { density: 210, wind: 1 } },
      // クレジットは曲全体レイヤーに置き、帯（scrim）は出しっぱなし＝帯が点滅しない
      { id: 'portrait-frame.scrim', t: bar(12) - 0.4, hold: bar(4) + 0.4, params: { fadeIn: 0.8, fadeOut: 1.2, opacity: 0.85 } },
      ...project.credits.map((text, i) => {
        const m = /^(.+?):\s*(.+)$/.exec(text);
        return {
          id: 'portrait-frame.credit',
          t: bar(12) + i * 2.4,
          hold: 2.2,
          params: m ? { label: m[1], name: m[2], scrim: false } : { name: text, scrim: false },
        };
      }),
      { id: 'portrait-frame.frame', t: 0, hold: DUR, params: { weight: 1.4, inset: 3.4, corner: 5.2, opacity: 0.62 } },
    ],
    /** 白飛びは被写体より前・歌詞より後ろ＝白の中に文字だけ残る。面の切替は全白の帯の中に入れる */
    ambientFront: [
      { id: 'portrait-frame.flood-white', t: bar(4) - 1.6, hold: 3.0, params: { dir: 'radial', peak: 0.3, hold: 0.42 } },
    ],
    fx: [
      { id: 'portrait-frame.progressive-white', from: bar(10), to: bar(12), params: { grain: 0.62, maxOpacity: 0.9 } },
    ],
  },

  sections: [
    {
      id: 'verse',
      kind: 'verse',
      from: 0,
      to: bar(4),
      treatment: 'portrait-frame.vertical-wipe',
      params: { capPct: 8.4, x: 88, y: 13, writeSec: 0.34 },
      stage: {
        field: 'portrait-frame.plate',
        fieldParams: { src: 'plate_a.png', from: 1.02, to: 1.13, panX: 0.02, wash: 0.06 },
        figures: [{ src: 'char_full.png', scale: 0.3, x: 32, y: 52 }],
      },
      lines: [
        { t: 0.5, hold: 3.0, text: 'Sample line one' },
        { t: 3.5, hold: 2.5, text: 'Sample line two' },
      ],
    },
    {
      id: 'chorus',
      kind: 'chorus',
      from: bar(4),
      to: bar(8),
      treatment: 'portrait-frame.vertical-stack',
      params: { capPct: 9.0, x: 90, y: 12, gap: 1.5, step: 3.6, writeSec: 0.3 },
      stage: {
        // rate を落として 1周（sec / rate）をセクション長より長くする＝ループの継ぎ目を出さない
        field: 'portrait-frame.video',
        fieldParams: { src: 'bg_loop_a.mp4', sec: 5.0, rate: 0.5, zoom: 1.05 },
        figures: [{ src: 'char_full.png', scale: 0.34, x: 30, y: 54 }],
      },
      overlays: [{ id: 'portrait-frame.sparkle', t: bar(4), hold: bar(4), params: { count: 22, bpm: 120 } }],
      lines: [
        { t: bar(4) + 0.2, hold: 2.3, text: 'Sample chorus', params: { scale: 1.16 } },
        { t: bar(4) + 2.5, hold: 2.0, text: 'line two' },
        { t: bar(4) + 4.5, hold: 3.0, text: 'line three' },
      ],
    },
    {
      id: 'drop',
      kind: 'drop',
      from: bar(8),
      to: bar(12),
      treatment: 'portrait-frame.center-mark',
      params: { capPct: 5.4 },
      stage: {
        field: 'portrait-frame.video',
        fieldParams: { src: 'bg_loop_b.mp4', sec: 5.0, rate: 0.6, tone: 'mono' },
        figures: [{ src: 'char_full.png', scale: 0.3, x: 72, y: 54, flip: true }],
      },
      overlays: [
        { id: 'portrait-frame.snow', t: bar(8), hold: bar(4), params: { density: 260, wind: 1.3, bpm: 120, per: 1, kick: 0.7 } },
      ],
      lines: [{ t: bar(8) + 0.3, hold: 2.0, text: 'SAMPLE' }],
    },
    {
      id: 'outro',
      kind: 'outro',
      from: bar(12),
      to: DUR,
      treatment: 'portrait-frame.vertical-wipe',
      allowRepeat: true,
      params: { capPct: 7, x: 88, y: 13 },
      stage: {
        field: 'portrait-frame.plate',
        fieldParams: { src: 'plate_a.png', from: 1.13, to: 1.2, panX: -0.02, wash: 0.1 },
      },
      lines: [{ t: bar(12) + 0.5, hold: 4.0, text: 'Sample last line' }],
    },
  ],
};
