import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { PAL, rand, rand2 } from './photocopy-zine';
import { RuntimeLyric } from './types';

/**
 * PhotocopyZineType — 刷り出して残して一掃する歌詞層。
 *
 * 挙動の骨格（3スタイルの組み合わせ）:
 *  - plate-swap `wipe-in-persist-type`: 約0.3秒で左から刷り出し → 数秒残る → **1フレームで消える**
 *  - white-cut: フェード無し・重なり無しのハードカット
 *  - burn-in を紙に翻訳: 消えた語が**版ズレの薄い刷り**として残り、重なって蓄積する
 *
 * 塗りは単色ベタ。縁取り・落ち影・グローは足さない（カラオケ字幕になるため）。
 * 紙地＝明るい面なので **黒インク**が既定（暗背景スタイルの白文字をそのまま持ち込まない）。
 */

export type TypeLayout =
  | 'stamp' // 中央付近に大きく1行（サビのタイトル語）
  | 'line' // 通常の1行（Verse）
  | 'strip' // 黒ベタの帯に白抜き＝反転印刷（キメ）
  | 'small' // 小さく端に貼る（書類の注釈）
  | 'tower'; // 縦に積む（連呼）

export interface TypeItem extends RuntimeLyric {
  layout?: TypeLayout;
  /** 韻のまとまり名。同じ grp の行は画面上で階段状に並ぶ＝「ひと組」に見える */
  grp?: string;
  /** まとまりの中の順番 / 総数 */
  gi?: number;
  gn?: number;
}

const FONT_DISPLAY = 'Anton, sans-serif';
const FONT_MONO = '"Courier Prime", monospace';

/** レイアウトごとの基準（画面高に対する%） */
const SIZE: Record<TypeLayout, number> = {
  stamp: 15.5,
  line: 8.2,
  strip: 9.5,
  small: 3.4,
  tower: 11,
};

/** 1語ぶんの刷り出し進行（0..1）。左→右に刷られる。
 *  刷り出し時間は hold に比例させる（上限0.3秒）＝短い行でも読める時間を残す。 */
