// pink-bounce（NEW KAWAII / 丸文字・キャンディ体）→ Google Fonts（日本語サブセット）
// Mochiy Pop One = ぷっくり太丸ポップ体（キメ大）、M PLUS Rounded 1c = 丸ゴシック（セリフ感）
import { continueRender, delayRender } from 'remotion';
import { loadFont as loadMochiy } from '@remotion/google-fonts/MochiyPopOne';
import { loadFont as loadRounded } from '@remotion/google-fonts/MPLUSRounded1c';

const mochiy = loadMochiy('normal', { subsets: ['japanese', 'latin'] });
const rounded = loadRounded('normal', {
  subsets: ['japanese', 'latin'],
  weights: ['700', '800', '900'],
});

export const MOCHIY_POP = mochiy.fontFamily;
export const MPLUS_ROUNDED = rounded.fontFamily;

// layout.ts が canvas で文字幅を実測して行の重なりを解くため、フォント適用完了までレンダーを待たせる。
// フォールバック字形のまま測ると幅が変わり、フレーム間でレイアウトがガタつく（＝重なり修正が壊れる）。
const handle = delayRender('pink-bounce fonts');
Promise.all([mochiy.waitUntilDone(), rounded.waitUntilDone()]).then(
  () => continueRender(handle),
  () => continueRender(handle),
);
