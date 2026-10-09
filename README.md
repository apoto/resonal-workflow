# resonal-workflow（v1）

**English summary:** A conversational workflow for making songs with an AI vocal, driven by Claude Code (the only agent it has been tested with; other agents such as Codex may work if you first ask them to adapt the repository). Ask the agent to clone this repository and set it up; it checks your tools, interviews you about the music, world and character you want, and writes your profile. From then on, saying "I want to make a new song" walks you through six steps — planning, lyrics, composing (you generate the track in Suno or a service of your choice), automatic ffmpeg mastering, a lyric music video rendered with Remotion, and release preparation (you do the uploads). A small engine (`./next.sh`) looks at the song folder and returns exactly one next task, and the agent stops whenever it is your turn to decide. External paid services (music, image, video, notification) are recommended but configurable in `workflow.config.json`. Documentation is in Japanese; a free guide book (Japanese) is on [Zenn](https://zenn.dev/apoto/books/resonal-pipeline). This is v1 (October 2026) and is not planned to be updated except for critical bugs. Provided as-is; questions and requests are welcome on X ([@apopotoapoto](https://x.com/apopotoapoto)).

---

AIボーカルの曲を、企画からリリース準備までAIと対話しながら作るためのワークフローです。書籍『RESONALの1曲ができるまで』で紹介している制作環境を、誰の音楽にも使えるように整理して公開しています。使い方は、書籍で初めての方にも分かるように説明しています。

- 書籍（Zenn Book・無料）：https://zenn.dev/apoto/books/resonal-pipeline

## 目次

- [考え方](#考え方)
- [はじめ方](#はじめ方)
- [セットアップで聞かれること](#セットアップで聞かれること)
- [1曲の流れ](#1曲の流れ)
- [MVの見せ方（テンプレートから作り変える）](#mvの見せ方テンプレートから作り変える)
- [安心して使うために](#安心して使うために)
- [必要なもの](#必要なもの)
- [使う外部サービスと置き換え](#使う外部サービスと置き換え)
- [フォルダ構成](#フォルダ構成)
- [ライセンス](#ライセンス)
- [サポート](#サポート)
- [書籍](#書籍)

## 考え方

AIは実作業を行い、判断は人間が行います。企画の案・歌詞・マスタリング・ミュージックビデオ（MV）の初稿まではAIが作り、そこから先は人間が確認し、選び、指示を出して良くしていきます。

このワークフローは人間を減らすためのものではありません。手を動かす部分をAIに任せ、人間が「何を作るか」「どれが良いか」の判断に集中できるようにするためのものです。そのため、人間の判断が要る場面ではAIが必ず止まり、何をしてほしいかを具体的に伝えます。

## はじめ方

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) を開き、こう頼むだけです。

```
https://github.com/apoto/resonal-workflow
このリンク先のワークフローを使って、AI と一緒に曲を作りたいです。
手元に取り込んで、セットアップから始めてください。分からないことは質問してください。
```

Codexなどほかのエージェントで使う場合は、動作を確認していないので、最初に「このワークフローは Claude Code 向けに書かれています。あなたが使いやすい形に整えてから、セットアップを始めてください」と頼んでください。

以降は対話で進みます。AIが道具の確認と導入（入れる前に確認を取ります）、ヒアリング、設定ファイルの作成までを一緒に行います。

セットアップが終わったら、次のように話しかけると1曲目が始まります。

```
新曲を作りたい
```

### 困ったときに話しかけること

| こんなとき | 話しかける言葉 |
|---|---|
| いまどこまで進んだか知りたい | 「いまどこまで進んだ？」 |
| 前回の続きをやりたい | 「この曲の続きをやって」 |
| 設定を変えたい（キャラ・音楽の傾向など） | 「セットアップをやり直したい」 |
| 自分の歌や楽器を入れたい | 「歌は自分で歌いたい」 |

## セットアップで聞かれること

1問ずつ、例を添えて聞かれます。分からない項目は「あとで決める」で先に進めます。

1. 作りたい音楽の傾向（ジャンル・ムード・テンポ感）
2. テーマ・世界観（曲で表現したいこと）
3. 歌い手・キャラクター（名前・一人称・性格・見た目。立ち絵の画像があれば置き場所）と、歌声のイメージ
4. 歌詞の言語と作風のこだわり（任意）
5. ユニット名とクレジットの表記
6. 音の大きさと音色（`streaming`＝一般的な曲・配信の基準音量で元の音色のまま／`loud`＝EDM・音ゲー系・音圧強めで派手め）
7. 使う外部サービス（音源・画像・動画素材・通知。推奨を示して選んでもらいます → [使う外部サービスと置き換え](#使う外部サービスと置き換え)）
8. どこにリリースするか（YouTube／配信サービス／その他／リリースしない。複数選べます。配信サービスに出す場合は作詞・作曲の名義も）

答えは `profile/`（音楽の傾向・世界観・キャラクター・歌詞・作った曲の一覧）と `workflow.config.json` に書かれ、内容を確認してから確定します。記入例は [`profile.example/`](profile.example/) にあります。キャラクターがいる場合は、AIがそのキャラクターの口調で話すように `CLAUDE.md` の人格の節も書かれます。

## 1曲の流れ

「新曲を作りたい」と言うと、`./next.sh` が曲フォルダの中身を見て「次にやること」を1件だけ返し、AIはその1件をやってはまた `./next.sh` を確かめる、を繰り返します。

| # | 工程 | AIがやること | あなたがやること |
|---|---|---|---|
| 1 | 企画 | 直近の曲と被らない案を2〜3本出し、選ばれた案で `BRIEF.md` を書く | **案を選ぶ** |
| 2 | 作詞 | 物語を書いてから削って歌詞にし、3つの視点で改稿して `LYRICS.md` を書く | — |
| 3 | 作曲 | 音源の生成に貼る文章（Style・Lyrics・Exclude）とカバー画像を用意する | **Sunoなどで生成し、気に入ったテイクのWAVを置く** |
| 4 | マスタリング | ffmpegで目標の音量に整え、数値の意味を添えてレポートする | — |
| 5 | MV | 歌詞が出るMV（16:9本編・9:16ショート・サムネ）を作り、指摘に沿って直す（背景のループ動画は任意） | **見てOKを出す**（直しは何度でも） |
| 6 | リリース準備 | セットアップで選んだリリース先の分だけ、ジャケット・YouTubeの説明文とタグ・配信サービス用の曲情報・チェックリストを用意する（リリースしない設定なら何もしない） | **アップロードする** |

成果物はすべて `songs/<YYMMDD>_<Title>/` に入ります。途中でやめても、`./next.sh --list` で作りかけの曲が分かり、続きから再開できます。

## MVの見せ方（テンプレートから作り変える）

既定のMVは `tools/make_mv.sh` が1つの型（`spectrum-still`：1枚絵をカメラ割で見せ、七色の光と弾む字幕を乗せる）で作ります。この型は**出発点**です。見せ方はここから自由に作り変えられます。

作り変えるときは、こうしたいことを言葉でAIに伝えます。

```
サビの頭で解放感を出したい
Aメロはカメラをゆっくり引いて、サビで歌詞を画面いっぱいに
```

AIは、伝えられたことを次の2つに置き換えて、区間ごとの演出表（`DIRECTION.md`）に書き、曲のプロジェクト（`templates/mv` から作ったもの）を書き換えます。あなたがこの2つを覚えて選ぶ必要はありません。

- **18の軸**: MVで決める項目の一覧です（18通りの見せ方という意味ではありません）。歌詞6（配置・書体・出入りなど）・キャラ6（素材・動き・構図など）・背景4（素材・切り替え・画面エフェクト・カメラ）・打点2に分けています。言われていない軸は、AIが曲と画から決めて理由を書きます。
- **演出の辞書**: 各軸に入れる選択肢の中身で、`direction-library/` に演出73件と場面19件（計92件）が入っています。演出はカメラ・編集・光と色・エフェクト・文字・構図・動き・UIに分け、場面は水中や雨の街のような場所ごとに光と演出の組み合わせをまとめています。1件ごとに、何が起きるか・なぜ効くか・数値・合う感情とタイミング・相性・品質チェックを書いています。

辞書を自分で眺めて選びたいときは「演出の辞書から候補を出して」と頼めます。直すときは「この曲だけ」か「次の曲からも」かを添えると、AIが直す場所（曲のプロジェクト／テンプレート・スタイル）を選べます。

この作り方はMVに限りません。どんな映像を作るときにも使い回せます。RESONALのMVはその一例です。

### RESONALの13のスタイル（そのまま使える）

RESONALで実際に使ってきた見せ方を13のスタイルにまとめ、`styles/` に共有しています。そのまま使って構いません。MVの工程で次のように話しかけると、AIが曲の雰囲気（静か・明るい・暗い・壮大など）と歌詞から全スタイルを1行ずつ比べた選定表を書き、候補を示します。選ぶのはあなたです。

```
MV の見せ方を選びたい
```

| スタイル | ひとことで | 向く雰囲気 |
|---|---|---|
| scatter-mincho | 散らした白い明朝＋デジタル崩壊 | 暗い・攻撃的・焦燥 |
| ring-visualizer（-loop） | 中央の被写体を囲むネオンの円形波形（歌詞なし） | 浮遊・夜・インスト |
| white-cut | 白地の真ん中に黒い明朝をハードカット | 静か・洗練・切ない |
| photocopy-zine | コピー機のザラつきとコラージュ | 明るいのに毒がある・疾走 |
| pink-bounce | ピンクの高キーに丸文字とデコ | 明るい・かわいい |
| crimson-gothic | 黒×赤のゴシック、明朝＋セリフ | 暗い・妖艶・不穏 |
| shape-burst | 1文字ずつ跳ねて出る文字と図形のバースト | クール・挑発・ノリが強い |
| invert-shapes | 白い図形に重なった文字だけ反転 | 暗い・攻撃的 |
| sky-keyvisual | 1枚のキービジュアル＋モーショングラフィックス | 明るい・爽快・疾走 |
| burn-in | 黒地に補色の残像が焼きつく | 切ない・壮大 |
| lowpoly-corridor | 3Dの世界をカメラが駆け、キャラが立つ | 壮大・暗い・荘厳 |
| plate-swap | 背景の面を小節で切り替え、静止画のキャラと刷り出す文字 | 夜・クール・静かな熱 |
| portrait-frame | 動かない立ち絵、切り替わる背景動画、縦書きの積み上げ | 静か・壮大・叙情 |

18の軸の決め方（`mv-styles`）のほか、キャラの静止画を拍で跳ねさせる・関節で動かす部品、カット割りの手順も入っています（`.claude/skills/` の `mv-styles` / `bounce-rig` / `puppet-rig` / `mv-cut-editing`）。

- スタイルは発展途上です。スタイルごとに手順や作りが揃っておらず、既定の型より手間がかかります。縦ショートやサムネの有無、歌詞の読み込み方もスタイルによって違います。手順は各 `styles/<名前>/README.md` にあります。
- キャラクターや背景の画像は同梱していません。自分の立ち絵やカバー画像で試してください。

### 自分の表現を足す・ワークフローを作り変える

使っていて物足りなくなったら、同じ型に合わせて自分の表現を足せます。手順はskillに書いてあるので、AIに頼めば進められます。

- 新しいスタイルを `styles/` に足す・既存のスタイルを改変する（`mv-styles` の「スタイルを足す・改変する」）
- 演出の辞書に新しい演出を1件足す・数値を自分の実測で直す（`direction-library/README.md`）

```
いまの MV をもとに、新しいスタイルとして styles/ に足して
```

MITライセンスなので、ワークフロー自体を作り変えて、まったく新しい形にしても構いません。

## 安心して使うために

このワークフローは、あなたのパソコンの中で動きます。使い方や作った曲、入力した情報が、作者（apoto）に送られることはありません。

外とやり取りするのは、あなたが選んだサービスに頼むときです。音源・画像・動画の生成サービスには作りたいものの説明や参照する画像が、Slackを使う場合はできたMVが送られます。AI（Claude Codeなど）とのやり取りは、それぞれのサービスの規約に沿って扱われます。

手元には、Slackの接続用のトークン（`.env`）と、セットアップで答えた名前などの設定（`profile/`・`workflow.config.json`）が保存されます。これらは最初から `.gitignore` に入っていて、GitHubなどには上がりません。AIにWeb検索や別のツールで調べ物をさせるときは、トークンや個人情報が検索の文や外部のツールに渡らないようにしてください。トークンは、チャットに貼らずに `.env` に直接書いてください。

## 必要なもの

### 必須

- macOS（Windowsでは動作を確認していません）
- Node.js 20以上
- Python 3.10以上
- ffmpeg（ffprobeを含む）
- [openai-whisper](https://github.com/openai/whisper)（歌詞の表示タイミングを取るのに使います。CPUだと曲の長さの数倍かかることがあります）
- 音源を生成するサービス（推奨はSuno。音源はあなたが生成します）
- Claude Code（Claudeのアカウントで使えます。ブラウザのチャットではパソコンの中のファイルを扱えないため動きません）
  - Codexなどほかのエージェントでも使えるかもしれませんが、動作は確認していません。

### 任意

どれを使うかは、次の節の `providers` で選びます。

- [codex CLI](https://github.com/openai/codex)（カバー画像の生成。使わない場合はプロンプトを受け取って自分で用意します）
- Kling MCP（MVの背景を動かすループ動画を作るとき）
- Slack（MVなどの成果物を自分のチャンネルで受け取るとき）

足りないものはセットアップのときに `tools/check_env.sh` で確かめ、入れ方を案内します。

## 使う外部サービスと置き換え

課金が必要になりうる外部サービスは、用途ごとに `workflow.config.json` の `providers` で選びます。下の推奨は一例で、推奨以外のサービスや手作業にも置き換えられます。セットアップで聞かれるほか、あとから「画像生成を別のサービスにしたい」と頼めば変えられます。

```json
"providers": {
  "music":  { "use": "suno",  "note": "" },
  "image":  { "use": "codex", "note": "" },
  "video":  { "use": "none",  "note": "" },
  "notify": { "use": "none",  "note": "" }
}
```

| 用途 | 推奨 | 選べる値 | 使われる場面 |
|---|---|---|---|
| `music` 音源 | Suno（`suno`） | `suno` / `other` / `manual` | 作曲。どれを選んでも生成はあなたが行い、WAVを置きます |
| `image` 画像 | codex CLI（`codex`） | `codex` / `other` / `manual` | カバー画像（ジャケット・サムネの元）。窓口は `tools/gen_image.sh` |
| `video` 動画素材 | Kling MCP（`kling-mcp`） | `kling-mcp` / `other` / `none` | MVの背景ループ動画（任意）。`none` なら背景はカバーの静止画 |
| `notify` 通知 | Slack（`slack`・任意） | `slack` / `none` | できたMVを自分のチャンネルに送る |

- `other`: `note` に使い方を書きます。AIはその内容に従います。たとえば次のように書きます。
  - `"cmd: mytool gen --prompt {prompt} -o {out}"`（画像。`{prompt}` `{out}` `{refs}` が置き換わり、`tools/gen_image.sh` が実行します）
  - `"MCP の xxx の画像生成を使う"`（AIがそのMCPで作ります）
  - `"Udio で作って wav を置く"`（音源）
- `manual`: あなたが自分で用意します。AIはプロンプトや文章を渡して待ちます。
- `none`: その工程を飛ばします。
- 生成や送信の前に、AIはあなたに確認を取ります。失敗しても自動で再実行しません。
- 料金と利用条件はサービスごとに異なり、変わることがあります。使う前に各サービスの料金ページと規約を確認してください。
- 古い形式（`"tools": { "suno": true, "codex": false, ... }`）の設定もそのまま読めます（`providers` に読み替えます）。

## フォルダ構成

```
resonal-workflow/
├── CLAUDE.md / AGENTS.md      AI の振る舞い（AGENTS.md は CLAUDE.md への symlink）
├── next.sh                    いまの工程と次の1手を返す
├── workflow.config.example.json → workflow.config.json（セットアップが作る）
├── profile.example/           profile/ の記入例（架空のユニット）
├── .claude/skills/            工程ごとの手順（setup / new-song / planning / lyric-writing /
│                              composing / mastering / music-video / release-prep、
│                              MV を凝るとき: mv-styles / bounce-rig / puppet-rig / mv-cut-editing）
├── engine/                    工程の判定（Node.js・依存なし）
├── tools/                     道具の確認・MV 作成・画像生成の窓口・リリース準備・Slack 送信
├── mastering/                 自動マスタリング（auto_master.py）
├── templates/mv/              MV のテンプレート（Remotion・既定の型）
├── styles/                    MV の見せ方 13スタイル（任意。足す・改変するのも自由）
├── direction-library/         演出の辞書（演出73件＋場面19件。AI が軸の選択肢として使う）
├── songs/                     曲フォルダ（git 管理外）
└── projects/                  曲ごとの MV プロジェクト（git 管理外）
```

## ライセンス

- このリポジトリのコードとドキュメントは [MIT License](LICENSE) です。
- 「RESONAL」の名称と、RESONALのキャラクターはライセンスの対象外です。
- MVテンプレートが使う [Remotion](https://www.remotion.dev/) は、企業の規模によっては有料のライセンスが必要です。利用前に [Remotionのライセンス](https://www.remotion.dev/license) を確認してください。
- [matchering](https://github.com/sergree/matchering) はGPL-3.0のため同梱していません。使う場合は各自でインストールしてください。
- Suno・Kling・codexなどで生成したものの権利と利用条件は、各サービスの規約に従ってください。

## サポート

2026年10月時点の v1 を、この形のまま置いておきます。まったく動かないような不具合には、対応するかもしれません。

現状のまま（as-is）の提供です。うまく動かないところや分かりにくいところ、要望があれば、X（[@apopotoapoto](https://x.com/apopotoapoto)）で気軽に声をかけてください。IssueやPull Requestへの対応は約束できません。

## 書籍

このワークフローの設計と、各工程で何をしているかは書籍で詳しく説明しています。

- [RESONALの1曲ができるまで — Claude Codeで音楽ユニットを回すワークフロー（Zenn Book）](https://zenn.dev/apoto/books/resonal-pipeline)

書籍はRESONALで実際に使っている環境を説明しています。このリポジトリはそれを単純にして公開したものなので、スクリプトの名前や工程の数は書籍と一部異なります。

---

© 2026 apoto / RESONAL
