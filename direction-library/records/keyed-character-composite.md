---
name: キー抜きキャラのループ合成 / Keyed Character Composite
slug: keyed-character-composite
category: [構図, モーション, エフェクト, 編集]
difficulty: 3
frequency: S
emotions: [余裕, 存在感, 生存感, 孤独, クール, 没入, 親密, 高揚]
timing: [曲開始, Aメロ, Bメロ, ビルドアップ, ドロップ, サビ, 間奏, ラストサビ, アウトロ]
genres: [リリックビデオ, ボカロ, EDM, J-POP, アニソン, 配信背景, VTuber]
tags: [グリーンバック, クロマキー, colorkey, アルファチャンネル, 透過webm, yuva420p, OffthreadVideo, transparent, Remotion, Loop, 右下アンカー, objectFit contain, 呼吸, Live2D的, 立ち絵, キャラ合成, 素材切替, クロスフェード, 省素材, 3素材運用, 画像→動画, 始点終点一致, 緑かぶり, 縁フリンジ, ネガティブスペース]
---

# キー抜きキャラのループ合成 / Keyed Character Composite

## 概要
グリーンバックで生成したキャラ静止画を動画生成で5秒の微動ループにし、緑を抜いてアルファ付き webm にして背景レイヤーの上に重ね、**全編に「生きている立ち絵」を敷く**手法。少数素材（実証は3素材）でMV1本を成立させる合成レイヤー設計＝キャラ芝居の「出口」。

## 主な用途
- リリックビデオにキャラを常駐させる（背景＋キャラ＋歌詞の3層構成）
- 背景を差し替えるだけでセクション展開を作る（キャラは同じ素材を使い回す）
- 静止画しかないキャラを「呼吸している存在」として全編に置く
- 動画生成の5秒素材を長尺MVの常駐レイヤーに変換する
- VTuber/配信画面の立ち絵レイヤー（Live2Dを持たない段階の代替）

## 感情
- 余裕
- 存在感
- 生存感
- 孤独
- クール
- 没入
- 親密
- 高揚

## 演出カテゴリ
- 構図（画面のどこにキャラを置くか＝歌詞との同居設計）
- モーション（呼吸・微揺れによる生存感）
- エフェクト（クロマキー・アルファ合成・ドロップシャドウ）
- 編集（素材切替のクロスフェード）

## 難易度
★3（パイプライン自体は確立すれば機械的。難所は「アルファが本当に通っているか」の1点のみで、そこを外すと全部無駄になる）

## 使用頻度
S — キャラのいるMVを作るなら事実上の必須基盤。1回組めば全曲に流用でき、素材コストが半分以下になる。

## 使用タイミング
- 曲開始〜終了まで常時（キャラを常駐レイヤーとして敷く）
- Aメロ/Bメロ（キャラは動かさず、背景と歌詞で展開を作る）
- ビルドアップ（キャラだけ `saturate(0)` `brightness(0.32)` に落として「音だけ」の圧を作る）
- ドロップ（`scale 1.32 → 1.0` を0.35秒で戻す"バーン登場"で1回だけ強く出す）
- 間奏（キャラを5秒でフェードアウトして不在にし、戻すと復帰が効く）
- アウトロ（後ろ姿素材に切り替えて去らせる）

## 演出内容
4工程のパイプライン。数値はすべて実装実証値（1920×1080 / 30fps / 約200秒の曲）。

**工程1: グリーンバック静止画を生成**
- プロンプト末尾に必ず固定句を足す: `evenly lit solid chroma green screen background, no green spill on hair, full character visible, clean crisp edges for keying`
- 動画化を見越して **「背景は完全に静止し変化しない」** を明記する（`solid green background stays perfectly still and unchanged`）。動く背景を指定すると緑が階調で揺れてキーが破綻する
- キャラ同一性は参照画1枚に固定（衣装canon）。ポーズ違いを何枚も出すより、**採用ポーズを絞る**ほうが効く
- 実測キー色の例: `0x0dc614`（左上サンプル）。素材ごとに違うので自動サンプリングする

**工程2: 動画生成（providers.video）の画像→動画で微動ループ化**
- 5秒 / 音声OFF / **開始フレームと終了フレームに同じ画像**を指定＝始点と終点が一致してシームレス
- 終了フレーム指定が高解像度設定でしか使えない場合があるので、ループを取るなら解像度をそちらに合わせる
- 動きは瞬き・微呼吸・髪ドリフト・肩越しキープのみ。ポーズを変えさせると顔が別人化する

