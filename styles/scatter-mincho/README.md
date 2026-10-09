# scatter-mincho（散らし明朝＋デジタル崩壊）

白い極太明朝（Noto Serif JP 900）を画面の中央を避けて散らし、色収差（赤/シアン）・グロー・横スメアを乗せる歌詞MV。
背景はループ動画か静止画で、区間ごとにビート同期の色ズレ（`bgChroma`）・激しいグリッチ（`bgGlitch`）・暗転（`blackout`）を掛ける。
本編 `LyricVideo`（16:9）と縦ショート `ShortVideo`（9:16・同じ lyrics.json を区間シフト）の2本。

**向く曲:** 攻撃的で縦ノリの速い曲（DnB / neurofunk / ハードな電子・ロック）。暴走・過剰・崩壊・焦燥・毒のある歌詞。

**元になった RESONAL の曲:** Skip Intro

## 使い方

1. `public/` に置く
   - `public/audio.wav` … マスター音源
   - `public/loop.mp4` … 背景ループ動画（任意。中央にキャラがいる絵が合う）。無ければ `public/bg.png`（静止画）
   - 使わない方は `input/lyrics.json` の `meta.backgroundVideo` / `meta.background` の行を消す（存在しないファイルを指すとレンダーで落ちる）
2. 書き換える
   - `input/lyrics.json` … 歌詞と秒（今はダミー）。スキーマは `src/types.ts`
     - 各行: `text` / `t`（開始秒）/ `hold`（表示秒）/ `style`（`huge-flash` 特大・`center` 横・`vertical` 縦書き）
     - 任意: `pin:"center"`（中央固定）/ `overflow`（画面外まで特大）/ `stagger`（同時刻の行を縦に振り分け）/ `scale` / `accent`
     - `meta.duration`（秒）・`meta.fps`・`meta.timingOffsetSec`（全体補正）・`beats`（**フレーム番号**＝秒×fps）
     - `meta.scenes`: `{start, end, effect: "bgChroma"|"bgGlitch"|"blackout", intensity?, hits?}`
   - `input/project.json` … クレジット。`workflow.config.json` の `credits` をそのまま写す。`"Vocal: NAME"` は「Vocal」を小ラベル・NAME を名前として2段で出す。秒を変えたいときだけ `meta.credits: [{from,to}, …]`（項目順）を足す
   - 配色: `src/LyricWord.tsx` 冒頭の `RED` / `CYAN` / `GLOW`
   - ショートの区間: `src/Root.tsx` の `SHORT_START` / `SHORT_END`（秒）
3. レンダー
   ```bash
   npm install
   npx remotion studio                                   # プレビューしながら t / hold を詰める
   npx remotion render LyricVideo out/main.mp4 --concurrency=1
   npx remotion render ShortVideo out/short.mp4 --concurrency=1
   ```
   演出が重いので concurrency は低めに。

### 公開版 `templates/mv` との違い
- `tools/make_mv.sh` には乗らない。転写・拍・素材整形・検査のスクリプトは入っていない（Remotion プロジェクトだけ）。
- `LYRICS.md` × whisper から `lyrics.json` を自動で作る仕組みは無い。`lyrics.json` は手で書くか、`templates/mv` の 01（whisper）/ 04 で作った秒を、この形式（`t` / `hold` / `style`）に写す。`style` の振り分けは手で決める。
- `beats` はフレーム番号。`templates/mv` の 02 が出す拍（秒）を使うなら ×fps する。
- サムネのコンポジションは無い。

## 注意（発展途上・そのまま共有）
- RESONAL の数曲の制作で使った実装をほぼそのまま出している。曲データとクレジットの読み方だけ差し替えた。
- 確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。
- サポートなし。
