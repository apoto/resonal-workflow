# shape-burst（跳ね出現＋図形バースト）

## 見た目
画面中央に極太ゴシックの歌詞が1文字ずつ下から跳ねて出て、サビでは1文字ごとに □○△◇✕ の線画がはじける。1フレーズ＝1画面のハードカット。
背景は多層パララックス（遠景プレート／中景の雲／キャラ／前景の綿）を1つのカメラで動かす。キャラは片側に寄せて中央を歌詞に空け、表情差分や微動ループ連番をセクションで切り替える。既定の配色は高明度パステル × 濃いインク。

## 向く曲
フォンク、ハードな電子・トラップ、ドラムンベースなど速い縦ノリ。クール挑発・煽り・「甘い見た目に硬い中身」のような落差のある歌詞。

## 元になった RESONAL の公開曲
Cotton Overkill

## 使い方
1. `npm install`
2. `public/` に置く（ファイルは同梱しない）:
   - `public/audio.wav` … マスター音源
   - `public/bg.png` / `public/bg_vertical.png` … 背景（`tools/03b_prep_cover.sh <cover> public` でカバー画像から作れる）。サムネにも使う
   - `public/bg_far.png` … 遠景プレート（任意・フレームより大きい画。無ければ bg.png）
   - `public/plates/char_base.png` … キャラの透過PNG（必須）。表情差分は `char_downcast` `char_sideglance` `char_fang` `char_closed`、顔アップ用は `char_closeup`（`tools/pad_headroom.py` で頭上に余白を足す）
   - `public/char_seq/001.png〜`（`char_seq_<表情>/` も可）… キャラの微動ループ連番（任意）
   - 置いたら `tools/sync_plates.sh` で `input/lyrics.json` の meta に配線する（実在するものだけ載る）
3. 書き換える:
   - `input/project.json` … `title`（サムネ）と `credits`。公開版の `workflow.config.json` の `credits` をここに写す
   - `input/lyrics.json` … `phrases`（`t`/`hold` 秒・`size`・`tilt`・`drop`/`english`/`cold`）。`tools/06_build_lyrics.py` の表を書き換えて実行すると生成できる（`--words <whisper JSON>` で word オンセットへ吸着・行幅からサイズ自動計算・重なり検査）。手で直した後の重なりは `tools/fix_overlaps.py`
   - `input/energy.json` … `python3 tools/02_energy.py public/audio.wav input/energy.json`（同梱はダミー）
   - `src/song.ts` … セクション境界の秒・ショート区間・クレジットを出す秒。構図／表情／雲のキュー表は `src/Stage.tsx`
   - 再着色 … `src/ShapeBurst.tsx` 冒頭の `PAL`
4. `npx remotion studio` でプレビュー → `npx remotion render LyricVideo out/main.mp4`（または `tools/04_render.sh` で本編・ショート・サムネ・720p を `out/` へ → `tools/07_verify.sh` でデコード検査）

tools: `01_transcribe.sh`（whisper）/ `02_energy.py` / `02_estimate_beats.py`（BPM 推定）/ `03b_prep_cover.sh` / `04_render.sh` / `06_build_lyrics.py` / `07_verify.sh` / `sync_plates.sh` / `pad_headroom.py` / `fix_overlaps.py`

### templates/mv との違い
- `tools/make_mv.sh` には乗らない。手順は上を手で回す。
- lyrics.json のスキーマが違う（`lines` ではなく `phrases`）。templates/mv の 01 が作る `transcribe/audio_16k.json` はそのまま `06_build_lyrics.py --words` に渡せるが、文言の表は手で書く（LYRICS.md からの自動変換は無い）。
- `input/energy.json` の形は templates/mv と同じ（`{fps, frames, sec, hit}`）なので、どちらの 02 で作ってもよい。
- キャラは切り抜き1枚ではなく、表情差分・連番を自分で用意する前提。前景の自動切り抜きは無い。
- 振り付け（構図・表情・雲）は自動判定ではなく `src/song.ts` と `src/Stage.tsx` に手で書く。

## 注意（発展途上・そのまま共有）
1曲の制作で使った実装をほぼそのまま出している（曲の歌詞・秒・素材名をダミーに置換し、クレジットを `input/project.json` から読むようにしただけ）。
`src/types.ts` は invert-shapes と共通のスキーマから拡張した名残で、型名や未使用フィールド（`reveal` / `shapes` / `bgVideo`）が残っている。
確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。サポートなし。
