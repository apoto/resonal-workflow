---
name: setup
description: clone 直後に1回だけ行う対話のセットアップ。道具の確認と導入 → ヒアリング（作りたい音楽・世界観・歌い手・歌詞・クレジット・音の大きさ・使う外部サービス・リリース先）→ profile/ と workflow.config.json を書く。「セットアップして」「セットアップから始めて」「このワークフローを使って曲を作りたい」「初期設定」と言われたとき、profile/ が無いまま作業を頼まれたとき、「キャラを変えたい」「音の大きさを変えたい」「画像生成を別のサービスにしたい」「配信サービスにも出したい」など設定を変えたいときに使う。
---

# セットアップ（対話）

利用者と一緒に、このリポジトリを「その人の音楽を作る道具」にする。決めるのは利用者、書くのは AI。

## 0. 現在地を見る
```bash
ls profile/ workflow.config.json 2>/dev/null
```
- 両方あれば設定変更モード: 何を変えたいかだけ聞き、該当ファイルだけ直して手順 3 の確認に進む。
- 無ければ 1 から順に進める。最初に「これから道具の確認 → 10ほど質問 → 設定ファイル作成、の順で進めます。10〜15分ほどです」と伝える。

## 1. 道具を確認して入れる
```bash
./tools/check_env.sh
```
- 結果を「ある / 無い / 任意」の表で見せる。
- 無い必須の道具は、1つずつ「入れ方」と「入れてよいか」を聞き、了承を得てから入れる。了承前に入れない。
  | 道具 | macOS | Linux |
  |---|---|---|
  | Node.js 20+ | `brew install node` | 配布元の手順（nvm など） |
  | Python 3.10+ | `brew install python` | `sudo apt install python3 python3-pip` |
  | ffmpeg | `brew install ffmpeg` | `sudo apt install ffmpeg` |
  | whisper・numpy | `./tools/setup_venv.sh`（専用の箱 `~/.venvs/resonal-workflow` に入れる） | 同左 |
- `sudo` が要るコマンドは利用者に実行してもらう（パスワードを AI に渡させない）。
- whisper は初回にモデルを取りに行くため時間がかかると伝える。
- 外部サービス用の道具（codex CLI・Kling MCP・Slack など）はここでは入れない。手順 2 の Q7 で選んだものだけ案内する。
- 入れたら `./tools/check_env.sh` をもう一度実行し、必須が揃ったことを出力で確かめる。揃わないまま 2 に進まない。

## 2. ヒアリング（1メッセージ1問）
聞き方の規則:
- 1回に1問。短く聞き、答えの例を2〜3個添える。
- 毎回「分からなければ『あとで決める』でOK」と添える。あとで決める項目は「未定」と書いておき、後から `setup` で埋められると伝える。
- 答えを要約して1行で復唱してから次の問いへ進む。
- 例は `profile.example/` の書き方を参考にする（ジャンルを1つに寄せない）。
- 実在のアーティスト名・曲名で答えられたら、音の特徴（テンポ感・楽器・リズム・歌い方・ムード）に言い換えて復唱し、合っているか確かめる。名前は profile に書かない（音源サービスに渡す文章に流れると受け付けられないことがあり、特定の曲の模倣にもなる）。
- 「決めて」「おまかせ」と言われたら、それまでの答えに合う候補を2〜3個、理由つきで出して選んでもらう。AI が1つに決めて先へ進まない。

