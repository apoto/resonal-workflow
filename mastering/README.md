# mastering — 自動マスタリング（ffmpegだけ）

生成音源 `audio.wav` から配信用マスター `<Title>.wav` を作り、実測で合否を出す。
目標値を書くのは **`workflow.config.json` の `mastering`** だけ（コードに数値は書いていない）。

```bash
python3 mastering/auto_master.py "songs/<曲>/audio.wav" --promote                  # PASS なら <Title>.wav に昇格
python3 mastering/auto_master.py "songs/<曲>/audio.wav" --profile dark --promote  # 源が暗い/こもる曲
```

`<Title>` は `song.json` の `title`。出力は候補 `<Title>_automaster.wav` と実測レポート `MASTER-REPORT.md`（`--promote` でPASSなら候補が `<Title>.wav` に置き換わる）。
`--promote` を付けると判定PASSのときだけ候補を `<Title>.wav` に置き換える（既にあるなら `--force`）。

## 目標値（preset）

| preset | Integrated | True Peak | 音色（profile） | 向き |
|---|---|---|---|---|
| `streaming`（既定） | -14 LUFS | -1.0 dBTP | `flat`（EQなし） | 一般的な曲。配信サービスの基準音量で、ダイナミクスと元の音色が残る |
| `loud` | -9.5 LUFS | -1.5 dBTP | `neutral`（低域と高域を持ち上げる） | 音圧と派手さを出したいEDM・音ゲー系 |

`mastering.preset` を選ぶと数値と音色はここから入る。`integratedLufs` / `truePeakCeiling` / `profile` を直接書けばそちらが優先。
合格窓は `lufsTolerance`（±0.5）、出力形式は `sampleRate` / `bitDepth`（48000 / 24）。

## やること

1. **トーン整形** — profileのEQを当てる（HPF 28Hz → 100Hzローシェルフ → 550Hz箱鳴りを削る → 3.3k → 7kハイシェルフ → 8.5k刺さり抑え → 12k air）。`flat` は28Hzより下を切るだけで音色を変えない
2. **着地** — ゲイン＋リミッターを反復してIntegratedとTrue Peakを目標へ。リミッターは4倍オーバーサンプリング（等倍だとサンプル間のピークでTPが漏れる）
3. **判定** — True Peak・Integratedの窓・SR/bit・LRA（潰しすぎ）・Flat factor（クリップ）。NGならexit 1

入力が既にマスター済みに見える（大きすぎる）ときは止まる（二重マスターで潰れるため。意図的なら `--force`）。

## オプション

- `--profile flat | bright | neutral | sub-driven | dark` — 音色（既定はconfigの `mastering.profile`）。`bright` / `neutral` / `sub-driven` / `dark` はEDMの手作業マスターから作った派手めのカーブで、源の明るさ・低域量で選ぶ
- `--low / --scoop / --presence / --shelf7k / --harsh / --air <dB>` — 帯域ごとの上書き（`flat` に少しだけ足すときもこれ）
- `--exciter` — 高域Exciter（既定OFF）
- `--engine matchering --ref <wav>` — 参考曲へ全帯域で寄せる。[matchering](https://github.com/sergree/matchering) はGPL-3.0のため同梱しない（`python3 -m pip install matchering`、別venvなら `MATCHERING_PYTHON=/path/to/python`）

## やらないこと

- 尺の編集 — 生成された音源の尺が正
- 最後の可否 — 耳で決める。数値がPASSでも違和感があればprofileを変える

依存: ffmpeg / ffprobe / node（設定の読み取り）/ python3（標準ライブラリのみ）。
