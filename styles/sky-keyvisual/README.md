# sky-keyvisual（1枚キービジュアル×モーショングラフィックス）

## 見た目
2Dイラストの背景（同じ場所を複数アングル）の上に、透過動画のキャラを小節長へリタイムして乗せる。静側（Verse・間奏・落ちサビ）は静止画＋ゆっくりしたカメラ、サビは踊りクリップを2小節ごとにハードカットで切り替える。
カメラは3段ギア（drift / build / beat）で、打点は白フラッシュではなく zoom-punch・shake・registration slam・極短の色ズレ。タイポは語単位の swap、1拍1語の stack、画面いっぱいのタイポボム（bomb）。落ちサビでキャラを黒シルエット＋夕焼けの面にするリセット演出付き。縦ショートは本編と別に組んだ専用構成。

## 向く曲
疾走感のあるデジタル／シンセ／フューチャーポップ、DnB〜四つ打ち EDM。疾走・浮遊・解放・加速を歌う、抜け感のある高エネルギー曲。

## 元になった RESONAL の公開曲
Extra Time

## 使い方
1. `npm install`
2. `public/` に置く（ファイルは同梱しない）:
   - `public/audio.wav` … マスター音源
   - `public/bg_front.png` `bg_wide.png` `bg_close.png` `bg_window.png` … 背景（`src/Field.tsx` の `SRC` が FieldKind → ファイル名の対応）
   - `public/character/<clip>.webm` … キャラの透過動画（アルファ付き WebM）。clip は `A-standing` `B-beckon` `C-para-A` `C-para-B` `D-armsup` `E-closeup` `F-shrug` `G-still`（対応表は `src/Character.tsx`）。始点と終点が揃ったループにすると小節頭で継ぎ目が消える
   - `public/still/<clip>.png` … 同じ clip の静止画（透過PNG・静側で使う）
   - `public/endcard.png` … エンドカード（任意・`meta.endcard`）
3. 書き換える:
   - `input/project.json` … `credits`。公開版の `workflow.config.json` の `credits` をここに写す。`meta.creditsFrom`（秒）から `meta.creditsStep` 秒ごとに1枚ずつ出る
   - `input/lyrics.json` … `meta.sections`（区間ごとの面・クリップ・ギア・フレーミング・シルエット）・`meta.hits`（打点の秒）・`meta.bpm`・`meta.clipDuration`（クリップの実尺）と `lyrics`（`t`/`hold` 秒・`mode` = swap / stack / bomb / small）。値はダミー
   - `src/Root.tsx` … ショート区間 `SHORT_FROM` / `SHORT_TO`
   - 再着色 … `src/Field.tsx` の `PAL`（文字のインク色）と面ごとの色フィルタ
4. `npx remotion studio` でプレビュー → `npx remotion render LyricVideo out/main.mp4`（ショートは `ShortVideo`）

`src/Overlay.tsx`（ベクターライン・破線・軌道サークル）は現状どこからも呼んでいない。背景が単純なときに Stage に足して使う部品。

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。tools/ も無い。
- lyrics.json のスキーマが違う（`lines` ではなく `lyrics`、`pattern` ではなく `mode`、振り付けは `meta.sections` に手で書く）。秒は templates/mv の 01（whisper 転写）の結果を見て手で書く。
- キャラは切り抜き1枚ではなく、透過動画のクリップ群と静止画を自分で用意する前提。
- サムネのコンポジションは無い。

## 注意（発展途上・そのまま共有）
1曲の制作で使った実装をほぼそのまま出している（曲の歌詞・秒をダミーに置換し、キャラのコンポーネント名と素材パスを一般化し、クレジットを `input/project.json` から読むようにしただけ）。
確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。サポートなし。
