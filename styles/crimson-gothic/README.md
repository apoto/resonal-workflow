# crimson-gothic（黒×赤の退廃ゴシック・明朝＋セリフ）

暗い背景画像の上に、和文は明朝（Noto Serif JP）、英字は高コントラストのセリフ（Playfair Display）で歌詞を出す。
4つの出し方を行ごとに選ぶ: `edge`（左右端の縦書き・静）/ `centerChar`（中央に巨大な1文字）/ `centerBig`（中央に巨大＋色収差）/ `build`（外側の文字から中央で単語が組み上がる）。
拍でハードカットし、キメの行だけ横波の液状グリッチ。white-cut のダーク版。本編 `LyricVideo`（16:9）と縦ショート `ShortVideo`（9:16）。

**向く曲:** 暗く退廃的・ゴシック・妖艶・不穏な中〜速テンポ。嘘・毒・死・支配のような歌詞。

**元になった RESONAL の曲:** Cold Read（黒×シアンに再着色して使用）

## 使い方

1. `public/` に置く
   - `public/audio.wav` … マスター音源
   - 背景画像を敷くなら `public/bg.png`（任意）を置き、`input/lyrics.json` の `meta` に `"backgroundImage": "bg.png"` を足す。無ければ `meta.background` の暗色一色
2. 書き換える
   - `input/lyrics.json` … 歌詞と秒（今はダミー）。スキーマは `src/types.ts`
     - 各行: `text` / `t` / `hold` / `pattern`（既定 `centerBig`）/ `side`（`edge` の左右）/ `serif`（英字を Playfair で）/ `glitch` / `chroma` / `size` / `color`
     - `meta.background`（下地の色）/ `meta.ink`（文字色の既定）
   - `input/project.json` … クレジット。`workflow.config.json` の `credits` をそのまま写す。`"Vocal: NAME"` は「Vocal」を小ラベル・NAME を名前として2段で出す。秒を変えたいときだけ `meta.credits: [{from,to}, …]`（項目順）を足す
   - 再着色: 文字色は `meta.ink` / 行ごとの `color`、クレジットの色は `src/Credits.tsx` の `DEFAULT_THEME`
   - ショートの区間: `src/Root.tsx` の `SHORT_START` / `SHORT_END`（秒）
3. レンダー
   ```bash
   npm install
   npx remotion studio
   npx remotion render LyricVideo out/main.mp4
   npx remotion render ShortVideo out/short.mp4
   ```

### 公開版 `templates/mv` との違い
- `tools/make_mv.sh` には乗らない。転写・拍・素材整形・検査のスクリプトは入っていない（Remotion プロジェクトだけ）。
- `lyrics.json` は自動生成されない。手で書くか、`templates/mv` の 01（whisper）/ 04 で作った秒をこの形式に写す。`pattern` の割り振り（Aメロは `edge`、サビは `centerBig` など）は手で決める。
- 前景キャラの合成・サムネのコンポジションは無い（キャラは背景画像に含める）。

## 注意（発展途上・そのまま共有）
- RESONAL の1曲の制作で使った実装をほぼそのまま出している。曲データとクレジットの読み方だけ差し替えた。
- 確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。
- サポートなし。
