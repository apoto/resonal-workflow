---
name: composing
description: 作曲工程。音源の生成に渡す文章（style / lyrics / exclude）とカバー画像を用意し、利用者に音源を生成してもらい（既定は Suno・workflow.config.json の providers.music で選ぶ）、気に入ったテイクの wav を曲フォルダに audio.wav で置いてもらう。「Suno 用のプロンプトを作って」「作曲して」「カバー画像を作って」「音源を置いた」と言われたとき、または new-song の作曲工程で使う。
---

# 作曲（生成に渡す文章 → 人が生成 → audio.wav）

音源の生成とダウンロードは利用者が行う。AI はコピペできる文章とカバー画像を用意する。
どのサービスを使うかは `workflow.config.json` の `providers`（`music` と `image`）。`other` のときは `note` の指示に従う。

## 読むもの
- `songs/<曲フォルダ>/BRIEF.md`（サウンド・ビジュアル）と `LYRICS.md`（歌詞（Suno用））
- profile/sound.md・profile/character.md
- `node engine/config.js providers.music` と `node engine/config.js providers.image`（`use` と `note`）

## 1. 生成に貼る文章を3つ書く
曲フォルダにプレーンテキストで書く。利用者は開いて貼るだけにする。ファイル名は music が何でも同じ（`suno_*.txt`）。
- music=`other` のときは `note` のサービスの入力欄（スタイル・歌詞・除外）に合わせて書き方を変えてよい。文字数の上限はそのサービスの説明で確かめる。

| ファイル | 中身 |
|---|---|
| `suno_lyrics.txt` | LYRICS.md の「歌詞（Suno用）」節をそのまま（見出し行は含めない） |
| `suno_style.txt` | Style。英語で1段落、1000文字以内 |
| `suno_exclude.txt` | Exclude Styles。カンマ区切り1行。入れたくない音色・要素 |

### Style の書き方
- 先頭から順に: ①ジャンル＋BPM ②ボーカルの声質と歌い方 ③曲の展開の要（サビの盛り上がり・転調・終わり方）④音の質感。長すぎたら④から削る。
- ボーカルは言語・年齢感・性別で指定する（例: `young Japanese female vocal`、英語詞なら `... singing in English`）。
- 声質（timbre）と歌い方（delivery）を分けて書く。欲しいものは肯定形で、避けたいものは `not ...` で書き、Exclude にも入れる。
- 曲の長さは書かない。
- Style で欲しいと書いた語を Exclude に書かない。

## 2. カバー画像を用意する（横長 16:9 の cover.png）
- まず `cover_prompt.txt` にプロンプトを書く（英語。BRIEF.md の「ビジュアル」から。末尾に `no text, no letters, no typography`）。
- 表情・ポーズはプロンプトの先頭近くに具体的に書く。
- providers.image に従って作る。窓口は `tools/gen_image.sh` だけ（サービスを直接呼ばない）:
  ```bash
  ./tools/gen_image.sh "$(cat "songs/<曲フォルダ>/cover_prompt.txt") 16:9 landscape." "songs/<曲フォルダ>/cover.png" [profile/images/character.png]
  ```
  | exit | 意味 | 動き |
  |---|---|---|
  | 0 | できた | 画像を Read で観て、`ffprobe -v error -show_entries stream=width,height -of csv=p=0 <cover.png>` で横長か確かめる |
  | 3（image=`other`・`cmd:` でない） | AI が note に従う | 表示された note の手順で作り、`cover.png` に置いて同じく確かめる。手順が分からなければ利用者に聞く |
  | 3（image=`manual`） | 人の番 | `cover_prompt.txt` の中身を見せ、「好きな方法で作るか、手持ちの横長画像を `songs/<曲フォルダ>/cover.png` に置いてください」と頼む |
  | 1・2 | 失敗・道具が無い | 自動で再実行せず、エラーを伝えて利用者に判断してもらう |
  - キャラの立ち絵（profile/images/character.png）があれば3つ目の引数に渡して見た目を揃える。
  - 生成は数分かかることがある。生成は課金や回数制限の対象になりうるので、1回ずつ結果を見てから次に進む。
- 利用者が自分の画像を置いた場合はそれを使う。

## 3. 利用者に音源を作ってもらう（人の番）
providers.music で文面を選んで頼み、止まる。

music=`suno`:
```
Suno での生成をお願いします。
1. Custom モードで次を貼ってください
   - Lyrics: songs/<曲フォルダ>/suno_lyrics.txt
   - Style of Music: songs/<曲フォルダ>/suno_style.txt
   - Exclude Styles: songs/<曲フォルダ>/suno_exclude.txt
   - Title: <Title>（前の曲の値が残っていないか確かめてください）
2. 何本か生成して、気に入ったテイクを選んでください
3. そのテイクを WAV でダウンロードして songs/<曲フォルダ>/audio.wav に置いてください
置いたら「置いた」と言ってください。作り直したいときは、どこが気になるか（声・テンポ・雰囲気など）を教えてください。文章を直して渡し直します。
```

music=`other`: 上と同じ形で、1 を `note` のサービスの入力欄に読み替えて書く（貼るファイル3つのパスとタイトルは同じ）。3 は「WAV で書き出して audio.wav に置く」。

music=`manual`:
```
音源の用意をお願いします。
- 歌詞と曲の方向性: songs/<曲フォルダ>/suno_lyrics.txt・suno_style.txt
- できた音源を WAV で songs/<曲フォルダ>/audio.wav に置いてください
置いたら「置いた」と言ってください。
```

- 作り直しの指示が来たら `suno_*.txt` を直し、同じ文面で頼み直す。

## 4. 受け取ったら確かめる
```bash
ffprobe -v error -show_entries format=duration:stream=sample_rate,channels -of default=nw=1 "songs/<曲フォルダ>/audio.wav"
```
- 読めて 30 秒以上あることを確かめ、`./next.sh` を実行する。

## 規則
- 生成された音源の長さを編集しない。イントロ・アウトロ・末尾の余韻を切らない（前後に無音を足すのは可）。発注した内容より、出てきた音が正。
- テンポは Style に書いた BPM ではなく、実音源を測った値を使う（MV 工程で測る）。
- 音源が届いたら止まらずにマスタリングへ進む。

## 自分の歌・楽器を混ぜたいとき（聞かれたら）
1. 何を自分で入れるかを聞く（例: 歌だけ／ギターだけ／全部）。全部なら `manual` と同じく、完成した wav を `audio.wav` に置いてもらう。
2. 伴奏を用意してもらう。Suno で歌なし（インスト）を作るか、パート別の音源を書き出す（使えるかは利用者のプランと規約で確かめてもらう）。`songs/<曲フォルダ>/stems/inst.wav` に置いてもらう。
3. 録音は伴奏を聴きながら、伴奏と同じ頭から録ってもらう（頭の無音を切らない）。`stems/vocal.wav` などに置いてもらう。
4. 混ぜる: `./tools/mix_stems.sh "songs/<曲フォルダ>" stems/inst.wav stems/vocal.wav:0:-2`。ずれは聴いて合わせる（録音が早い→正の秒）。音割れで止まったら各音源の dB を下げる。
5. できた `audio.wav` を利用者に聴いてもらい、ずれ・音量を直す。OK ならマスタリングへ。
6. 歌を自分で入れたら、`workflow.config.json` の `vocalName` とクレジットを本人の名前に直すか聞く。
- EQ・コンプ・リバーブなどのミックスは扱わない。こだわりたい場合は DAW で混ぜた wav を `audio.wav` に置いてもらう。

