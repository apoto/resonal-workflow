/**
 * 縦ショート（9:16）の区間（秒）。サビ頭など Drop→Drop で取り、終端は次の歌い出しの数フレーム前に置く。
 * フィルを途中で切らないよう、終端は音の谷（短い窓の RMS）を実測して決める。
 */
export const SHORT_FROM = 8.0;
export const SHORT_TO = 24.0;
