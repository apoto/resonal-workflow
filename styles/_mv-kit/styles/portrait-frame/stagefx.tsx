import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { StageFxDef, StageFxProps, registerStageFx } from '../../src/registry';
import { seeded } from './engine';

/**
 * portrait-frame の StageFx（画面全体を包んで変形する層）。overlay（上に足す）とは別概念。
 *
 * ★打点系は drop / サビ限定（mv-production.md 骨格検査⑤: 全編がけは落差が死ぬ）。
 * ★光過敏対策: 点滅は**1秒3回以下**（light-flood-wipe / flash-cut レコードの必須条件）。
 */

/**
 * from/to（秒）から、この StageFx のローカル進行度 0→1 を出す。
 */
const useProg = (from: number, to: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const dur = Math.max(0.0001, to - from);
  const local = t - from;
  return { t, local, prog: Math.max(0, Math.min(1, local / dur)), dur, inside: local >= 0 && local <= dur };
};

// ------------------------------------------------------- flood-white（白飛び・未登録）

/**
 * 一方向から光が流入 → 全白 97-100% を数フレーム → 引き際に次の面を開示する転換。
 * record: light-flood-wipe（★1曲2〜3回まで）。
 */
const FloodWhite: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { prog, dur, inside } = useProg(from, to);
  if (!inside) return <>{children}</>;
  const peak = (params.peak as number) ?? 0.42;      // 全白のピーク位置（0〜1）
  const holdRatio = (params.hold as number) ?? 0.12; // 全白を保つ割合
  const dir = (params.dir as string) ?? 'left';
  const color = (params.color as string) ?? '#ffffff';

  // 立ち上がり → ホールド → 引き
  const a =
    prog < peak
      ? Math.pow(prog / peak, 1.7)
      : prog < peak + holdRatio
        ? 1
        : Math.pow(1 - (prog - peak - holdRatio) / Math.max(0.0001, 1 - peak - holdRatio), 1.4);

  const gradient =
    dir === 'radial'
      ? `radial-gradient(circle at 50% 50%, ${color} 0%, ${color} ${30 + a * 70}%, transparent 100%)`
      : `linear-gradient(${dir === 'left' ? 90 : dir === 'right' ? 270 : 180}deg, ${color} 0%, ${color} ${a * 100}%, transparent ${Math.min(100, a * 100 + 18)}%)`;

  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill style={{ pointerEvents: 'none', background: gradient, opacity: Math.min(1, a * 1.02) }} />
    </AbsoluteFill>
  );
};

/**
 * 画面全体を揺らす StageFx（zoom-punch / camera-shake）は portrait-frame では持たない。
 * ビートの打点は **overlay 側（portrait-frame.snow / portrait-frame.sparkle の beat 同期）** で出す。
 */

// ------------------------------------------- progressive-white（段階白飛び）

/**
 * 画面をセル分割し、1マスずつ**不可逆に白へ飛ぶ**。バックロード分布で終盤に一斉に飛ぶ。
 * record: progressive-blackout（★これを**白へ反転して運用**＝portrait-frame 由来の新規運用）。
 *
 * ★白基調で白に飛ばすと画が消えるので、**額縁と立ち絵のシルエットは残す**設計にする
 *   （このFxは children を包むが、cover に `mixBlendMode: screen` を使わず不透過で乗せ、
 *   立ち絵より下の層に置きたい場合は overlay 版を使う）。点滅させない＝increment のみ。
 */
