// shape-burst フォント。
//  DELA = Dela Gothic One（極太ブロック体）。英語フック／タイトルの殴り用。
//  JP_GOTHIC = Noto Sans JP Black(900)。日本語歌詞の本文用＝極太だが漢字の内側が潰れず読める。
//  ※Dela は日本語の密な漢字が白つぶれするので、本文は JP_GOTHIC に分離（英語の見えは維持）。
import { loadFont as loadDela } from '@remotion/google-fonts/DelaGothicOne';
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';

export const DELA = loadDela('normal', {
  subsets: ['japanese', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

export const JP_GOTHIC = loadNoto('normal', {
  weights: ['900'],
  subsets: ['japanese', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;
