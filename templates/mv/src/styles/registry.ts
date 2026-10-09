import { Style } from '../engine/types';
import { spectrumStill } from './spectrum-still';

// スタイル登録。新スタイルは styles/<name>.tsx を作ってここに足すだけ。
export const STYLES: Record<string, Style> = {
  'spectrum-still': spectrumStill,
};

export const getStyle = (name: string): Style => STYLES[name] ?? spectrumStill;
