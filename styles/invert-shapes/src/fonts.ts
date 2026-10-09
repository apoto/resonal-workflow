// invert-shapes（病みかわいいボカロMV調）。
//  Dela Gothic One = 極太ブロック体（角ゴシック）。invert-shapes の核はこの1書体のみ。
//  タイトル/歌詞/英語コール、すべて DELA で統一する（3色・1書体が invert-shapes のルール）。
import { loadFont as loadDela } from '@remotion/google-fonts/DelaGothicOne';

export const DELA = loadDela('normal', {
  subsets: ['japanese', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

// クレジット専用の日本語書体。
// Dela Gothic One は日本語の密な漢字が小サイズで白つぶれする。
// 歌詞本文は極大サイズなので DELA を維持し、小さく出るクレジットだけこちらで組む。
import { loadFont as loadNoto } from '@remotion/google-fonts/NotoSansJP';

export const NOTO_JP = loadNoto('normal', {
  weights: ['900'],
  subsets: ['japanese', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;