**工程3: ffmpeg で緑を抜いてアルファ付き webm 化**
```sh
# 緑色を左上8x8からサンプリング
HEX=$(ffmpeg -v error -i "$IN" -vf "crop=8:8:0:0,scale=1:1" -frames:v 1 -pix_fmt rgb24 -f rawvideo - | xxd -p | head -c6)
ffmpeg -y -i "$IN" -vf "colorkey=0x${HEX}:0.30:0.14,format=yuva420p" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -an "$OUT.webm"
```
- `similarity 0.30 / blend 0.14` が実証値。similarity を 0.40 以上に上げると髪や瞳のシアン系まで抜けて穴が空き、0.20 以下だと緑の縁が残る
- 静止画側は同じキー処理をして `_keyed.png` を作っておく（動画を作らないカット用）

**工程4: Remotion で背景の上に重ねる**
```tsx
const CLIP_FRAMES = 152; // 5.07s @30fps
<AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: '2%' }}>
  <Loop durationInFrames={CLIP_FRAMES} layout="none">
    <OffthreadVideo src={staticFile('chara/profile.webm')} muted transparent style={videoStyle} />
  </Loop>
</AbsoluteFill>
```
- **`transparent` プロップが命**（後述の注意点）。これが無いと全部が無駄になる
- `<Loop durationInFrames={152}>` で5秒クリップを何十秒の区間にも敷く

**配置: 右下アンカー＋contain**
- flex を `justifyContent: flex-end` / `alignItems: flex-end`、`paddingRight: '2%'`
- サイズは `height: 100%`（バストアップ）または `92%`（全身）、`width: auto`＝`objectFit: contain` 相当
- **`contain` にする理由＝クロップせず素材を全部見せる。** 体は画面下端で自然に途切れる。`cover` ＋拡大にすると髪の先が切れて「宙に浮いた切れ端」に見える
- 右下に置くと視線と歌詞のスペースが**画面左に空く**＝リリックビデオと同居できる
- `filter: drop-shadow(0 0 40px rgba(0,229,255,0.25))` で背景から浮かせる（キー抜きの縁を光でごまかす副効果もある）

**呼吸（Live2D的な生存感）**
```tsx
const breath = Math.sin((sec * Math.PI * 2) / 4);   // 4秒周期
const breatheY = 1 + breath * 0.012;               // ±1.2%
const breatheX = 1 - breath * 0.006;               // 逆位相 ±0.6%
const floatY = Math.sin((sec * Math.PI * 2) / 5) * 4;    // 5秒周期 4px
const sway   = Math.sin((sec * Math.PI * 2) / 6) * 0.5;  // 6秒周期 0.5deg
// transformOrigin: 'bottom center'（足接地を基点にする）
```
- **拍に合わせたバウンス／ズームパンチは入れない。** 常駐レイヤーが跳ねると落ち着かない。動きは呼吸だけ
- 周期を4/5/6秒とバラすと機械的な同期が消える
- **動画素材にはこの呼吸を重ねない**（クリップ自体が呼吸を持っているため二重になる）。静止画素材にだけ付ける＝これで静止画が動画素材と馴染む

**素材切替**
- ハードカットではなく**1.2秒のクロスフェード**（実装: 2素材を `opacity 1-xf / xf` で混ぜる）＝「ふわっと」切り替わる
- 切替時刻は歌詞・音の構造点に合わせる（発語の頭をフェードの中心に置く）
- 中央1.2秒だけ2レイヤーをレンダーし、それ以外は1レイヤー＝コストも増えない

**コスト設計（最重要の実利）**
- 全編を**3素材だけ**で回した: 横顔=動画 / 振り向き（肩越しグランス）=動画 / 後ろ姿=**静止画**
- 7ポーズ揃えずに成立＝動画生成コストを半分以下に
- **静止画のままでも呼吸を付ければ他素材と馴染む**（後ろ姿は動画化していないが違和感が出ない）
- 素材を増やす前に「配置・呼吸・背景差し替え」で持つかを検証する

