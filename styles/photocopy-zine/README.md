# photocopy-zine（ジン／コピー機）

## 見た目
生成りの紙地に、網点（ハーフトーン）化したキャラ画像を「コピー」として刷る。紙グレイン・トナーのムラ・端の黒帯が、曲が進むほど劣化していく（コピーのコピー）。
歌詞は極太コンデンス体（Anton）が左からローラーで刷り出され、消えると版ズレの薄い刷りとして残る。紙送り・指紋スタンプのタイトルカード・アンバーの回転灯スイープ・隅の書類UI（GEN / SHEET / タイムコード）付き。

## 向く曲
速くて高エネルギーだが攻撃一辺倒ではない曲（ひねくれポップ／疾走系・BPM 150〜175）。歌詞が嘘・偽物・皮肉・繰り返し・不安定さを扱うもの。英語詞向け（日本語も表示はできるが Anton の横幅見積もりは欧文前提）。

## 元になった RESONAL の公開曲
Repeat Offender

## 使い方
1. `npm install`
2. `public/` に置く（ファイルは同梱しない）:
   - `public/audio.wav` … マスター音源
   - `public/plate_a.png` `plate_a2.png` `plate_b.png` `plate_c.png` `plate_d.png` … 構図ごとのキャラ画像（1920x1080 推奨）。構図の切り替えは `src/scenes.ts` の `CUTS`
   - `public/ht/*.png` … 網点プレート。`python3 tools/07_halftone_plates.py` で上の plate から生成（numpy / Pillow）
   - `public/thumbprint.png` … タイトルカードの指紋。`python3 tools/08_thumbprint.py` で生成
3. 書き換える:
   - `input/project.json` … `title`（タイトルカード・サムネに大文字で出る）と `credits`。公開版の `workflow.config.json` の `credits` をここに写す
   - `input/lyrics.json` … 歌詞（`t`/`hold` 秒・`layout` = line / stamp / strip / small / tower・韻のまとまり `grp/gi/gn`・`accent: "amber"`）と `meta.bpm` / `meta.firstBeat`。`tools/06_build_lyrics.py` の表を書き換えて実行すると生成できる（重なり検査つき）
   - `src/scenes.ts` … 曲の秒で決まる演出すべて（カット表 `CUTS`・劣化カーブ `DEGRADE`・世代表記・クレジットの秒・タイトルカードの秒・アウトロのスタンプ・ショート区間）。値はダミー
   - 再着色 … `src/photocopy-zine.ts` の `PAL`
4. `npx remotion studio` でプレビュー → `npx remotion render LyricVideo out/main.mp4`（ショートは `ShortVideo`、サムネは `npx remotion still Thumbnail out/thumbnail.png`）

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。素材の準備・lyrics.json・レンダーは上の手順を手で回す。
- lyrics.json のスキーマが違う（`lines` ではなく `lyrics`、`pattern` ではなく `layout`）。templates/mv の 01（whisper 転写）で取った語の秒を見ながら、`tools/06_build_lyrics.py` の表に手で写す。
- 振り付けは自動判定ではなく `src/scenes.ts` に手で書く。
- 背景ループ動画・前景の自動切り抜きは無い。プレート画像は自分で用意する。

## 注意（発展途上・そのまま共有）
1曲の制作で使った実装をほぼそのまま出している（曲の歌詞・秒・タイトル文言をダミーに置換し、クレジットを `input/project.json` から読むようにしただけ）。
確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。サポートなし。
