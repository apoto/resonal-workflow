# burn-in（黒地×補色残像の焼きつき）

## 見た目
純黒の画面中央に白い明朝の歌詞がハードカットで出て、消えた行がシアン⇄マゼンタの補色ゴーストとして同じ位置に焼き残り、減衰しながら重なっていく。
囁きギミック（ネガ反転 → 明るいキャラのドアップ＋囁き → 瞬きの全黒 → 白フラッシュで Drop スラム、それまでのゴーストを一掃）と、インストDrop用の残像実験シーケンス（明るい引き → ネガ反転 → 暗転後に疑似残像が消えていく）付き。背景にキャラ画像をうっすら焼きつけられる。

## 向く曲
halftime の重い melodic dubstep／エモ壮大な EDM。静→爆発の落差が大きい曲。歌詞が残像・消えない・忘れられない・光の余韻を扱うもの。

## 元になった RESONAL の公開曲
Afterimage

## 使い方
1. `npm install`
2. `public/` に置く（ファイルは同梱しない）:
   - `public/audio.wav` … マスター音源
   - `public/bg.png` … 背景に沈めるキャラ画像（`meta.backgroundImage`。任意・無ければ純黒）
3. 書き換える:
   - `input/project.json` … `credits`。公開版の `workflow.config.json` の `credits` をここに写す。`meta.creditsAt`（秒）から歌詞と同じ見た目で1枚ずつ出る（`meta.creditStep` 秒ごと）
   - `input/lyrics.json` … `lyrics`（`t`/`hold` 秒・`kind` = normal / chorus / slam / whisper / echo・`size`・`x`/`y`）と `meta`（`gimmicks` の秒・`finalInvert`・`stare`・`energyZones`）。値はダミー
   - `src/Root.tsx` … ショート区間 `SHORT_START` / `SHORT_END`
   - 再着色 … `src/BurnIn.tsx` 冒頭の `BG` / `INK` / `CYAN` / `MAGENTA`
4. `npx remotion studio` でプレビュー → `npx remotion render LyricVideo out/main.mp4`（ショートは `ShortVideo`）

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。tools/ も無い。
- lyrics.json のスキーマが違う（`lines` ではなく `lyrics`、`pattern` ではなく `kind`）。秒は templates/mv の 01（whisper 転写）の結果を見て手で書く。
- サムネのコンポジションは無い。
- 元の曲ではクレジットを入れておらず、`src/credits.ts`（project.json → 歌詞行として差し込む）はこの公開版で足した最小の実装。

SceneSpec 版のパックが `styles/_mv-kit/styles/burn-in` にある（未検証の別実装）。

## 注意（発展途上・そのまま共有）
1曲の制作で使った実装をほぼそのまま出している（曲の歌詞・秒をダミーに置換し、クレジットを足しただけ）。
点滅はギミックごとにネガ反転1回＋白フラッシュ1回の設計（1秒3回以下）。秒を詰めるときは間隔に注意。
確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。サポートなし。
