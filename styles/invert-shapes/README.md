# invert-shapes（ソリッド白図形×ネガポジ反転）

極太の角ゴシック（Dela Gothic One）の歌詞に真っ白なソリッド図形（丸/三角/四角）を重ね、重なった部分だけ黒に反転させる（`mixBlendMode: difference`）。
1フレーズ＝1画面のハードカット。色は暗い背景＋白＋黒の3色に、放電の1色だけ。打点で画面全体の輝度反転と電光を走らせる。
カメラ移動（pan-up / push-in / pull-out / 一点から一点へ寄る）、間奏用の HUD、冒頭のクレジット→曲名カード、エンドカード（電光→暗転→タイトル）入り。本編 `LyricVideo`（16:9）・縦ショート `ShortVideo`（9:16）・サムネ `Thumbnail`。

**向く曲:** 攻撃的・アングラで白黒の強いコントラストが効く曲（speed garage / phonk / ハードな電子 / 病みかわいい系ボカロ）。挑発・毒・支配の歌詞。

**元になった RESONAL の曲:** Noise Doll / Static Hazard / Stutter Step

## 使い方

1. `public/` に置く
   - `public/audio.wav` … マスター音源
   - `public/bg.png`（16:9）と `public/bg_vertical.png`（9:16 ショート用。バストアップの絵が合う）。`tools/03b_prep_cover.sh <カバー画像> public` で1枚から両方作れる
   - `public/loop_bg.mp4` … 背景ループ動画（任意。`meta.videoRegions` の区間だけ静止画の上に出る）。使わないなら `meta.bgVideo` と `meta.videoRegions` を消す
2. 書き換える
   - `input/lyrics.json` … 歌詞と秒（今はダミー）。スキーマは `src/types.ts`
     - `phrases[]`: `t` / `hold` / `text`（英語句は `\n` で上下2行）/ `size` / `reveal`（`flow` 左→右に1文字ずつ・`block` 塊・`swap` 中央で上書き）/ `tilt` / `shapes`（`{at, kind:0丸 1三角 2四角, mode:"big"|"cover"|"point"}`）
     - `meta`: `invertHits`（`big`=全画面反転・`small`=電光だけ）/ `sparkHits` / `cameraMoves` / `calmRegions` / `buildRegions` / `videoRegions` / `hudRegions` / `faceRegions` / `titleCard` / `endCard` / `shortRange`（ショートの区間）
     - `meta.thumbTitle` … サムネ・曲名カード・HUD ラベル（英語）。`meta.endCard.title` … エンドカードの曲名
   - `input/project.json` … クレジット。`workflow.config.json` の `credits` をそのまま写す（1項目＝1枚）。秒を変えたいときだけ `meta.credits: [{from,to}, …]`（項目順）
   - 再着色: 背景は `meta.bgColor`、白の質感は `src/InvertShapes.tsx` の `WHITE`、唯一の彩度は `src/LyricVideo.tsx` の `VIOLET`（HUD は `src/Hud.tsx` の `HUD`。`BPM` も曲に合わせる）
3. レンダー
   ```bash
   npm install
   npx remotion studio
   npx remotion render LyricVideo out/main.mp4
   npx remotion render ShortVideo out/short.mp4
   npx remotion still Thumbnail out/thumbnail.jpg
   ```
   曲フォルダへまとめて書き出して検査までやるなら `tools/run_mv.sh <曲フォルダ>`（04 レンダー → 07 検査。出力名はフォルダ名から `<Title>.mp4` / `<Title> (Short).mp4` / `thumbnail.jpg`）。

### 付属の `tools/`
| スクリプト | やること |
|---|---|
| `01_transcribe.sh <音源> <出力dir>` | 16k mono 化して whisper（日本語・語ごとの秒）。秒を読んで `lyrics.json` を手で書く |
| `02_estimate_beats.py <16k wav> [min] [max]` | BPM と拍（秒）を推定して JSON を出す（例: `input/beats.example.json`）。打点やカメラ区間を決める目安 |
| `03b_prep_cover.sh <画像> public` | `bg.png`（16:9）と `bg_vertical.png`（9:16） |
| `04_render.sh <project> <曲フォルダ>` | 本編・ショート・サムネ＋720p プレビュー（`out/`） |
| `07_verify.sh <曲フォルダ> [project]` | デコード全走査・5点シーク・黒落ち・クレジットの有無 |
| `run_mv.sh <曲フォルダ>` | 空き容量確認 → 04 → 07 |

### 公開版 `templates/mv` との違い
- `tools/make_mv.sh` には乗らない。番号は似ているが別物（ここの 04 はレンダー、`templates/mv` の 04 は歌詞の秒づけ）。
- `LYRICS.md` × whisper から `lyrics.json` を自動で作る仕組みは無い（RESONAL 側の生成スクリプトは曲データ込みだったので外した）。01 の結果を見て `phrases` を手で書くか、`templates/mv` の 04 で作った秒を写す。`size` / `reveal` / `shapes` は手で決める。
- 前景キャラの自動切り抜きは無い。被写体は背景画像に含める（`cameraMoves` の `fromY` / `toY` は画像の縦位置 0=上端 1=下端）。

## 注意（発展途上・そのまま共有）
- RESONAL の数曲の制作で使った実装をほぼそのまま出している。曲データとクレジットの読み方だけ差し替えた。
- 確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。
- サポートなし。
