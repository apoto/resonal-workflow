# pink-bounce（NEW KAWAII・ピンク高キー＋丸文字＋ドット絵デコ）

## 見た目
ピンク高キーの背景に、Mochiy Pop One の丸文字を2重フチ（白＋ピンク）で1文字ずつ「ぷるん」とポップインさせ、常にゆらゆら揺らす歌詞MV。
ハート・星・プラスのドット絵デコが文字のまわりで弾け、サビは内フチがネオン色になり背景キャラが拍に合わせて腰でグルーヴする。

## 向く曲
明るいアイドルポップ / 電波 / チップチューン寄りのハイパーポップ。自己肯定・ときめき・あざと可愛い歌詞。

## 元になった RESONAL の曲
Made You Look・Okawari Apocalypse（同じリグを曲ごとに再着色して使用）。

## 使い方

```bash
npm install
npx remotion studio
npx remotion render LyricVideo out/main.mp4        # 16:9 本編
npx remotion render ShortVideo out/short.mp4       # 9:16 ショート
npx remotion still Thumbnail out/thumbnail.png     # サムネ（背景＋タイトル）
```

`public/` に置くもの（背景画像は自分で用意する。キャラ絵を中央に据えたこっち向きの1枚が合う）:

| ファイル | 中身 |
|---|---|
| `public/audio.wav` | 曲 |
| `public/bg.png` | 16:9 背景（サムネにも使う） |
| `public/bg_vertical.png` | 9:16 背景 |
| （任意）`meta.backgroundPoses` / `meta.scenes[].src` に書いたファイル | サビのポーズ切替・区間ごとの背景絵 |

書き換える場所:
- `input/lyrics.json`: 歌詞と秒。1行＝1画面。`pattern` は `center`（下寄せ中央）/ `split`（左右の縦書き）/ `scatter`（`words` で位置・サイズ・傾きを指定）/ `giant`（半透明の特大＝間奏のつなぎ）。`neon: true` でサビ色、`handwrite: true` で丸ゴシック。スキーマは `src/types.ts`。
- `input/lyrics.json` の `meta`: `duration`（秒）・`bpm`・`sections`（区間名でカメラと画面演出が変わる）・`danceRegions`（キャラが踊る区間）・`intro`（クレジットの秒）。
- `input/project.json`: `title`（サムネのタイトル）と `credits`（冒頭クレジットの文言）。`workflow.config.json` の `credits` をそのまま写す。
- `src/Root.tsx` の `SHORT_START` / `SHORT_END`: ショートの区間（秒）。
- 再着色: `src/PinkBounce.tsx` 冒頭の `PALETTE` だけ。区間ごとの色かぶりは `src/Background.tsx` の `GRADES`。

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。Remotion を直接叩く。
- `input/lyrics.json` は形式が違う（行ごとに `pattern` と配置を持つ）。手で書くか、templates/mv の 01（whisper）/ 04（`LYRICS.md`→`lyrics.json`）で出した秒を見ながらこの形式に写す。
- `sections`・`bpm`・`danceRegions` も手で書く（templates/mv のような拍・強弱からの自動決定は無い）。
- 背景画像は自分で用意して `public/` に置く（切り抜き・整形の 03 は無い）。
- `ShortVideoDance`（ダンスのループ動画を背景に敷く縦版）は `src/LyricVideo.tsx` に実装だけあり、Root には登録していない。

## 注意（発展途上・そのまま共有）
数曲の制作で使った実装をほぼそのまま出している。確認したのは `npm install` と `npx tsc --noEmit` の通過まで（レンダーは未確認）。サポートなし。
