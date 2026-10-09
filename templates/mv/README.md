# MV テンプレート（Remotion・歌詞MV）

カバー画像1枚＋マスター音源＋ `LYRICS.md` から、**16:9 本編 / 9:16 ショート / サムネ** を作る。動画素材は任意（下の「背景ループ動画」）。

## 作り方（これだけ）

リポジトリ直下で:

```bash
tools/make_mv.sh "songs/<曲フォルダ>"
```

出力は曲フォルダに `<Title>.mp4` / `<Title> (Short).mp4` / `thumbnail.jpg`（`<Title>` は song.json の title）。
初回は `projects/<slug>/` にこのテンプレートをコピーして `npm install` する（slug は song.json の `mv_project` に記録）。

前提: 曲フォルダに `<Title>.wav`（マスター）・`LYRICS.md`・`cover.png`（横長）。
`profile/images/character.png` があれば、それを前景（下端中央に立つキャラ）に使う。無ければカバーから被写体を切り抜く。人物のいない風景・部屋の絵で切り抜ける被写体が無ければ、前景なし（カバーの絵だけをカメラと光で見せる）で作る。
曲フォルダに `bg_loop.mp4` があれば、背景を静止画の代わりにループ動画にする（下の「背景ループ動画」）。

| オプション | いつ使う |
|---|---|
| `--allow-unaligned` | whisper が歌を拾えず 04 が止まったとき（拾えない行を前後から割り振る。仕上がりを見て直す） |
| `--bpm MIN MAX` | テンポが倍/半分に取れたとき（BRIEF の BPM ±10 で絞る） |

途中で止まったら、表示された `[NG]` の行を直して同じコマンドをもう一度。転写（01）は済んでいれば飛ばす。

## 中で走るもの（`tools/`）

| # | スクリプト | やること |
|---|---|---|
| 01 | `01_transcribe.sh` | whisper で語ごとの秒 → `<曲>/transcribe/audio_16k.json`（あればスキップ。`WHISPER_MODEL=small` で速く） |
| 02 | `02_tempo.sh` | 音の強さ `input/energy.json`・拍 `input/beats.json`（BPM は実音源から測る） |
| 03 | `03a_prep_cover.sh` / `03b_cutout_fg.sh` | 背景 `public/bg*.png`／前景 `public/fg*.png`（rembg で切り抜き。透過済みの画像は切り抜かない） |
| 03 | `03c_prep_loop.sh` | 曲の `bg_loop.mp4` → `public/bg_loop.mp4`（1920x1080）・`bg_loop_vertical.mp4`（1080x1920）。30fps・音声なし。無ければ public の古いループを消す |
| 04 | `04_build_lyrics.py` | `LYRICS.md` の「## 歌詞（表示用）」（文言）× whisper（秒）→ `input/lyrics.json` |
| 05 | `05_render.sh` | タイトル・クレジット・ループの尺（`00_project.sh`）→ マスターを `public/` へ → 本編・ショート・サムネ |
| 06 | `06_verify.sh` | デコード全走査・クレジットの配線 |

## 歌詞の秒（04）

- 文言は「## 歌詞（表示用）」の1行＝画面の1フレーズ。秒は whisper の実測を文字単位で対応付ける（whisper の聞き取り文字は使わない）。
- 行末に `{drop}` などを書くとその行の見せ方が変わる（`title verse whisper drop hud break slam cut end`。既定 verse）。
- 行幅から字幕の最大サイズを自動で決める（画面からはみ出さない）。
- 対応付けできた行が 60% 未満なら止まる＝`LYRICS.md` が実際の歌と違う。

## 背景ループ動画（任意）

- 置き場: 曲フォルダの `bg_loop.mp4`（横長）。縦を別に用意するなら `bg_loop_vertical.mp4`。無ければ横の中央を 9:16 で切り出す。
- 背景（前景キャラの後ろ）だけが動画になる。前景・サムネはカバー画像のまま。
- 再生は曲の秒に合わせて回し続ける（カットで頭に戻らない）。始点と終点の絵が揃っていると継ぎ目が見えない。
- やめるときは曲フォルダから `bg_loop.mp4` を外して `tools/make_mv.sh` を再実行する。

## シーンの切り替え（任意）

背景の画像をセクションごとに切り替える。曲フォルダに画像と `scenes.json` を置いて `tools/make_mv.sh` を回す。

```json
[
  { "from": 0, "image": "cover.png" },
  { "from": 28.95, "image": "scenes/02_escape.png" },
  { "from": 49.81, "image": "scenes/03_rooftops.png" }
]
```

- `from` は秒（その秒から次のシーンまで、その画像が背景になる）。`image` は曲フォルダからの相対パス。同じ画像を何度使ってもよい。
- `from` はセクションの頭の拍に合わせると、切り替えが音に乗る（歌い出しの秒は `input/lyrics.json`、拍の秒は `input/beats.json`）。
- 画像は横長。縦（ショート）は中央を 9:16 で切り出す。
- 背景ループ動画（`bg_loop.mp4`）があるときは、ループ動画が優先される。
- 前景（キャラ）はそのまま全シーンの前に立つ。サムネはカバー画像のまま。

## 振り付けを手で直す（任意）

`input/song.config.ts` は手で書かなくても動く。曲の長さ・拍・音の強さから、8小節ごとに 強/中/弱 を判定して
カメラ割・光・白飛び・ショートの区間・クレジットの秒を自動で決めている。
直したいときはこのファイルの `config` の値を書き換えて `tools/make_mv.sh` を再実行する
（例: `short: { start: 45, end: 75 }` でショートの区間を固定、`dropHits` にサビ頭の秒を足す、`eye` をキャラの目の位置に）。
`npx remotion studio`（プロジェクト内）でプレビューしながら詰められる。

## 見た目（style）

`src/styles/spectrum-still.tsx` が既定（`workflow.config.json` の `mv.look`）。再着色はファイル冒頭の `PZ`。
フォントは Google Fonts（OFL）を `@remotion/google-fonts` で読む。
新しい見た目は `src/styles/<name>.tsx` に `Style` を実装して `registry.ts` に登録し、`mv.look` をその名前にする。
カメラ・合成・クレジットは `src/engine/` が担うので style では触らない。

## 依存

ffmpeg / node + npm（Remotion 4）/ python3 + numpy / whisper（`pip install openai-whisper`）/
rembg（切り抜きが要るときだけ。03b が `~/.venvs/rembg` に venv を作る。python 3.10〜3.12）。
そろっているかは `tools/check_env.sh`。
