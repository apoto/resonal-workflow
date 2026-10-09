# lowpoly-corridor（血赤ローポリ3D世界 × 暴れるカメラ × 立つキャラ）

## 見た目
Remotion + React Three Fiber で、ネオン発光する石門の回廊・ポピー畑・ローポリの岩でできた血赤の3D世界を組み、カメラがカット割りで駆け抜ける（突進 / 回転トンネル / 俯瞰旋回 / 段階ズーム / キャラの構図違い）。
透過連番のキャラを3D平面で立たせ、Bloom・色収差・反射床をかける。落ちサビは金のゴッドレイが差す白い世界に切り替わる。歌詞は赤白の明朝。

## 向く曲
ダーク / ゴシック / 退廃で、攻撃的な縦ノリ（シンフォニックハードコア・ガバ・ダークEDM）。荘厳さと爆発の落差がある曲。

## 元になった RESONAL の曲
Poppy Requiem（このテンプレートはその実装。Dive Reflex も同じ系統）。

## 使い方

```bash
npm install
npx remotion studio
npx remotion render Main out/main.mp4 --gl=angle     # 16:9 本編
npx remotion render Short out/short.mp4 --gl=angle   # 9:16 ショート
```
WebGL を使うので `angle` 必須（`remotion.config.ts` にも設定済み）。`CineTest` は1枚絵の見た目確認用。

`public/` に置くもの:

| ファイル | 中身 |
|---|---|
| `public/audio.wav` | 曲 |
| `public/poppy.png` | 花の sprite（透過PNG・1輪） |
| `public/char_seq/001.png …` | キャラの透過連番（縦横比 0.667・足元を揃えたもの。下記） |

キャラ連番は、グリーンバックで撮った（生成した）全身の動画から作れる:
```bash
tools/greenscreen_to_seq.sh <greenscreen.mp4>   # → public/char_seq/。最後に SEQ_LEN を表示
```
依存は ffmpeg と python3（numpy / scipy / pillow）。`REALESRGAN_DIR` を指定したときだけ x2 超解像する。表示された枚数を `src/MainScene.tsx` の `SEQ_LEN` に入れる。

書き換える場所:
- `src/Root.tsx` の `AUDIO_SEC`: 曲の尺（秒。`ffprobe` で測る）。
- `src/timeline.json`: `sections`（`intro / verseChar / build / drop / interlude / breakdown / buildup / finaldrop / outro`。区間の種類でカット割りが決まる）と `lyrics`（`t` / `end` / `text`）。
- `src/ShortScene.tsx` の `SHORT_START` / `SHORT_END` とショート用の歌詞・構図（`S + 秒` で書く）。
- `input/project.json`: `title`（この文字列を含む歌詞行がフック扱い＝赤・特大）と `credits`（冒頭クレジット。`workflow.config.json` の `credits` をそのまま写す）。クレジットの秒は `src/Credits.tsx` の `START` / `STEP`。
- 色: ライト・霧は `src/MainScene.tsx` / `src/ShortScene.tsx` の `<ThreeCanvas>` 内、門・花・岩は `src/Scene.tsx`、カメラは `MainScene.tsx` の `shotFor` と `CUTS`。

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。Remotion を直接叩く。
- 歌詞は `src/timeline.json` に手で書く（templates/mv の 01 / 04 で出した秒を `t` / `end` に写してもよい）。区間（`sections`）も手で書く。
- 前景は1枚絵ではなく透過連番。花の sprite も自分で用意する。
- 3D なのでレンダーが重い（`--gl=angle`・concurrency 4）。

## 注意（発展途上・そのまま共有）
1曲の制作で使った実装をほぼそのまま出している（`shotFor` 等の座標はその曲のキャラ配置に合わせた値）。確認したのは `npm install` と `npx tsc --noEmit` の通過まで（レンダーは未確認）。サポートなし。