## カメラワーク
- **なし（固定）が原則。** キャラは平面レイヤーなので、カメラを動かすと板であることがバレる
- 許容: 背景レイヤーだけの横スライドパン（キャラは動かさない＝簡易パララックス）
- 許容: キャラレイヤー全体の `scale` 変化（ドロップ時の 1.32→1.0 バーン）。ただし1曲に1〜2回まで
- 禁止: orbit / dolly-zoom / 3D回転（平面が即バレる）

## 編集
- 素材切替は 1.2秒クロスフェード（ハードカットにしない）
- キャラの不在区間を作る: 5秒でフェードアウト → 間奏中は不在 → 落ちサビで2秒かけて戻す。**「消える」演出があると常駐の説得力が上がる**
- セクション頭で背景だけ切り替え、キャラは継続＝安く展開が出る
- ドロップの1回だけ `opacity 0 → 1` を0.25秒で叩き込む（バーン登場）

## 色
- **メインカラー:** 背景に依存（キャラは素材の色を保つ）
- **アクセントカラー:** キャラの縁に乗せるグロー色（実装はシアン `rgba(0,229,255,0.25)`）。背景のネオン主色と揃えると合成が馴染む
- **相性の良い配色:** 背景を暗め・低彩度に振り、キャラを画面内で最も明るく彩度の高い要素にする＝キー抜きの縁が目立たなくなる。逆に背景が明るいとフリンジが露呈する
- キャラだけに `filter: saturate()` `brightness()` をかけてセクション演出（ビルドアップでモノクロ化 `saturate(0) brightness(0.32)`、カラードレイン区間で `saturate(0.15)`）

## ライティング
- 素材生成時に **rim light を髪に入れておく**（背景から切り離す最強の手段。合成後の後付けより自然）
- 合成側は `drop-shadow` の外向きグローのみ（内側に光を足すとキー縁が拾われる）
- 背景の主光源方向とキャラの陰の向きを揃える。破綻するなら**背景を暗くしてキャラを自光源にする**のが安全
- 緑かぶり（green spill）が髪に出た素材は、`hue-rotate` で直そうとせず生成しなおす

## リリックとの相性
★★★★★ — 右下アンカーが画面左を丸ごと歌詞に明け渡す設計そのもの。キャラが常駐しているので歌詞側は「読ませる」だけに専念でき、キャラの表情替え（横顔＝内省 / 振り向き＝挑発）が歌詞の内容と噛み合うと1画面で二重に語れる。

## AI画像生成で再現する場合
- **共通キーワード:** `solid chroma green screen background, evenly lit, no green spill on hair, full character visible, clean crisp edges for keying, background stays perfectly still and unchanged`
- **画像生成（providers.image）:** 縦横比を最終動画と一致させ、`#00B140` 近辺の明示色指定と `no shadow on the background`（影が緑に落ちるとキーで穴が空く）、`solid hair silhouette, no wispy strands`（毛先の透けは抜きを汚す）を足す。
  緑一色に固定できない場合は通常背景で出して `rembg` 等で切り抜くほうが速い

## AI動画生成で再現する場合
- **重要要素:** ①背景の緑は絶対に動かさない ②カメラ完全固定 ③微動のみ（瞬き・呼吸・髪ドリフト）④first=tail で始点終点一致 ⑤ポーズ変更・移動を禁止（顔が溶ける）
- **動画生成（providers.video）:** 5s / 音声OFF / 開始・終了フレームに同じ緑背景PNG。negative に `background movement, green background changing, camera movement, zoom, pan, walking, pose change, face morphing, extra limbs`。
  終了フレームを指定できない場合は ffmpeg ピンポン（正＋逆連結）でループ化し、緑背景に階調ノイズが乗る場合はキー時に `similarity` を 0.35 まで上げる

