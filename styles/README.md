# styles — MV の見せ方（13スタイル・実験的）

RESONAL で MV を作るときに使ってきた見せ方の型を、そのまま共有しています。どれを選ぶかは skill `mv-styles`（13スタイルのカタログと18の軸）で決めます。何も言わなければ、既定の型（`templates/mv`・`tools/make_mv.sh`）で作ります。

- 発展途上の資産です。スタイルごとに作りや手順が揃っていません。
- どのスタイルも `tools/make_mv.sh` には乗りません。歌詞の秒やタイミングの書き方は、各スタイルの README に従います。
- 確認したのは `npm install` と型チェック（`npx tsc --noEmit`）の通過までです。レンダーは確かめていません。
- キャラ画像・背景素材・音源は同梱していません。自分の素材を置いてください。
- クレジットの文言は `input/project.json`（または各 README の案内）で自分のものに差し替えます。

| スタイル | 見た目 | 元になった RESONAL の曲 |
|---|---|---|
| [scatter-mincho](scatter-mincho/) | 白い極太明朝を散らし、色収差とグリッチを重ねる | Skip Intro |
| [ring-visualizer](ring-visualizer/) | 静止画の中心にネオンの円形波形が音に反応する（歌詞なし） | 初期のビジュアライザ用 |
| [ring-visualizer-loop](ring-visualizer-loop/) | ring-visualizer の背景をループ動画にしたもの | 初期のビジュアライザ用 |
| [white-cut](white-cut/) | 白地の中央に黒い明朝を1フレーズずつ、拍で切り替える | Heat Shock |
| [photocopy-zine](photocopy-zine/) | コピー機で刷ったような網点と紙の劣化 | Repeat Offender |
| [pink-bounce](pink-bounce/) | ピンク高キーに丸文字がぷるんと出る | Made You Look・おかわりアポカリプス |
| [crimson-gothic](crimson-gothic/) | 暗い背景に明朝とセリフ体、4つの出し方を行ごとに選ぶ | Cold Read |
| [shape-burst](shape-burst/) | 文字が跳ねて出て、サビで図形がはじける | Cotton Overkill |
| [invert-shapes](invert-shapes/) | 白い図形と極太ゴシックの重なりが白黒反転する | Noise Doll・Static Hazard・Stutter Step |
| [sky-keyvisual](sky-keyvisual/) | 背景イラストに透過動画のキャラを小節に合わせて乗せる | Extra Time |
| [burn-in](burn-in/) | 黒地に白い明朝、消えた行が補色の残像として焼き残る | Afterimage |
| [lowpoly-corridor](lowpoly-corridor/) | 3D の世界をカメラが駆け抜け、キャラを平面で置く | Poppy Requiem・Dive Reflex |
| [plate-swap](plate-swap/) | 夜の街の「面」を小節頭で切り替え、静止画のキャラを置く | Rerun Season |
| [portrait-frame](portrait-frame/) | 静止した立ち絵の後ろで背景が切り替わり、縦書きの明朝が積み上がる | Whiteout |

`_mv-kit/` は、plate-swap と portrait-frame が共通で使う部品です。この2つは `styles/` の中に置いたまま使ってください。
