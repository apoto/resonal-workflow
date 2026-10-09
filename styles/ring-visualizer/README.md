# ring-visualizer（ネオン円形ビジュアライザ・静止画背景）

## 見た目
背景画像1枚の被写体を中心に、ネオンの円形波形リング3本が音に合わせてウニョウニョ動く。歌詞は出さない。
低音でコアが光って全体が脈動し、背景はゆっくりズームする。16:9 本編と 9:16 ショートを同じプロジェクトから出す。

## 向く曲
歌詞を前に出さない曲・インスト寄りの曲。電子 / シンセ / シティポップ系。

## 元になった RESONAL の曲
RESONAL の公開曲では現在使っていない（初期の歌詞なしビジュアライザ用に作った実装）。

## 使い方

```bash
npm install
npx remotion studio                                   # プレビュー
npx remotion render RingVisualizer out/main.mp4           # 16:9 本編（= npm run render）
npx remotion render RingVisualizerVertical out/short.mp4  # 9:16 ショート（= npm run render:short）
```

`public/` に置くもの:

| ファイル | 中身 |
|---|---|
| `public/audio.wav` | 曲（尺は音源から自動で決まる） |
| `public/background.png` | 背景画像1枚（別名にするなら `src/RingVisualizer.tsx` の `BG_IMAGE`） |
| `public/short.wav` | ショート用に切り出した音（`RingVisualizerVertical` が読む。下記） |

書き換える場所:
- `input/project.json` の `credits`: 冒頭クレジット。リポジトリの `workflow.config.json` の `credits` をそのまま写す（`"Label: Name"` はラベル付きで出る）。秒は `src/Credits.tsx` の `START` / `STEP`。
- `src/Root.tsx` の `defaultProps`: リング中心 `centerX/centerY`、被写体を中央に寄せる `imgShiftX/imgShiftY`（= 0.5 − 被写体の位置）、激しさ `intensity`（1.0〜1.7）・`squirm`（14〜26）、ショートの `ringScale`・`widthScale`・`fadeOutSec`。
- 再着色: `ring1Color/ring2Color/ring3Color`（props）か `src/RingVisualizer.tsx` 冒頭の `COLORS`。

ショート区間の決め方:
```bash
node tools/analyze.mjs public/audio.wav      # BPM・小節グリッド・ドロップ位置・START/END 候補（16bit WAV のみ）
ffmpeg -y -ss <START> -t <END-START> -i public/audio.wav -c:a pcm_s16le public/short.wav
```

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。Remotion を直接叩く。
- 歌詞・whisper・`LYRICS.md` は使わない（歌詞なし）。拍や強弱の事前解析もしない＝毎フレーム音源のスペクトルを直接読む。
- 前景切り抜き・背景ループ・サムネは無い（背景は1枚絵そのまま）。
- 出力は `out/` 。曲フォルダへの配置は手で。

## 注意（発展途上・そのまま共有）
制作で使った実装をほぼそのまま出している。確認したのは `npm install` と `npx tsc --noEmit` の通過まで（レンダーは未確認）。サポートなし。