## プロンプト例
**EN:**
```
Same anime girl as the reference, bust-up, cool confident smirk, looking to the side (not at camera).
Subtle Live2D-style idle motion ONLY: slow blink, faint breathing in the shoulders, long silver hair
drifting slightly. She does not change pose, does not move from her position, does not turn her body.
The solid chroma green background stays perfectly still and unchanged for the entire clip.
Static camera, no zoom, no pan. Motion returns to the initial frame — seamless loop.
Negative: background movement, green background flickering or changing, camera movement, zoom, pan,
walking, pose change, dancing, face morphing, extra limbs, green spill on hair, blurry edges, text
```
**JP:**
```
参照画と同一の少女、バストアップ、余裕のあるクールなスマーク、視線は横（カメラを見ない）。
動きはLive2D的な微小アイドルモーションのみ＝ゆっくりの瞬き、肩のかすかな呼吸、銀髪が少し漂う。
ポーズは変えない・位置は動かない・体をひねらない。
単色クロマキーグリーンの背景はクリップ全編で完全に静止し一切変化しない。
カメラ固定・ズームなし・パンなし。動きは最初のフレームに戻る＝シームレスループ。
ネガティブ: 背景が動く, 緑背景の明滅や変化, カメラ移動, ズーム, パン, 歩行, ポーズ変更,
ダンス, 顔の崩れ, 手足の増殖, 髪への緑かぶり, 輪郭のボケ, 文字
```

## 類似演出
- seamless-loop（本演出が消費するループ素材そのものの作り方。役割が分かれる＝あちらは「素材の作り方」、こちらは「画面への置き方」）
- breathing-idle（キャラに載せる呼吸モーションの中身。本演出は静止画素材にもこれを付けて動画素材と馴染ませる）
- hair-cloth-sway（キー抜き素材で最も破綻しやすい部位＝毛先。生成段階で対策する）
- silhouette（キャラを背景から切り離す別解。抜きの縁を隠す最終手段）
- negative-space（右下アンカーで空けた画面左の使い方。歌詞との同居設計の理論側）

## 相性の良い演出
- seamless-loop（5秒クリップを長尺に敷く前提技術。必ずセットで使う）
- breathing-idle（静止画素材に付けて動画素材と質感を揃える）
- kinetic-typography（右下キャラ＋左側歌詞＝この演出の最大の目的）
- negative-space（キャラを寄せて空けた側を意図的に使う）
- neon-lighting（背景のネオン色をキャラのグローに使うと合成が馴染む）
- rim-light（素材生成段階で入れておく。背景からの分離が段違い）
- color-shift（キャラは据え置きで背景だけ色替え＝安く展開が作れる）
- vignette（画面四隅を落とすとキー縁のフリンジが視認されなくなる）
- bloom-overexposure（キャラの輪郭に光を被せて縁を溶かす）
- particle-rise（キャラの手前と奥に粒を分けて置くと平面の板が奥行きに見える）
- film-grain（背景とキャラに共通のグレインを乗せると"別素材感"が消える。合成の最終仕上げ）
- frame-in-frame（同じキャラ素材を小窓で複製して情報量を増やす）

## 相性の悪い演出
- orbit — カメラが回るとキャラが平面の板であることが即バレる
- dolly-zoom — 画角変化に平面レイヤーが追従できず、背景だけ歪んで分離する
- zoom-punch — 拍で毎回跳ねると落ち着かない
- datamosh — フレーム間予測の破壊がアルファチャンネルを壊し、緑や矩形が露出する
- camera-shake — ランダム揺れでキャラと背景がズレて「貼り付けた板」に見える（両レイヤーを同一の揺れで動かすなら可）

## RESONAL での使用例
- Ghosting Hour: 横顔（動画）/ 肩越しグランス（動画）/ 後ろ姿（静止画）の3素材で約200秒を全編カバーし、右下アンカー＋4秒周期呼吸＋1.2秒クロスフェードで常駐させた。

## 注意点
- **★最大の罠: Remotion の `OffthreadVideo` は既定でアルファチャンネルを捨てる。** 内部でフレームをJPEG抽出するため、アルファ付き webm を渡しても抜いたピクセルの**RGB（緑）がそのまま出て緑の矩形が残る**。症状は「動画にすると素材が背景に馴染まない／浮いて見える」という曖昧な形で現れる。解決は **`<OffthreadVideo transparent muted ... />`**（`transparent` でPNG抽出しアルファ保持）。静止画（`<Img>` ＋透過PNG）では起きないので、**動画に差し替えた瞬間に壊れる**のが厄介
- `objectFit: cover` ＋拡大でフレーミングしない。髪の先が切れて「宙に浮いた切れ端」になり没になる。`contain`（`height` 指定＋`width: auto`）で素材を全部見せ、体は画面下端で自然に途切れさせる
- **拍でバウンスさせない。** キャラが常駐するレイヤーで毎拍跳ねると画面が落ち着かない。動きは4〜6秒周期の呼吸だけ
- 動画素材に Remotion 側の呼吸 transform を重ねない（クリップ自体が呼吸を持つため二重になって気持ち悪い動きになる）
- 素材生成プロンプトで背景を動かす指定をしない（`background stays perfectly still` を明記）。緑が階調で揺れるとキーが破綻して縁がチラつく
- `colorkey` の similarity を上げすぎるとキャラのシアン・緑系（髪・瞳・アクセント）まで抜ける。0.30 前後から始めて縁を見ながら微調整する
- 髪への緑かぶり（green spill）は後処理で直らない。生成をやり直す
- 素材を7ポーズ揃えようとしない。3素材＋配置＋背景差し替えで持つ。**素材を増やすより配置と呼吸を詰めるほうが画が良くなる**
- webm（VP9 + yuva420p）は環境によってデコードが重い。長尺レンダーで詰まるなら区間分割レンダー＋concat に切り替える