| # | 聞くこと | 例 | 書き込み先 |
|---|---|---|---|
| Q1 | 作りたい音楽の傾向（ジャンル・ムード・テンポ感・好きな雰囲気を言葉で） | 「夜の街のシティポップ、ゆったり」「速くて激しい音ゲー曲」「ピアノのバラード」 | profile/sound.md |
| Q2 | テーマ・世界観（曲で表現したいこと） | 「都会の孤独と小さな救い」「放課後の青春」「架空の街の物語」 | profile/world.md |
| Q3 | 歌い手・キャラクターはいるか | 「いる」「いない（声だけ）」 | profile/character.md |
| Q3-2 | （いる場合）名前と一人称 | 「ミナト・私」「レン・僕」 | profile/character.md |
| Q3-3 | （いる場合）性格と話し方 | 「明るくて少し抜けている」「クールで丁寧語」 | profile/character.md |
| Q3-4 | （いる場合）見た目を言葉で | 「銀髪ボブ・黒いパーカー・ヘッドホン」 | profile/character.md |
| Q3-5 | （いる場合）立ち絵の画像があるか。あれば置き場所 | 「~/Pictures/chara.png」「まだ無い」 | profile/images/character.png |
| Q3-6 | 歌声のイメージ（性別・年齢感・声質・歌い方）。キャラがいなくても聞く | 「若い女性の澄んだ声、軽やかに」「低めの男性の声、語るように」「曲ごとに決める」 | profile/sound.md の「音の好み」に `ボーカル:` で |
| Q4 | 歌詞の言語と作風のこだわり（任意） | 「日本語、サビに英語を少し」「英語のみ」「説明的な言葉を避けたい」「使いたくない言葉がある」 | profile/lyrics.md・config の lyricsLang |
| Q5 | ユニット名（アーティスト名）とクレジットの表記 | 「MOONLIT LANE／Vocal: ミナト／Produced by 自分の名前」 | config の artist・vocalName・producerName・credits |
| Q6 | 音の大きさと音色: `streaming`（一般的な曲。配信の基準音量・元の音色のまま）か `loud`（EDM・音ゲー系。音圧強め・低域と高域を持ち上げる） | 迷ったら streaming | config の mastering |
| Q7-1 | 音源を作るサービス（推奨: Suno） | 「Suno」「Udio で作って wav を置く」「自分で作った音源を置く」 | config の providers.music |
| Q7-2 | 画像（カバー・ジャケット）を作るサービス（推奨: codex CLI） | 「codex」「`mytool gen --prompt ... -o out.png` で作れる」「自分で用意する」 | config の providers.image |
| Q7-3 | MV の背景を動かす動画素材を作るか（任意。推奨: Kling MCP） | 「Kling MCP」「別の MCP の xxx を使う」「使わない」 | config の providers.video |
| Q7-4 | できた MV を受け取る通知先（任意） | 「Slack」「使わない」 | config の providers.notify |
| Q8 | どこにリリースするか（複数可） | 「YouTube だけ」「YouTube と配信サービス（Spotify・Apple Music など）」「SoundCloud」「リリースしない（作って手元に置く）」 | config の release.targets・release.note |
| Q8-2 | （配信サービスに出す場合）配信の作詞・作曲者の名義。MV のクレジットとは別 | 「本名」「ハンドルネーム」「ユニット名と同じ」 | config の producerName |

Q7 の聞き方:
- 各問いで、推奨と選択肢を並べて見せる:
  | 用途 | 推奨 | 選べる値 |
  |---|---|---|
  | music | Suno（`suno`） | `suno` / `other` / `manual` |
  | image | codex CLI（`codex`） | `codex` / `other` / `manual` |
  | video | Kling MCP（`kling-mcp`） | `kling-mcp` / `other` / `none` |
  | notify | Slack（`slack`） | `slack` / `none` |
- どれも有料のプランやクレジットが要ることがある。「料金と利用条件は各サービスの料金ページと規約で確認してください」と添える。金額は言わない。
- 推奨以外を選んだら `other` にし、「どう使うか」を1行で聞いて `note` にそのまま書く。
  - コマンドで画像を作れるなら `cmd: <コマンド>` の形で書いてもらう（`{prompt}` `{out}` `{refs}` が置き換わる）。例: `cmd: mytool gen --prompt {prompt} -o {out}`。
  - それ以外は言葉で書く。例: 「MCP の xxx の画像生成を使う」「Udio で作って wav を置く」。
- 使い方が分からない・決められないときは `manual`（music / image）か `none`（video / notify）を勧める。あとで `setup` から変えられると伝える。
- `manual` は「AI がプロンプトや文章を渡し、人が作って置く」。`none` は「その工程を飛ばす」。

