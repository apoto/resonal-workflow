---
name: mastering
description: 生成音源 audio.wav を配信用のマスター <Title>.wav にする。mastering/auto_master.py を回し、MASTER-REPORT.md の数値を利用者に1行ずつ説明する。目標の音量は workflow.config.json の mastering。「マスタリングして」「音圧」「音量をそろえて」「LUFS」「True Peak」「こもる／明るくしたい」と言われたとき、または new-song のマスタリング工程で使う。
---

# マスタリング（audio.wav → <Title>.wav）

1曲＝1マスター。MV も配信も同じ `<Title>.wav` を使う。

## 前提
- 目標値は `workflow.config.json` の `mastering`（`streaming` か `loud`）。数値をほかのファイルに書き写さない。
- オプションの詳細は `mastering/README.md`。

## 手順

### 1. 回す
```bash
python3 mastering/auto_master.py "songs/<曲フォルダ>/audio.wav" --promote
```
- 判定が PASS のときだけ `<Title>.wav` ができる。exit 非0 なら出力のエラーを読む。
- 終了コードを信じず、`<Title>.wav` と MASTER-REPORT.md があることを `ls -la` で確かめる。

### 2. レポートを見せる
MASTER-REPORT.md の数値を表にし、各行に意味を1行添えて利用者に見せる:

| 項目 | 意味 |
|---|---|
| Integrated（LUFS） | 曲全体の平均の大きさ。多くの配信サービスは -14 LUFS 前後に揃えて再生する（Apple Music は -16 前後） |
| True Peak（dBTP） | 一番大きい瞬間の高さ。0 dBTP を超えると、再生機器や AAC・MP3 への変換で音が割れる。余裕を取って目標以下にする |
| LRA（LU） | 静かな所と大きな所の差。小さすぎると潰れて平坦、大きすぎると音量がばらつく |
| サンプルレート / ビット深度 | 書き出しの形式（既定 48000Hz / 24bit） |
| 判定 | 上の数値が目標の範囲に入っているか |

- 最後に「聴いてみて、こもる・刺さる・低音が重いなど気になる所があれば教えてください」と1行添える（聴くかどうかは利用者が決める）。

### 3. 直すとき
利用者の感想を帯域の調整に置き換えて作り直す。既にマスターがあるので `--force` を付ける。
音色の既定は `workflow.config.json` の `mastering.profile`（streaming＝`flat`：EQ なし／loud＝`neutral`：EDM 向けの派手めのカーブ）。
| 感想 | 試すこと |
|---|---|
| こもる・暗い | `--shelf7k 1.5 --air 0.5`（高域を少し上げる） |
| 高音が刺さる | `--harsh -2`（8.5k を下げる） |
| 低音が足りない | `--low 1.5`（100Hz を上げる） |
| 箱鳴り・中域がこもる | `--scoop -1.5`（550Hz を下げる） |
| EDM・音ゲーのように派手にしたい | `--profile neutral`（明るい源は `bright`・暗い源は `dark`・808 やサブベースが主役なら `sub-driven`） |

```bash
python3 mastering/auto_master.py "songs/<曲フォルダ>/audio.wav" <上の表のオプション> --promote --force
```
- 直したら手順 2 をもう一度行い、前回との差を1行で伝える。

### 4. `./next.sh` を実行する

## 規則
- 音源の長さを編集しない（イントロ・アウトロ・末尾の余韻を切らない）。
- 入力は audio.wav（未マスター）。マスター済みの WAV にもう一度かけない。
- 音圧を上げることを目的にしない。目標の範囲に収め、音のバランスを整える。
- DAW など別の方法でマスタリングした場合も、`songs/<曲フォルダ>/<Title>.wav` に置き、目標値に収まっていることを `./next.sh` で確かめる。
