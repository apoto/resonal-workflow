---
name: bounce-rig
description: 1枚のキャラ静止画を Remotion で拍に乗せて跳ねさせる部品（squash & stretch＋部位の位相遅延）と、リグを壊さずに表情差分を足す合成ツール。MV で静止画のキャラを「跳ねているイラスト」に見せたいとき、表情を区間ごとに変えたいとき、グリーンバックで生成したキャラを抜くときに使う。関節で折る動きは puppet-rig。MV全体のパイプラインではなく、スタイルに差し込む部品。
---

# bounce-rig（1枚絵キャラを拍に乗せて跳ねさせる）

1枚のキャラ静止画を squash & stretch で拍に乗せて跳ねさせる。CSS transform だけ＝レンダーはほぼ無料。
キャラを動かす／表情を増やす話はスタイルに焼き込まず、この skill 側に置く。

## 中身
- `templates/BounceRig.tsx` — リグ本体（`BounceRig` コンポーネントと `bounceAt()`）。
- `templates/face_swap.py` — 表情差分を顔だけベースに合成する。
- `templates/greenkey.py` — グリーンバックのキーイング（合成の逆算でαを解く。依存 numpy / pillow / scipy）。

## puppet-rig との使い分け

| | `puppet-rig` | `bounce-rig` |
|---|---|---|
| 何をする | 関節から折る（頭・腕・胴の回転） | 全身が潰れて伸びる（拍で跳ねる） |
| 鉄則 | 全身の bob/scale は小さく | 全身の squash が主役・部位は位相遅延で追従 |
| 合う曲 | 踊っている感・生きている感 | 拍が明確で跳ねるグルーヴ |

`face_swap.py` はどちらのリグでも使える。

## 跳ねの数値

| 項目 | 値 |
|---|---|
| 部位 | 前髪 / 頭 / 胴体 / 腕 / 後ろ髪（1枚のPNGを clip-path で切る。継ぎ目は数%重ねる） |
| 髪の回転中心 | 生え際 |
| 全体の回転中心 | 接地点。バストアップは `squashOriginY` で腰へ |
| 縦横比 | 沈み X:100→102% / Y:100→92% ／ 戻し X:103→100% / Y:95→100% |
| イージング | 上げ＝強い ease-out ／ 下げ＝強い ease-in（非対称） |
| 位相遅延 | 接地 → 胴 → 頭 → 髪 の順に 1〜3 フレーム |

## 規則
- 着地に向かって予備動作で潰す。`u=0` と `u=1` の値を一致させ、拍をまたいで連続にする（中間フレームの無い段差を作らない）。
- カーブは非対称。緩急比（1拍内の縦倍率の変化量 最大/平均）の目安 4倍前後（対称カーブの 2.2倍は NG）。
- 頭・胴の左右振りは使わない。上下の位相遅延と、潰れ量に応じた髪の広がりだけにする。
- バストアップは `squashOriginY` を画面下端に来るライン（腰）へ移し、`amountScale` で量だけ落とす（目安 0.54）。
- クリップの境界は元絵の硬いエッジ（襟・チョーカーの線など）の上に置く。肩の高さに置かない（回転差が段差線になる）。
- BPM と位相は実音源の実測値を使う:
  ```bash
  ../../tools/py.sh tools/02_estimate_tempo.py <audio.wav> [--out tempo.json]   # MV プロジェクト内で実行
  ```
  別区間で独立に検算する。発注 BPM を使わない。
- 縦（9:16）は横の数字を渡さない。縦専用の値を持つ。
- 跳ねを止める区間は `gain=0` ＋ `idleBreath`（完全静止フレームを作らない）。

## 導入手順
1. `templates/BounceRig.tsx` を `projects/<slug>/src/` へコピーする。
2. キャラPNG（透過）を `public/` に置き、`aspect`（幅/高）を渡す。キャラ画像は同梱していない＝自分の立ち絵で試す。
3. キャリブレーションする（下記）。
4. 実測の BPM・位相を `bpm` / `phaseSec` に渡す。
5. シーンに配置する。`gain` は静の区間 0.35・サビ 1.0 など。

### キャリブレーション（キャラを差し替えたら必ず）
```bash
ffmpeg -y -i public/char.png -vf "drawgrid=w=iw/10:h=ih/10:t=2:c=red@0.8" out/char_grid.png
```
生え際 / 顎 / 首の硬いエッジ / 肩 / 腰 / 膝 / 接地 の y% を読み、`CLIP` と各 `ox,oy` を書き換える。隣り合うクリップは継ぎ目で数%重ねる。

### 素材（キャラPNG）
- 1枚絵で作る（パーツを個別に生成しない）。生成は `./tools/gen_image.sh "<プロンプト>" <出力.png> [参照画]`。地はフラットな単色（緑など）を指定し、`greenkey.py` で抜く:
  ```bash
  ./tools/py.sh .claude/skills/bounce-rig/templates/greenkey.py char_gb.png public/char.png
  ```
- 抜きは実測で検証する: 元画像で「地の色」「残す色（髪の差し色など）」だった画素が抜き後にどうなったかを数える。

## 表情差分は「顔だけ合成」

参照画つきの生成では体・髪のシルエットも動く＝clip-path がズレる。生成で粘らず合成で解く。

```bash
./tools/py.sh .claude/skills/bounce-rig/templates/face_swap.py <base.png> <variant.png> <out.png> [--face y0,y1] [--search 24]
```
- デフォルメ頭身は `--face y0,y1` で顔の縦範囲（画像高の割合）を渡す。グリッド画で眉〜顎を読む。
- 位置合わせはアルファ IoU 最大の平行移動を総当たり。アルファはベースから流用＝シルエットは 1px も動かない。
- 検証: 出力のアルファがベースと完全一致／変化した画素が顔の範囲に収まる。
- 顔は楕円まるごと差し替える（目より下だけ等の部分差し替えはしない）。幾何は生成側で揃える＝参照画に base 自身を渡し、制約をプロンプト冒頭近くに置く:

```
Reproduce the EXACT same character as the reference image: identical proportions, identical pose,
identical body, outfit, hair silhouette and hair strands, identical framing and identical image scale — nothing may move or resize.
CRITICAL CONSTRAINT: the head size, the face outline and the cheek width must stay EXACTLY the same as the reference,
and the eyes must keep EXACTLY the same size, position and eyelash line unless the change below explicitly closes them.
IGNORE the facial expression of the reference and replace it as described below, but change NOTHING else.
Change ONLY: <表情の具体>
```

- 受け入れ: 目の幅・高さ・間隔を base と比べ、比が 0.92〜1.08 を外れたら採用せず生成し直す（閉じ目は対象外）。目視だけで判断しない。

### 表情の使い方
- 一瞬の表情変化（打点で 0.3 秒のウインク等）は使わない（チラつく）。
- 区間まるごとで切り替える（サビ明けの笑顔／静かな区間の照れ）。切替は歌い出しの語の秒。
- 常に同じ決め顔にしない。

## 検証（本書き出しの前に必ず）
```bash
npx remotion render <Comp> out/seg.mp4 --frames=1900-1960 --concurrency=4
# 連写ストリップ: 跳ねているか・首が回っていないか
ffmpeg -y -i out/seg.mp4 -vf "select=lt(n\,8),scale=180:-1,tile=8x1" -frames:v 1 out/strip.png
# フレーム差分: 動きがキャラに局在していれば正解
ffmpeg -y -i out/seg.mp4 -vf "tblend=all_mode=difference,eq=brightness=0.30:contrast=6" -frames:v 1 out/diff.png
```
カーブを変えたら緩急比を数値で確かめる。
