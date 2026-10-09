import { SceneSpec } from '../../_mv-kit/src';
import project from '../input/project.json';

/**
 * plate-swap の見本 SceneSpec（ダミーの歌詞・区間）。
 * **曲ごとに変わるのはこのファイルだけ**（配色・画像・被写体・区間・歌詞）。
 * スタイルパック（styles/_mv-kit/styles/plate-swap）は触らない。
 *
 * 時間はビート格子に乗せる。120BPM = 1拍0.5秒 = 1小節2.0秒。
 * 静止画主体の画は、面の切替を小節頭に置かないと「止まっている」に見える。
 */

const BAR = 2.0; // 120BPM
const bar = (n: number) => n * BAR;

export const scene: SceneSpec = {
  meta: {
    title: project.title,
    fps: 30,
    width: 1920,
    height: 1080,
    duration: bar(12),
    audio: '', // 無音で動く。曲では public/ に置いた音源名（例 'audio.wav'）
    bpm: 120,
  },
  style: 'plate-swap',
  stage: {
    fill: '#07080C',
    /**
     * ★曲ごとの配色はここだけで終わる。
     *   bright = 暗い面に置く明るい文字 / ink = 明るい面に置く暗い文字とシルエット
     *   muted  = 高キー面の副次文字 / field = ベタ面の地 / paper = 高キー面の地
     *   sky    = 写真的な地の下敷き / glow = 窓明かり
     */
    palette: {
      bright: '#E9C93E',
      ink: '#141014',
      muted: '#6E6E72',
      field: '#F2C61F',
      paper: '#FBFAF7',
      sky: '#080A0E',
      glow: 'rgba(226,238,255,0.85)',
    },
  },
  sections: [
    /*
      ★塗りは「セクション」ではなく「地」で決める。
        暗い面が後ろにある区間 → bright。
        明るい地（不透過の淡い素材／高キー面）が支配する区間 → ink / muted。
        明るい地に bright を置くと必ず線負けし、装飾で助けると字幕になる。
    */

    // ① 目の極アップ。不透過の淡い肌が支配する＝ink
    {
      id: 'intro',
      kind: 'intro',
      from: bar(0),
      to: bar(2),
      treatment: 'plate-swap.wipe-in',
      params: { material: 'ink', vertical: true, capPct: 12, x: 5, y: 10 },
      stage: {
        field: 'plate-swap.plain',
        fieldParams: { key: 'sky' },
        // 片目に寄せる。両目が入ると文字を置ける淡い面が無くなり黒が睫毛に潜って読めない
        figures: [{ src: 'char_eyes.png', scale: 1.8, x: 15, y: 46 }],
      },
      lines: [{ t: bar(0) + 0.2, hold: 3.4, text: 'Sample line one' }],
    },

    // ② 全身。近景ビルが手前に出て脚を横切る（layered な field）
    {
      id: 'verse',
      kind: 'verse',
      from: bar(2),
      to: bar(4),
      treatment: 'plate-swap.wipe-in',
      allowRepeat: true, // ①と同じ treatment。面と被写体で落差を作る意図
      // 複数行が画面に共存するのがこの型（刷り出して残す）＝lint に宣言する
      params: { capPct: 11, x: 5, allowOverlap: true },
      stage: {
        field: 'plate-swap.photo-city',
        fieldParams: {
          far: 'bg_city_far.png',
          mid: 'bg_city_mid.png',
          near: 'bg_city_near.png',
          pan: 1.4,
        },
        // 足を都市に「立たせる」と浮く。画面下で切る
        figures: [{ src: 'char_armsout_keyed.png', scale: 0.55, x: 52, y: 84 }],
      },
      lines: [
        { t: bar(2) + 0.2, hold: 1.6, text: 'Sample line', params: { y: 9 } },
        { t: bar(2) + 1.0, hold: 2.6, text: 'two', params: { y: 21, writeSec: 0.34 } },
      ],
    },

    // ③ ベタ面＋シルエット。1小節だけのキメ
    {
      id: 'pre',
      kind: 'pre',
      from: bar(4),
      to: bar(5),
      treatment: 'plate-swap.ink-punch',
      stage: { field: 'plate-swap.flat-skyline' },
      lines: [{ t: bar(4), hold: BAR, text: 'SAMPLE', params: { capPct: 34, flickerSec: 0.2 } }],
    },

    // ④ バストアップ。プレート幅＝画面幅（scale 1.0）で切れ目を枠外へ逃がす
    {
      id: 'chorus1',
      kind: 'chorus',
      from: bar(5),
      to: bar(7),
      treatment: 'plate-swap.wipe-in',
      params: { capPct: 12, x: 4, y: 10 },
      stage: {
        field: 'plate-swap.photo-city',
        fieldParams: { far: 'bg_city_far.png', mid: 'bg_city_mid.png', near: 'bg_city_near.png', pan: 0.6 },
        figures: [{ src: 'char_bust_keyed.png', scale: 1.0, x: 50, y: 71 }],
      },
      lines: [{ t: bar(5) + 0.2, hold: 3.4, text: 'Sample line three', params: { flickerSec: 0.27 } }],
    },

    // ⑤ 高キー面＝静の極。図は小さく置く（余白が主役）
    {
      id: 'bridge',
      kind: 'bridge',
      from: bar(7),
      to: bar(8),
      treatment: 'plate-swap.small-gray',
      stage: {
        field: 'plate-swap.plain',
        figures: [{ src: 'char_armsout_keyed.png', scale: 0.26, x: 26, y: 62 }],
      },
      lines: [
        { t: bar(7), hold: BAR, text: 'Sample\nline four', params: { capPct: 3.2, x: 8, y: 26 } },
      ],
    },

    // ⑥ 目を閉じた差分。face=pop を1行だけ混ぜて書体セットの差を見る
    {
      id: 'chorus2',
      kind: 'chorus',
      from: bar(8),
      to: bar(10),
      treatment: 'plate-swap.wipe-in',
      params: { x: 4, allowOverlap: true },
      stage: {
        field: 'plate-swap.photo-city',
        fieldParams: { far: 'bg_city_far.png', mid: 'bg_city_mid.png', near: 'bg_city_near.png', pan: 1.8 },
        figures: [{ src: 'char_bust_eyesclosed_keyed.png', scale: 1.0, x: 50, y: 71 }],
      },
      lines: [
        { t: bar(8) + 0.2, hold: 3.4, text: 'Sample', params: { capPct: 13, y: 7 } },
        { t: bar(8) + 0.8, hold: 2.8, text: 'サンプル', params: { capPct: 8, y: 24, face: 'pop' } },
      ],
    },

    // ⑦ クレジット（文言は input/project.json の credits。workflow.config.json の credits を写す）
    {
      id: 'outro',
      kind: 'outro',
      from: bar(10),
      to: bar(12),
      treatment: 'plate-swap.credits',
      stage: { field: 'plate-swap.flat-skyline', fieldParams: { drip: 0.6 } },
      lines: project.credits.map((text, i) => ({
        t: bar(10) + 0.3 + (i * (bar(2) - 0.6)) / project.credits.length,
        hold: (bar(2) - 0.6) / project.credits.length,
        text,
      })),
    },
  ],
};
