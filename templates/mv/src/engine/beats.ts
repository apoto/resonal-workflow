// ビート同期の共通ユーティリティ（engine）。input/beats.json を単一の真実として読む。
import beatsData from '../../input/beats.json';

const BD = beatsData as { beats: number[]; period: number };
export const BEATS: number[] = BD.beats;
export const PERIOD: number = BD.period || 0.4;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 直前ビートからの経過に対する減衰エンベロープ（0-1）。発光/脈動に使う。
export const beatEnv = (sec: number, decay = 9) => {
  for (let i = BEATS.length - 1; i >= 0; i--) {
    if (BEATS[i] <= sec) {
      const dt = sec - BEATS[i];
      return dt < 0.4 ? Math.exp(-decay * dt) : 0;
    }
  }
  return 0;
};

// キック連動のズームパンチ（カメラ）
export const beatPunch = (sec: number) => {
  for (let i = BEATS.length - 1; i >= 0; i--) {
    if (BEATS[i] <= sec) {
      const dt = sec - BEATS[i];
      return dt < 0.22 ? Math.exp(-15 * dt) : 0;
    }
  }
  return 0;
};

// ドロップ強打（曲ごとの dropHits 秒）
export const dropPunch = (sec: number, dropHits: number[]) => {
  let amt = 0;
  for (const h of dropHits) if (sec >= h && sec - h < 0.5) amt = Math.max(amt, Math.exp(-8 * (sec - h)));
  return amt;
};

export { clamp01 };