Q8 の聞き方:
- 選択肢を並べて見せる（複数選べる）:
  | 値 | 意味 | リリース準備で作るもの |
  |---|---|---|
  | `youtube` | YouTube に MV を出す | 説明文・タグ・サムネ |
  | `dsp` | 配信サービス（Spotify・Apple Music など）にディストリビューター経由で出す | 曲情報・3000×3000 のジャケット |
  | `other` | それ以外（SoundCloud・自分のサイトなど）。どこかを1行で聞き、`note` に書く | ジャケット・チェックリスト |
  | `none` | リリースしない（作って手元に置く）。単独で選ぶ | 何も作らない |
- `dsp` を選んだら Q8-2 を聞く。分からなければ「未定」にし、リリース準備で聞き直す。

- 立ち絵があれば `profile/images/character.png` に置く。PNG 以外は変換する:
  ```bash
  mkdir -p profile/images
  cp "<受け取ったパス>" profile/images/character.png          # PNG のとき
  ffmpeg -y -i "<受け取ったパス>" profile/images/character.png  # それ以外
  ```
  置いたら Read で観て、取り違えていないか利用者に確認する。
- 選んだサービスの準備を案内する（入れる前に了承を取る）:
  | 選んだもの | 準備 |
  |---|---|
  | music=`suno` | アカウントが無ければ、作曲工程の前に作っておくよう伝える（セットアップは続けてよい） |
  | image=`codex` | `npm install -g @openai/codex` のあと、利用者に `codex login` を実行してもらう |
  | image=`other`（`cmd:`） | そのコマンドが入っているかを `command -v` で確かめる。試しに生成はしない |
  | video=`kling-mcp` | 使っている AI（Claude Code / Codex）に Kling MCP をつないでもらう。つなぎ方は Kling の案内に従う |
  | notify=`slack` | `cp .env.example .env` を実行し、トークンとチャンネル ID は利用者が自分で `.env` に書く（チャットに貼ってもらわない） |
- セットアップ中に外部サービスで生成・送信を試さない。

## 3. 書いて、見せて、確認する
- `profile/` を作り、`profile.example/` と同じ見出しで書く:
  - sound.md（Q1）/ world.md（Q2）/ character.md（Q3。いない場合は「キャラクターなし」と書く）/ lyrics.md（Q4）/ ledger.md（`profile.example/` の空の表をそのまま）
- `workflow.config.json` を `workflow.config.example.json` から作り、値を入れる。`mastering.preset` に Q6 の答えを入れ、数値もその行に合わせる:
  | preset | integratedLufs | truePeakCeiling | profile |
  |---|---|---|---|
  | streaming | -14 | -1.0 | flat |
  | loud | -9.5 | -1.5 | neutral |
  （`lufsTolerance` 0.5・`sampleRate` 48000・`bitDepth` 24 はそのまま）
- `providers` に Q7 の答えを書く（各用途 `{ "use": "<値>", "note": "<other のときの使い方>" }`）。古い `tools` の行は消す。
- `release` に Q8 の答えを書く（`{ "targets": ["youtube", "dsp"], "note": "<other のときの先>" }`）。
- 書いたら `node engine/config.js providers` と `node engine/config.js release` で読めることを確かめる（JSON の誤りや選べない値はここで止まる）。
- 全ファイルの中身を利用者に見せ、「このままでよいか／直したい所」を聞く。OK が出るまで直す。

## 4. CLAUDE.md の人格節を埋める（キャラがいる場合）
- `CLAUDE.md` の `<!-- persona:start -->` と `<!-- persona:end -->` の間だけを書き換える（名前・一人称・口調・相手の呼び方・やらないこと）。それ以外の行は触らない。
- キャラがいない場合は触らない（AI は普段の口調で話す）。
- 書いた節を利用者に見せて確認する。

## 5. 完了の案内
次の内容を短く伝える:
- 書いたファイルの一覧（profile/ と workflow.config.json）。
- 「新曲を作りたい」と言えば、企画 → 作詞 → 作曲 → マスタリング → MV → リリース準備 の順に始まる。
- 人の番は4回: 企画案を選ぶ／音源を作って置く／MV を見て OK を出す／アップロードする（画像が `manual` なら画像を置くのも人の番。リリース先が `none` ならアップロードは無い）。
- 設定を変えたくなったら「セットアップをやり直したい」「キャラを変えたい」と言えばよい。
