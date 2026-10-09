---
name: puppet-rig
description: 1枚のキャラ静止画を Remotion の純CSS「切り絵リグ」で関節から折って踊らせる部品（頭の頷き・上げた腕のポンプ・腰からの傾き）。PNG のコピーを clip-path で部位ごとに切り、関節を軸に入れ子で回転させて拍に同期する。レンダーはほぼ無料。MV で静止画のキャラに「生きている・踊っている」感を出したいとき、全身が一体で揺れるだけでは物足りないときに使う。拍で跳ねる動きは bounce-rig。MV全体のパイプラインではなく、スタイルに差し込む部品。
---

# puppet-rig（CSS 切り絵の関節リグ）

1枚のキャラ静止画を関節から折って踊らせる。CSS だけで頭が頷き、上げた腕がポンプし、胴が腰から傾く。GPU 合成でレンダーはほぼ無料（1フレーム約2秒）。

## 合う／合わない
- 合う: 1枚絵のキャラを前景の主役として生かしたい。色収差・グロー・カメラの視差と併用する。
- 合わない: キャラが居ない／歌詞だけの MV。本物のメッシュ変形が要る案件（Rive 等を手でリグる）。

## 仕組み
1枚のPNGをフルサイズのまま複数枚重ね、各コピーを `clip-path: polygon()` で1部位だけに切り抜き、関節（transform-origin）を軸に回す。部位は入れ子にして親の回転を子に伝える（胴の子が頭と腕）。
割れない条件＝ピボットを継ぎ目の上に置き、隣り合うクリップを数%重ねる。20°を超えても割れない。

## 中身
- `templates/PuppetRig.tsx` — リグ本体。キャラ固有の数字は `IMG` / `ASPECT` / `CLIP` / 各 Part の `ox,oy` だけ。
- `templates/beat.ts` — 自己完結の `useBeat()` / `punchOf()`（プロジェクトに拍の仕組みがあればそちらを使ってこのファイルは消す）。

## 導入手順
1. `PuppetRig.tsx` と（必要なら）`beat.ts` を `projects/<slug>/src/` にコピーする。`beat.ts` の `BPM` / `FPS` を曲と合成に合わせる（BPM は MV プロジェクトの `tools/02_estimate_tempo.py` の実測値）。
2. キャラPNG（透過）を `public/character.png` に置き、`ASPECT`（幅 / 高 px）を設定する。キャラ画像は同梱していない＝自分の立ち絵（セットアップで置いた `profile/images/` の画像など）で試す。透過でなければ `bounce-rig` の `greenkey.py` か rembg で抜く。
3. キャリブレーションする（下記）。
4. シーンに主役として置く。グロー等は `imgStyle={{ filter }}` で渡す。`gain` は 1＝既定、2.5 まで安全。

## キャリブレーション（キャラを差し替えたら必ず）
```bash
ffmpeg -y -i public/character.png -vf "drawgrid=w=iw/10:h=ih/10:t=2:c=red@0.8" out/char_grid.png
```
- 読んだ関節（首・上げた肩・肘・腰）を `ox,oy`（%）に入れる。
- `CLIP` の各矩形は隣の部位と継ぎ目で数%重ねる（首・肩・腰）。
- 立ち姿の脚は `rotate=0` で接地させる。

## 原則
「動いているのに動いて見えない」＝全身が一体で動いて関節を覆い隠している。
1. 全身に skewX を乗せない。
2. 全身の bob/scale は小さく: bob ±4px・kick 項 5px、全身のスケールの kick は 0.03 まで。
3. 関節は大胆に・相対的に: 部位ごとに別位相、頭と腕は胴と逆方向。基準値＝胴 ±5°、頭 ±4°＋kick 7°、腕 ±9°＋kick 13°。
4. 継ぎ目は制約ではない＝迷ったら角度を上げる。

## 検証（書き出し前に必ず）
```bash
npx remotion render <Comp> out/seg.mp4 --frames=540-580 --concurrency=5
# (A) フレーム差分: 頭/腕に局在して光れば正解。シルエット全体が均一に光る＝全身一体で動いている＝NG
ffmpeg -y -i out/seg.mp4 -vf "tblend=all_mode=difference,eq=brightness=0.3:contrast=4" -frames:v 1 out/diff.png
# (B) 連写ストリップ: 腕の角度・頭の傾きが変わっていればOK
ffmpeg -y -i out/seg.mp4 -vf "select=not(mod(n\,8)),scale=420:-1,tile=5x1" -frames:v 1 out/strip.png
```

## 本書き出しの注意
- `--concurrency=5`＋`--timeout=120000`（並列を上げすぎると長尺で delayRender がタイムアウトする）。
- 失敗したら残った Chromium を終了してから再実行する。

## やらないこと
- SVG の feTurbulence＋feDisplacementMap で揺らす（1フレーム約25秒・並列化できない）。
- CSS スキューだけの揺らぎ（関節に見えない）。
- `filter: 'url(#x)'` のあとに `...imgStyle` を展開する（filter は単一プロパティ＝丸ごと上書きされる）。足すなら文字列連結。
