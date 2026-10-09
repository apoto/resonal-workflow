---
name: release-prep
description: リリース準備。workflow.config.json の release.targets（youtube / dsp / other / none）で選んだ先の分だけ、tools/release_prep.sh で release/ 一式（ジャケット・サムネ・説明文の下書き・チェックリスト）を作り、YouTube のタイトル・説明文・タグと配信サービス用の曲情報を整え、UPLOAD-CHECKLIST.md を利用者と一緒に確認する。アップロードは利用者が行う。「リリースの準備」「説明文を書いて」「タグを考えて」「配信の情報をまとめて」「アップロードしたい」と言われたとき、または new-song のリリース準備工程で使う。
---

# リリース準備（release/ 一式 → 文面を整える → 一緒に確認）

アップロードと公開は利用者が自分のアカウントで行う。AI は貼るだけの文面とファイルを揃える。
作るものはリリース先（`node engine/config.js release`）で決まる。`none` なら何も作らずに終わる。リリース先を変えたいと言われたら skill `setup` で直す。

## 1. 一式を作る
```bash
./tools/release_prep.sh "songs/<曲フォルダ>"
ls -la "songs/<曲フォルダ>/release/"
```
- リリース先の分がそろったことを確かめる（youtube＝thumbnail.jpg・youtube.txt／dsp＝jacket_3000.jpg・dsp.txt／other＝jacket_3000.jpg、どれも UPLOAD-CHECKLIST.md）。
- jacket_3000.jpg を Read で観て、顔や大事な部分が切れていないか確かめる。
- 切れている・`[!!]`（カバーの短辺が小さく大きく拡大した）が出たときは、「このまま使う／正方形で描き直す（画像の生成が1回増える）」を利用者に選んでもらう。描き直すなら下の手順で作る。
- ジャケットやサムネに別の画像が要るとき（正方形で描き直す・サムネ専用の絵など）は、`tools/gen_image.sh` で作る（providers.image に従う。exit 3 の扱いは skill `composing` の手順 2 と同じ）。作る前に利用者に聞く。
  - ジャケットを差し替えるなら、正方形の画像を `release/jacket_3000.jpg` に 3000×3000 で書き出す（`ffmpeg -y -i <画像> -vf "crop='min(iw,ih)':'min(iw,ih)',scale=3000:3000:flags=lanczos" -q:v 2 "songs/<曲フォルダ>/release/jacket_3000.jpg"`）。

## 2. youtube.txt を整える（youtube）
読むもの: BRIEF.md・LYRICS.md・profile/world.md・profile/character.md・`workflow.config.json` の `artist` / `credits`。
- **タイトル**: `<Title> / <artist>` を基本に、利用者の好みの形式があればそれに合わせる。
- **説明文**: 冒頭2行に曲の一言紹介（一覧で見える部分）→ クレジット（`credits` をそのまま）→ 歌詞（「歌詞（表示用）」）→ 使った生成 AI の明記。
- **タグ**: ジャンル・ムード・ユニット名・歌い手名を中心に 10〜15 個。曲と関係ない人気語を入れない。
- 書き終えたら先頭の `[下書き]` 行を消す（`./next.sh` が下書きかどうかをこの行で見る）。

## 3. dsp.txt を整える（dsp）
- 作詞・作曲の名義（`producerName`）が空か「未定」なら、利用者に聞いて `workflow.config.json` に書き、dsp.txt にも入れる。MV のクレジットとは別だと添える。
- 曲名・アーティスト名・作詞・作曲・ジャンル・言語・歌詞の有無・露骨な表現の有無・発売日（空欄で利用者に聞く）を並べる。
- 作詞・作曲のクレジットと、AI を使ったことの申告欄の書き方は、配信サービスごとに規約が違う。「使う配信サービスの最新の規約で、作詞作曲の名義と AI 使用の申告方法を確認してください」と必ず伝える。AI の側で規約を断定しない。
- 書き終えたら先頭の `[下書き]` 行を消す。

## 4. 一緒に確認する（人の番）
- UPLOAD-CHECKLIST.md を上から1項目ずつ読み上げ、利用者に確かめてもらう。直したい点があればその場で直す。
- 文面を見せ、「この内容でよいか」を聞く。OK をもらってから終える。
- 最後に `./next.sh "<曲フォルダ>"` を実行し、exit 0 を確かめて伝える（リリース先に無い行は書かない）:
  ```
  リリースの準備ができました。
  - YouTube: release/youtube.txt の文面と <Title>.mp4・thumbnail.jpg を使ってアップロードしてください
  - 配信サービス: release/dsp.txt の情報と <Title>.wav・jacket_3000.jpg を使って申請してください
  アップロードと公開の操作はご自身でお願いします。
  ```

## 規則
- 説明文・タグに、実在のアーティスト名や他人の曲名を検索流入目的で入れない。
- 個人情報（本名・住所・連絡先）を、利用者が書いてと言わない限り入れない。