const ProgressiveWhite: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { prog, inside } = useProg(from, to);
  if (!inside) return <>{children}</>;
  /**
   * ★実装は **SVG の feTurbulence を閾値で2値化**する（DOM は1枚）。
   *   セルを px で刻んで div や radial-gradient を並べる案は**破綻した**:
   *   6px セルだと 1920x1080 で 57,600 個になり、CSS が限界を超えて
   *   レンダーが `Could not extract frame from compositor` で落ちた。
   *   ノイズなら粒の大きさは `grain`（baseFrequency）だけで決まり、コストは一定。
   *
   * ★不可逆（一度白くなった粒は戻らない）は**シードを固定して閾値を単調に下げる**ことで自然に成立する。
   */
  const grain = (params.grain as number) ?? 0.62;      // 大きいほど粒が細かい（雪相当は 0.5〜0.8）
  const maxOpacity = (params.maxOpacity as number) ?? 0.9;
  const color = (params.color as string) ?? '#ffffff';
  const seed = (params.seed as number) ?? 7;
  /**
   * バックロード: 終盤に一気に増える。
   */
  const ceil = (params.ceil as number) ?? 0.62;
  const ratio = Math.pow(prog, 2.6) * ceil;
  // 閾値を下げると点灯が増える。slope を強くして2値に近づける（ぼんやりした霧にしない）
  const slope = 16;
  const intercept = -(1 - ratio) * slope * 0.62;
  const id = `portrait-frame-pw-${Math.round(ratio * 1000)}-${seed}`;
  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: maxOpacity }}>
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={grain} numOctaves={1} seed={seed} result="n" />
              {/* ノイズの輝度をアルファに移し、閾値で2値化＝白い粒の集合になる */}
              <feColorMatrix
                in="n"
                type="matrix"
                values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.33 0.33 0.33 0 0`}
                result="a"
              />
              <feComponentTransfer in="a">
                <feFuncA type="linear" slope={slope} intercept={intercept} />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill={color} filter={`url(#${id})`} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------- mono-accent（白黒＋差し色1色）

/**
 * 画面全体を白黒に落とし、**指定色相だけ彩度を残す**セレクティブカラー。
 * record: black-white-accent。
 */
const MonoAccent: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { prog, inside } = useProg(from, to);
  if (!inside) return <>{children}</>;
  const fade = (params.fade as number) ?? 0.12;   // 入り/抜けの割合
  const amount =
    prog < fade ? prog / fade : prog > 1 - fade ? (1 - prog) / fade : 1;
  /**
   * 「脱色」だけでは足りない。**白基調の画は元から無彩色に近いので、
   *   彩度を落としても見た目が変わらない**＝差し色が出たように見えない。
   *   そこで「輝度に落とす」＋「**青だけを luma から離す方向に増幅**」する:
   *     R' = G' = luma(R,G,B)
   *     B' = luma + k * boost * (B - luma)
   *   白い面は B≒luma なので白のまま、**青い部分だけ濃い青に伸びる**＝
   *   「まっしろの中に、裂け目の青だけが出る」になる。
   */
  const keep = (params.keep as number) ?? 1.0;
  const boost = (params.boost as number) ?? 2.6;  // 青を luma から離す倍率
  const k = keep * amount;
  const LR = 0.2126, LG = 0.7152, LB = 0.0722;
  const g = k * boost;
  const m = [
    LR, LG, LB, 0, 0,
    LR, LG, LB, 0, 0,
    LR * (1 - g), LG * (1 - g), LB + g * (1 - LB), 0, 0,
    0, 0, 0, 1, 0,
  ].join(' ');
  const id = `portrait-frame-mono-${Math.round(k * 1000)}`;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={m} />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: `url(#${id})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------- blackout（黒転）

/** 1〜2コマの黒転。完全停止の瞬間に置く。点滅させない。 */
const Blackout: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { prog, inside } = useProg(from, to);
  if (!inside) return <>{children}</>;
  const a = prog < 0.5 ? prog * 2 : (1 - prog) * 2;
  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill style={{ pointerEvents: 'none', background: (params.color as string) ?? '#0a0f14', opacity: Math.pow(a, 0.6) }} />
    </AbsoluteFill>
  );
};


// ------------------------------------------- psychedelic（間奏のサイケデリック）

/**
 * 間奏用の激しいエフェクト。ハードコア/フレンチコアのMV寄りのサイケデリック。
 *
 * ★「反転させまくる」と光過敏対策（点滅は1秒3回以下＝records/negative-invert.md /
 *   flash-cut.md の必須条件）は**両立できる**。鍵は「点滅させないこと」:
 *     ・反転は **拍で切り替わる持続反転**（BPM202 の2小節＝2.376秒周期＝0.42Hz）。
 *       レコードの正規用法「キメの持続反転」「0.5〜2秒の反転」に沿う。
 *     ・色相は **連続的に回す**（hue-rotate）。連続変化は点滅ではないので周波数の制約に当たらない。
 *     ・形は **万華鏡の鏡像**と**液状の横波**で崩す。輝度が急変しないので安全。
 *   ＝「1フレームおきに白黒が入れ替わる」類は一切やらない。
 */
const Psychedelic: React.FC<StageFxProps> = ({ from, to, params, children }) => {
  const { local, inside, dur } = useProg(from, to);
  const { fps } = useVideoConfig();
  if (!inside) return <>{children}</>;

  const bpm = (params.bpm as number) ?? 202;
  const bar = (60 / bpm) * 4;                                  // 1小節（秒）
  const invertBars = (params.invertBars as number) ?? 2;       // 何小節ごとに反転を切り替えるか
  const hueSpeed = (params.hueSpeed as number) ?? 26;          // 色相の回転（度/秒）
  const warpBars = (params.warpBars as number) ?? 4;           // 液状の横波を入れる間隔（小節）
  const sat = (params.saturate as number) ?? 1.6;

  /**
   * ★クロスフェードは 0.45 秒かける。輝度が階段状に飛ばず、
   *   「反転しまくっている」印象は保ったまま急変の回数が下がる。
   */
  const t = from + local;
  const period = bar * invertBars;
  const invPhase = Math.floor(t / period) % 2;
  const CROSS = (params.cross as number) ?? 0.45;
  const cross = Math.min(1, (t % period) / CROSS);
  // 三角関数で滑らかに（線形だと開始と終了に角が立って急変として検出される）
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * cross);
  const invert = invPhase === 1 ? eased : 1 - eased;

  // ── 色相を連続回転（サイケデリックの主役）
  const hue = (t * hueSpeed) % 360;   // t は絶対秒なので段をまたいでも連続する

  // ── 液状の横波（キメの打点。warpBars ごと＝1秒3回以下）
  const warpCycle = bar * warpBars;
  const warpLocal = t % warpCycle;   // 同じく絶対秒基準
  const warpAmp = warpLocal < 0.34 ? (1 - warpLocal / 0.34) * ((params.warp as number) ?? 26) : 0;
  const wid = `portrait-frame-psy-${Math.round(t * 10)}`;

  const filter = [
    `invert(${(invert * ((params.invertMax as number) ?? 1)).toFixed(3)})`,
    `hue-rotate(${hue.toFixed(1)}deg)`,
    `saturate(${sat})`,
  ].join(' ');

  const inner = (
    <AbsoluteFill style={{ filter }}>
      {warpAmp > 0.4 ? (
        <>
          <svg width={0} height={0} style={{ position: 'absolute' }}>
            <filter id={wid} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="turbulence" baseFrequency="0.006 0.05" numOctaves={2} seed={3} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={warpAmp} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <AbsoluteFill style={{ filter: `url(#${wid})` }}>{children}</AbsoluteFill>
        </>
      ) : (
        children
      )}
    </AbsoluteFill>
  );

  return inner;
};

