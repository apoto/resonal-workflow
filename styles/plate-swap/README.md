# plate-swap

**見た目**: 夜の街の写真的な面・単色ベタ＋ビルのシルエット・白い高キー面、の数種類の「面」を小節頭で丸ごと切り替える。キャラは静止画プレートの差し替えだけで動かさない。極太ゴシックの歌詞が 0.3 秒ほどでワイプして出て、数秒残り、1フレームで消える。

**向く曲**: 夜・都市・クールな中〜速テンポ（シティポップ、ダークポップ、ドラムンベース、フォンク寄り）。「静と動の落差」で持たせる曲。全編ハイテンションで緩急が無い曲や、長文で説明的な歌詞には向かない。

**元になった RESONAL の曲**: Rerun Season

動画生成を使わず、静止画だけで1本組めるのが特徴です。

## 使い方

`styles/_mv-kit/`（共有キット）を相対パスで読むので、**このフォルダは `styles/` の中に置いたまま**使います（別の場所にコピーするなら `_mv-kit` も一緒に、同じ相対位置で）。

```bash
cd styles/plate-swap
npm install
npm run fonts      # 書体候補の比較 → out/fontcompare.png
npm run lint       # spec の検品（error 0 が条件）
npx remotion studio
npm run render        # 16:9 本編 → out/main.mp4
npm run render:short  # 9:16 → out/short.mp4
```

1. **素材を `public/` に置く**（見本の `src/scene.ts` が参照している名前。自分の名前に変えてよい）
   - 背景（遠/中/近の3層・`plate-swap.photo-city` 用）: `bg_city_far.png` `bg_city_mid.png` `bg_city_near.png`。中景・近景は透過 PNG。
   - キャラ（透過 PNG）: `char_eyes.png`（目の寄り）`char_armsout_keyed.png`（全身）`char_bust_keyed.png`（バストアップ）`char_bust_eyesclosed_keyed.png`（表情差分）
   - 音源: 例 `audio.wav`（`scene.meta.audio` に書く。空文字なら無音で動く）
2. **`input/project.json`** に曲名とクレジットを書く。`credits` は `workflow.config.json` の `credits` をそのまま写す（アウトロの `plate-swap.credits` が「`Label: Name`」をラベル／名前の2段で出す）。
3. **`src/scene.ts`** を書き換える。曲ごとに変えるのはこのファイルだけ。
   - 配色: `stage.palette`（`bright` 暗い面の上の文字 / `ink` 明るい面の上の文字・シルエット / `muted` / `field` ベタ面の地 / `paper` 高キー面の地 / `sky` / `glow` 窓明かり）
   - 面: 各セクションの `stage.field`（`plate-swap.photo-city` / `plate-swap.flat-skyline` / `plate-swap.plain` / `plate-swap.photo-plate` ほか）と `fieldParams`
   - 被写体: `stage.figures[]`（`src` `scale` `x` `y` `flip`）
   - 歌詞と秒: `sections[].lines`（`t` 開始秒・`hold` 表示秒）。見せ方（`treatment`: `plate-swap.wipe-in` / `ink-punch` / `small-gray` / `credits`）はセクション単位
   - 書体: 行の `params.face`（`gothic` / `pop` / `thin` / `serif` / `latin`）
4. 規則（守ると崩れにくい）: 文字の色は「セクション」ではなく後ろの「地」で決める／装飾（縁・影）を足さない／キャラを都市に「立たせる」と浮くので画面下で切る／複数行が共存するセクションは `params.allowOverlap: true`。

### 公開版 `templates/mv` との違い

- `tools/make_mv.sh` には乗りません。whisper 転写 → 歌詞の秒の自動対応付け（`templates/mv` の 01・04）も無く、**歌詞の秒は `src/scene.ts` に手で書きます**。`templates/mv` で作った `input/lyrics.json` の `t` / `hold` を写すのが早いです。
- 背景・キャラの切り抜きも自動ではありません。透過 PNG を用意して `public/` に置きます。
- サムネイルのコンポジションはありません（`templates/mv` か別ツールで作る）。
- 書き出し先は `out/`。曲フォルダへのコピーは手で行います。

## 注意（発展途上・そのまま共有）

RESONAL で1曲作ったときの実装を、曲のデータだけダミーに差し替えてそのまま出しています。確認したのは `npm install` と `npx tsc --noEmit`（通過）・`npm run lint`（error 0）まで。**レンダーは未確認**で、見本の画像は同梱していないので、`public/` に素材を置くまでは画像が読めずにレンダーが失敗します。サポートはありません。
