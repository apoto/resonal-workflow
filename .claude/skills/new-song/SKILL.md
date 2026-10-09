---
name: new-song
description: 新曲を1曲、企画からリリース準備まで進める入口。`./next.sh` が返す1件だけをやって再実行する、を6工程（企画・作詞・作曲・マスタリング・MV・リリース準備）が終わるまで繰り返す。「新曲作成」「新曲を作りたい」「曲を作って」「次の曲」「この曲の続きをやって」「いまどこまで進んだ？」と言われたとき、作りかけの曲を再開するときに使う。
---

# 新曲作成（入口）

このスキルの仕事は「いま何をやるか」を `./next.sh` に聞いて、その1件だけをやること。各工程の中身は工程の skill に任せる。

## 始める前
- `profile/` と `workflow.config.json` が無ければ、先に skill `setup` を行う。

## ループ（これが全部）
```bash
./next.sh --new                 # 新曲を始める（直近の曲を出して企画へ）
./next.sh "<曲フォルダ名>"        # 曲の現在地と次の1手（タイトルでも可）
./next.sh --list                # 作りかけの曲と現在地の一覧（再開するとき）
```
1. `./next.sh` を実行する（新曲は `--new`、再開は `--list` で曲を確かめてから曲名を付ける）。
2. 返ってきた1件だけをやる。先の工程に手を付けない。
3. もう一度 `./next.sh` を実行する。
4. 終了コードで動きを決める:
   | exit | 意味 | 動き |
   |---|---|---|
   | 0 | 全部完了 | 完了を伝える。0 を見るまで「完成」と言わない |
   | 1 | AI の作業あり | 該当工程の skill でやる → 1 に戻る |
   | 3 | 人の番 | 下の「人の番」の文面で依頼して止まる。実行し続けない |
   | 2 | 引数の誤り | 出力のとおり曲名を直す（`--list` で確かめる） |

## 6工程と担当 skill
| # | 工程 | skill | 成果物（`songs/<曲フォルダ>/`） | 人の番 |
|---|---|---|---|---|
| 1 | 企画 | `planning` | BRIEF.md | 案を選ぶ |
| 2 | 作詞 | `lyric-writing` | LYRICS.md | — |
| 3 | 作曲 | `composing` | suno_style.txt・suno_lyrics.txt・suno_exclude.txt・cover.png・audio.wav | 音源を作って wav を置く（画像が `manual` なら cover.png も） |
| 4 | マスタリング | `mastering` | `<Title>.wav`・MASTER-REPORT.md | — |
| 5 | MV | `music-video` | （任意で bg_loop.mp4）・`<Title>.mp4`・`<Title> (Short).mp4`・thumbnail.jpg | 見て OK を出す |
| 6 | リリース準備 | `release-prep` | release/ 一式 | アップロード |

## 人の番の伝え方
何を・どこで・どうしたら次に進むかを箇条書きで具体的に書いて止まる。
使うサービスは `workflow.config.json` の `providers`（`node engine/config.js providers`）。サービス名はそこから取り、決め打ちしない。

- **案を選ぶ**: 「案A / 案B / 案C のどれにしますか。混ぜたい点や変えたい点があればそれも」。
- **音源を作る**: providers.music が `suno` なら Suno、`other` なら `note` のサービス、`manual` なら利用者の方法で。貼るファイル3つのパス、タイトル欄に入れる曲名、「気に入ったテイクを WAV で `songs/<曲フォルダ>/audio.wav` に置いたら『置いた』と言ってください」。詳しい文面は skill `composing`。
- **カバー画像を置く**（providers.image が `manual` のとき）: `cover_prompt.txt` の中身と置き場所 `songs/<曲フォルダ>/cover.png`（横長）。
- **MV を見る**: 本編・ショート・サムネのパスを並べ、「OK か、直したい点（歌詞のタイミング・文字の大きさ・色など）を教えてください」。
- **アップロード**: `songs/<曲フォルダ>/release/UPLOAD-CHECKLIST.md` を一緒に上から確認し、アップロードは利用者が行う。

## 規則
- 外部サービス（音源・画像・動画の生成、通知）は providers で選ばれたものだけを使う。`other` は `note` に従い、書かれていないことは利用者に聞く。
- 1回の応答で複数工程を進めない。工程の順番を自分で決めない（`./next.sh` が決める）。
- 判定に落ちたら `./next.sh` の出力に書かれた理由を読み、その工程の skill で直す。
- 利用者が会話で「次の曲はこうしたい」と言ったら profile/ledger.md の表の下に `- メモ: <内容>` で残す（次の企画で読む）。