const defs: StageFxDef[] = [
  { id: 'portrait-frame.psychedelic', style: 'portrait-frame', name: '間奏のサイケデリック', record: 'negative-invert', description: '拍で切り替わる持続反転＋連続的な色相回転＋液状の横波。★点滅させない＝光過敏対策(1秒3回以下)を満たしたまま「反転させまくる」を作る。画面は揺らさない。', component: Psychedelic },
  { id: 'portrait-frame.progressive-white', style: 'portrait-frame', name: '段階白飛び', record: 'progressive-blackout', description: 'SVGノイズを閾値で2値化して雪サイズの粒が1つずつ不可逆に白へ飛ぶ。grain で粒の細かさを指定。黒の段階消灯を白へ反転した運用。点滅させない。', component: ProgressiveWhite },
  { id: 'portrait-frame.mono-accent', style: 'portrait-frame', name: '白黒＋差し色1色', record: 'black-white-accent', description: '輝度に落としつつ青チャンネルだけ残す行列。白い面は白黒・深い青だけ残る。歌詞のaccentと同フレームで同期させる。', component: MonoAccent },
  { id: 'portrait-frame.blackout', style: 'portrait-frame', name: '黒転', record: 'progressive-blackout', description: '1〜2コマの黒転。完全停止の瞬間に置く。点滅させない。', component: Blackout },
];

registerStageFx(...defs);
export const portraitFrameStageFx = defs;
