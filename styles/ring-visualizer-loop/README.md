# ring-visualizer-loop（ネオン円形ビジュアライザ・ループ動画背景）

## 見た目
ring-visualizer の背景を短いループ動画にしたもの。背景動画は音楽と関係なく一定速度でループし続け、ネオンの円形波形リング3本だけが音に反応する。
歌詞は出さない。16:9 本編と 9:16 ショートを同じプロジェクトから出す。

## 向く曲
歌詞を前に出さない曲・インスト寄りの曲で、1枚絵より「生きている」背景にしたいとき。電子 / シンセ系。

## 元になった RESONAL の曲
RESONAL の公開曲では現在使っていない（初期の歌詞なしビジュアライザ用に作った実装）。

## 使い方

```bash
npm install
npx remotion studio
npx remotion render RingVisualizer out/main.mp4           # 16:9 本編
npx remotion render RingVisualizerVertical out/short.mp4  # 9:16 ショート
```

`public/` に置くもの:

| ファイル | 中身 |
|---|---|
| `public/audio.wav` | 曲（尺は音源から自動で決まる） |
| `public/background.mp4` | 背景のループ動画（数秒）。**下の再エンコード済みのもの** |
| `public/short.wav` | ショート用に切り出した音（`RingVisualizerVertical` が読む） |

背景動画は 30fps 固定・全フレームをキーフレームにしてから置く（黒コマ・ループの継ぎ目対策）:
```bash
ffmpeg -y -i <clip> -vf fps=30 -fps_mode cfr -c:v libx264 -g 1 -keyint_min 1 -crf 16 -pix_fmt yuv420p -an public/background.mp4
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=noprint_wrappers=1 public/background.mp4
```
出てきたフレーム数を `src/RingVisualizer.tsx` の `BG_VIDEO_FRAMES` に入れる。素材の頭と終わりで動きが止まるなら、往復（順再生＋逆再生）にしてから置くと止まって見えない。

書き換える場所:
- `input/project.json` の `credits`: 冒頭クレジット。`workflow.config.json` の `credits` をそのまま写す。秒は `src/Credits.tsx` の `START` / `STEP`。
- `src/Root.tsx` の `defaultProps`: `centerX/centerY`・`intensity`・`squirm`・ショートの `ringScale`/`widthScale`、縦で顔が切れるときは `objectPosY`。
- 再着色: `ring1Color/ring2Color/ring3Color` か `src/RingVisualizer.tsx` 冒頭の `COLORS`。

ショート区間は `node tools/analyze.mjs public/audio.wav` で候補を出し、ffmpeg で `public/short.wav` に切る（ring-visualizer と同じ）。

レンダーの注意: 背景が `<Video>` なので並列を下げている（`remotion.config.ts` で concurrency 3）。`delayRender` のタイムアウトが出たら 2 → 1 に下げる。書き出し後、黒コマが無いか確認する（`ffmpeg -i out/main.mp4 -vf signalstats,metadata=print:file=y.txt -an -f null -` の YAVG が急に落ちるフレーム）。

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。Remotion を直接叩く。
- 歌詞・whisper・`LYRICS.md` は使わない（歌詞なし）。
- templates/mv の背景ループは曲の秒に合わせて回すが、こちらは `<Loop>` でループ素材を独立に回す。素材の再エンコードとフレーム数の記入は手で。
- 出力は `out/`。曲フォルダへの配置は手で。

## 注意（発展途上・そのまま共有）
制作で使った実装をほぼそのまま出している。確認したのは `npm install` と `npx tsc --noEmit` の通過まで（レンダーは未確認）。サポートなし。
