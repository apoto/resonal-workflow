# white-cut（白地・中央の黒明朝＋ハードカット）

白い背景のど真ん中に黒い明朝（Noto Serif JP）を1フレーズずつ置き、拍でパッと切り替える（フェード・重なり無し）。
日本語は縦書き・英語のキメだけ横書き、広い字間と「」。キメの行だけ画面全体に横波の液状グリッチ（SVG 乱流）が一瞬走る。
本編 `LyricVideo`（16:9）と縦ショート `ShortVideo`（9:16）の2本。

**向く曲:** ミドルテンポ（BPM 90〜115 前後）のデザイン寄り・洗練・エモ。静かな熱・余白・少しの切なさがある歌詞。

**元になった RESONAL の曲:** Heat Shock

## 使い方

1. `public/` に置く
   - `public/audio.wav` … マスター音源
   - 中央に絵を置くなら `public/character.png`（任意）を置き、`input/lyrics.json` の `meta` に `"character": "character.png"` を足す
2. 書き換える
   - `input/lyrics.json` … 歌詞と秒（今はダミー）。スキーマは `src/types.ts`
     - 各行: `text` / `t`（開始秒）/ `hold`（表示秒。次の行と重ねない）/ `vertical`（既定 true。英語は false）/ `quote`（「」で囲む）/ `glitch`（出現時に横波グリッチ）/ `size`
     - `meta.background`（背景色）/ `meta.ink`（文字色）で白黒を反転できる
   - `input/project.json` … クレジット。`workflow.config.json` の `credits` をそのまま写す。`"Vocal: NAME"` は「Vocal」を小ラベル・NAME を名前として2段で出す。秒を変えたいときだけ `meta.credits: [{from,to}, …]`（項目順）を足す
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
- `lyrics.json` は自動生成されない。手で書くか、`templates/mv` の 01（whisper）/ 04 で作った秒をこの形式（`t` / `hold` / `vertical` / `glitch`）に写す。拍に合わせたハードカットなので、`hold` は「次の行の `t` まで」に揃える。
- 背景画像・前景キャラの自動切り抜きは無い。サムネのコンポジションも無い。

## 注意（発展途上・そのまま共有）
- RESONAL の1曲の制作で使った実装をほぼそのまま出している。曲データとクレジットの読み方だけ差し替えた。
- 確認した範囲: `npm install` と `npx tsc --noEmit` は通過。レンダーは未確認。
- サポートなし。
