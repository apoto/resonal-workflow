# portrait-frame

**見た目**: 静止した立ち絵の後ろで、背景だけがループ動画／ゆっくり寄る静止画に切り替わっていく。歌詞は縦書きの明朝が右から左へ積み上がり、ブロックごとに一掃される。額縁の装飾・舞う雪・霧・グレインが常に動き、白飛び（ホワイトアウト）で章を切る。

**向く曲**: 白・冬・静けさ・祈りのような、絵画的に見せたい曲。速い曲でも「人は動かず周囲だけが生きている」で持たせられる。カメラごと揺らす派手さが欲しい曲には向かない（画面全体を揺らす効果は持っていない）。

**元になった RESONAL の曲**: Whiteout

## 使い方

`styles/_mv-kit/`（共有キット）を相対パスで読むので、**このフォルダは `styles/` の中に置いたまま**使います。

```bash
cd styles/portrait-frame
npm install
npm run lint          # spec の検品
npx remotion studio
npm run render        # 16:9 本編 → out/main.mp4
npm run render:short  # 9:16 → out/short.mp4
npm run thumb         # サムネ → out/thumbnail.png
```

1. **素材を `public/` に置く**（見本の `src/scene.ts` が参照している名前）
   - 背景の静止画: `plate_a.png`（16:9）
   - 背景のループ動画: `bg_loop_a.mp4` `bg_loop_b.mp4`（数秒の短尺。`fieldParams.sec` に実尺を書く）
   - 立ち絵（透過 PNG）: `char_full.png`、ショート用の寄り `char_bust.png`
   - サムネの下絵: `cover.png`
   - 音源: 例 `audio.wav`（`scene.meta.audio` に書く。空文字なら無音で動く）
2. **`input/project.json`** に曲名とクレジットを書く。`credits` は `workflow.config.json` の `credits` をそのまま写す（`Label: Name` の行はラベル／名前の2段になる）。曲名はショートの下帯とサムネに出る。
3. **`src/scene.ts`** を書き換える（曲ごとに変えるのはここと `src/short.ts`）。
   - 配色: `stage.palette`（`ground` 地 / `pale` / `shade` / `accent` 差し色1点 / `ink` 文字）
   - 常時レイヤー: `stage.ambient`（`portrait-frame.grain` `mist` `snow` `frame` `scrim` `credit`）
   - 白飛び: `stage.ambientFront` の `portrait-frame.flood-white`。**面の切替（セクション境界）は全白の帯の中に置く**（`npm run verify:flood` が検査）
   - 面: セクションの `stage.field`（`portrait-frame.video` / `portrait-frame.plate` / `portrait-frame.solid`）
   - 歌詞: `sections[].lines`、見せ方 `treatment`（`portrait-frame.vertical-wipe` / `vertical-stack` / `center-mark`）
   - 効果: `stage.fx`（`portrait-frame.progressive-white` / `psychedelic` / `mono-accent` / `blackout`）
4. **`src/short.ts`** に縦ショートの区間（秒）、`src/Root.tsx` の `SHORT_FIGURES` にショートだけ差し替える立ち絵。
5. 検査（任意）: `npm run verify:loop`（背景動画が1周に収まるか＝継ぎ目が出ないか。ffprobe を使う）/ `verify:flood` / `verify:motion`（still を撮って画が止まっていないか）/ `verify:flicker`（レンダー後、点滅が1秒3回以下か）。

### 公開版 `templates/mv` との違い

- `tools/make_mv.sh` には乗りません。whisper 転写 → 歌詞の秒の自動対応付けも無く、**歌詞の秒は `src/scene.ts` に手で書きます**（`templates/mv` で作った `input/lyrics.json` の `t` / `hold` を写すのが早い）。
- 背景のループ動画・立ち絵の切り抜きは自分で用意します。
- 書き出し先は `out/`。曲フォルダへのコピーは手で行います。

## 注意（発展途上・そのまま共有）

RESONAL で1曲作ったときの実装を、曲のデータ（歌詞・区間・素材名）だけダミーに差し替えてそのまま出しています。元の制作で使っていた「歌詞が正本と一致するか」「秒が転写結果と合うか」の検査はその曲専用だったので外しました。確認したのは `npm install` と `npx tsc --noEmit`（通過）・`npm run lint` と `verify:flood`（通過）まで。**レンダーは未確認**で、素材を `public/` に置くまでは画像・動画が読めずにレンダーが失敗します。サポートはありません。