## 品質チェック
- 緑の縁（フリンジ）や緑の矩形が残っていない（＝`transparent` が効いている）
- ループの継ぎ目（実装では152フレームごと）でキャラが飛ばない・跳ねない
- 髪の先・体の下端が画面外でクロップされていない（`contain` が効いている）
- 素材切替が1.2秒でふわっと繋がっている（ハードカットで飛んでいない）
- 静止画素材と動画素材が同じ「生きている度」に見える（静止画だけ死んでいない）

## バリエーション
- **右下アンカー常駐型:** 実証済みの基本形。画面左を歌詞に明け渡すリリックビデオ用
- **左下アンカー / センター下寄せ:** 歌詞を右または上下に置くレイアウト用。歌詞側の設計で決める
- **静止画のみ運用（動画生成ゼロ）:** キー抜きPNG＋Remotionの `Math.sin` 呼吸だけ。コスト0で生存感を出す最安構成
- **多素材クロスフェード連鎖:** 3素材以上を1.2秒フェードで繋ぎ、セクションごとに表情を替える
- **不在を作る型:** 間奏でキャラをフェードアウトして消し、落ちサビで戻す。復帰の一撃が効く
- **フィルタ演出型:** キャラだけに `saturate` / `brightness` をかけ、ビルドアップでモノクロ→ドロップで色復帰
- **前後2層サンドイッチ:** キャラの手前にも粒/グリッチレイヤーを置き、平面を空間に埋め込む
- **バーン登場型:** `scale 1.32 → 1.0`（0.35秒）＋`opacity 0 → 1`（0.25秒）をドロップに1回だけ。常駐型と組み合わせる

## 関連タグ
グリーンバック, クロマキー, colorkey, アルファチャンネル, 透過webm, yuva420p, OffthreadVideo, transparent, Remotion, Loop, 右下アンカー, objectFit contain, 呼吸, Live2D的, 立ち絵, キャラ合成, 素材切替, クロスフェード, 省素材, 3素材運用, 画像→動画, 始点終点一致, 緑かぶり, 縁フリンジ, ネガティブスペース

## LLM検索キーワード
キャラを合成, 立ち絵を合成, キャラを背景に重ねる, グリーンバック, グリーンスクリーン, クロマキー, 緑を抜く, colorkey, キー抜き, 切り抜き合成, アルファチャンネル, 透過動画, 透過webm, アルファ付きwebm, yuva420p, VP9アルファ, OffthreadVideo, transparent プロップ, Remotionで透過動画, 動画が背景に溶け込まない, 緑が残る, 緑の矩形, 緑の縁, フリンジ, green spill, 髪に緑がかぶる, ループ動画を長尺に敷く, Loop durationInFrames, 5秒クリップを使い回す, 少ない素材でMVを作る, 3素材で1曲, 素材コストを半分, image-to-video, first frame last frame, 立ち絵に呼吸, Live2D的な微動, Math.sinで呼吸, scaleYで呼吸, 拍でバウンスさせない, 右下に配置, 右下アンカー, objectFit contain, 髪が切れる, 宙に浮いた切れ端, 歌詞とキャラの同居, 歌詞のスペースを空ける, 素材のクロスフェード, ふわっと切り替える, キャラを消して戻す, バーン登場, キャラだけモノクロ, ffmpeg colorkey, 生きている立ち絵, 生存感, keyed character, chroma key composite, alpha composite, character layer
