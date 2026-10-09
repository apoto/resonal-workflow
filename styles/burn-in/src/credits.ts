import project from '../input/project.json';
import { BurnInData, GLine } from './types';

/**
 * クレジット＝input/project.json の credits を、歌詞と同じエンジン（白明朝ハードカット→補色ゴースト）で
 * meta.creditsAt から1枚ずつ出す。歌詞と重ならない器楽の区間に置く。
 */
export const withCredits = (data: BurnInData): BurnInData => {
  const at = data.meta.creditsAt;
  if (at === undefined) return data;
  const step = data.meta.creditStep ?? 1.6;
  const lines: GLine[] = (project.credits as string[]).map((text, i) => ({
    text,
    t: at + i * step,
    hold: step - 0.1,
    size: 56,
    y: 50,
  }));
  return { ...data, lyrics: [...data.lyrics, ...lines] };
};