const inkProgress = (frame: number, start: number, fps: number, hold: number) => {
  const dur = Math.max(2, Math.round(fps * Math.min(0.3, hold * 0.35)));
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

const Glyphs: React.FC<{
  text: string;
  layout: TypeLayout;
  degrade: number;
  color: string;
  seed: number;
  /** 画面内に収めるための縮小 × 行ごとの倍率 */
  mul?: number;
}> = ({ text, layout, degrade, color, mul = 1 }) => {
  const mono = layout === 'small';
  const sizeVh = SIZE[layout] * mul;
  // 劣化するほど文字がやせ細る/つぶれる（コピーのコピー）
  const squeeze = layout === 'small' ? 1 : 0.86 - degrade * 0.06;

  return (
    <span
      style={{
        fontFamily: mono ? FONT_MONO : FONT_DISPLAY,
        fontWeight: mono ? 700 : 400,
        fontSize: `${sizeVh}vh`,
        lineHeight: 0.92,
        letterSpacing: mono ? '0.16em' : '0.012em',
        color,
        display: 'inline-block',
        transform: `scaleX(${squeeze})`,
        transformOrigin: 'center center',
        whiteSpace: 'pre',
        // 劣化でエッジがガタつく（インクの乗りムラ）
        filter: degrade > 0.35 ? `contrast(${1 + degrade * 0.8})` : undefined,
        textTransform: mono ? 'none' : 'uppercase',
      }}
    >
      {text}
    </span>
  );
};

export const PhotocopyZineType: React.FC<{
  items: TypeItem[];
  degrade: number;
  /** 版ズレゴーストの蓄積を有効にする（Breakdown等で切る） */
  ghosts?: boolean;
  /** 9:16 用の縮小 */
  scale?: number;
}> = ({ items, degrade, ghosts = true, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // 画面幅を vh 単位で持つ（fontSize が vh 基準のため）
  const screenVh = (width / height) * 100;
  const MARGIN = 0.88; // 画面幅の 88% までに収める

  /**
   * 行が画面からはみ出さないように「縮小率」と「クランプした左位置」を出す。
   * Anton は超コンデンス体なので 1文字あたりの送りは概ね fontSize の 0.40（scaleX 0.86 込みで 0.345）。
   * mono（small）は 0.62em 送り＋トラッキング 0.16em。
   */
  const fitOf = (text: string, sizeVh: number, mono: boolean, mul: number) => {
    const per = mono ? 0.92 : 0.50; // 保守側に見積もる（切れるより縮む方がまし）
    const estVh = text.length * sizeVh * mul * per;
    const maxVh = screenVh * MARGIN;
    const shrink = estVh > maxVh ? maxVh / estVh : 1;
    return { widthVh: estVh * shrink, shrink };
  };

  const active = items.filter((l) => frame >= l.startFrame && frame < l.endFrame);
  // 直近に消えた語＝版ズレゴーストとして薄く残す（最大4枚・時間で減衰）
  const ghostWindow = Math.round(fps * 6);
  const past = ghosts
    ? items
        .filter((l) => frame >= l.endFrame && frame < l.endFrame + ghostWindow)
        .slice(-3)
    : [];

  const place = (l: TypeItem, i: number) => {
    const layout = l.layout ?? 'line';
    const s = l.startFrame;
    const mul = (l.scale ?? 1) * scale;
    const { widthVh, shrink } = fitOf(l.text, SIZE[layout], layout === 'small', mul);
    // 配置は決定的（seed = 開始フレーム）
    const r1 = rand2(s * 1.37 + i);
    const r2 = rand2(s * 2.11 + i);
    let left = 50 + r1 * 16;
    let top = 50 + r2 * 22;
    if (layout === 'stamp') {
      left = 50 + r1 * 6;
      top = 47 + r2 * 8;
    } else if (layout === 'small') {
      left = 50 + r1 * 34;
      top = 50 + r2 * 38;
    } else if (layout === 'tower') {
      left = 50 + r1 * 10;
      top = 50 + r2 * 18;
    }
    // ★韻のまとまりは階段状に置く（ばらけさせない＝1つのフレーズが刻まれて見える）
    if (l.grp && l.gn && l.gn > 1) {
      const k = (l.gi ?? 0) - (l.gn - 1) / 2; // 中心を0にした位置
      const stepX = l.gn >= 4 ? 11 : 15;
      const stepY = l.gn >= 4 ? 7.5 : 10;
      left = 50 + k * stepX + r1 * 3;
      top = 50 + k * stepY + r2 * 3;
    }
    const rot = (layout === 'small' ? r2 * 4 : r1 * 2.2) * (1 + degrade * 0.5);
    // ★画面内クランプ（左右）: 行の実効幅の半分＋余白ぶんだけ内側へ押し戻す
    const halfPct = (widthVh / screenVh) * 50;
    const pad = 3;
    const lo = halfPct + pad;
    const hi = 100 - halfPct - pad;
    left = lo > hi ? 50 : Math.min(hi, Math.max(lo, left));
    // 上下も画面内へ
    const halfH = (SIZE[layout] * mul * shrink) / 2;
    const halfHPct = (halfH / 100) * 100 * 0.55;
    top = Math.min(92 - halfHPct, Math.max(8 + halfHPct, top));
    return { layout, left, top, rot, shrink, mul };
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* ── 版ズレゴースト（先に描く＝現行の刷りの下） ── */}
      {past.map((l, i) => {
        const { layout, left, top, rot, shrink, mul } = place(l, i);
        const age = (frame - l.endFrame) / ghostWindow; // 0..1
        const op = (1 - age) * (0.11 + degrade * 0.16);
        const dx = (2 + degrade * 9) * rand2(l.startFrame * 4.3);
        const dy = (2 + degrade * 7) * rand2(l.startFrame * 6.1);
        return (
          <div
            key={`g-${l.startFrame}-${i}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot}deg)`,
              opacity: op,
              mixBlendMode: 'multiply',
            }}
          >
            <Glyphs
              text={l.text}
              layout={layout}
              degrade={degrade}
              color={PAL.inkSoft}
              seed={l.startFrame}
              mul={mul * shrink}
            />
          </div>
        );
      })}

      {/* ── 現行の刷り ── */}
      {active.map((l, i) => {
        const { layout, left, top, rot, shrink, mul } = place(l, i);
        const p = inkProgress(frame, l.startFrame, fps, (l.endFrame - l.startFrame) / fps);
        // 刷り出し = 左から右へ clip される（ローラーが通る）
        const clip = `inset(0 ${(1 - p) * 100}% 0 0)`;
        const accent = l.accent === 'amber';
        const color = layout === 'strip' ? PAL.paper : accent ? PAL.amber : PAL.ink;

        // ★文字の下に「白い紙片」を貼る（ジンの切り貼り）。
        //   焼き込み網点で地が濃くなったため、黒インクの文字が背景に負ける。
        //   縁取り/影/グローで助けるとカラオケ字幕になるので、**紙を貼る**方で解く
        //   （＝plate-swap「塗りは地で決める」の photocopy-zine 版：地を作ってしまう）。
        const patch = layout !== 'strip' && layout !== 'small';

        const body = (
          <div style={{ clipPath: clip, WebkitClipPath: clip }}>
            <Glyphs
              text={l.text}
              layout={layout}
              degrade={degrade}
              color={color}
              seed={l.startFrame}
              mul={mul * shrink}
            />
          </div>
        );

        return (
          <div
            key={`a-${l.startFrame}-${i}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%,-50%) rotate(${rot}deg)`,
              // 紙片を貼る行は normal（multiply だと紙が暗いままで貼った意味が無い）
              mixBlendMode: layout === 'strip' || patch ? 'normal' : 'multiply',
            }}
          >
            {patch ? (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%,-50%) rotate(${rot * 0.35}deg)`,
                  width: `calc(100% + ${SIZE[layout] * mul * shrink * 0.5}vh)`,
                  height: `${SIZE[layout] * mul * shrink * 1.18}vh`,
                  backgroundColor: PAL.paper,
                  clipPath: clip,
                  WebkitClipPath: clip,
                }}
              />
            ) : null}
            {layout === 'strip' ? (
              <div
                style={{
                  backgroundColor: PAL.ink,
                  padding: '0.6vh 1.6vh 1.1vh',
                  clipPath: clip,
                  WebkitClipPath: clip,
                }}
              >
                <Glyphs
                  text={l.text}
                  layout={layout}
                  degrade={degrade}
                  color={PAL.paper}
                  seed={l.startFrame}
                  mul={mul * shrink}
                />
              </div>
            ) : (
              body
            )}
          </div>
        );
      })}
    </div>
  );
};
