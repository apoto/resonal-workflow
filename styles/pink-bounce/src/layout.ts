import { MOCHIY_POP, MPLUS_ROUNDED } from './fonts';
import { ScatterWord } from './types';

/**
 * 文字レイアウトの衝突解消。
 *
 * scatter / giant / center の座標とサイズは手置きなので、語どうしの重なりや画面外へのはみ出しが起きる。
 * ここで **実測幅に基づいて** 押し出し／縮小して解く。
 *
 * 幅は推定せず canvas measureText で実測する（fonts.ts が読み込み完了までレンダーを待たせる）。
 * Word() は1文字=1spanのflex並びなのでカーニングが効かない＝**1文字ずつ測って足す**のが正しい。
 */

const LS_MOCHIY = 0.05; // Word() の letterSpacing(em) と一致させる
const LS_ROUNDED = 0.1;
// Glyph() の外フチ: strokeWidth = size*0.045*3.4 ≒ 0.153em。ストロークは中央揃えなので
// 左右それぞれ半分ぶん外側に張り出す＝幅は +0.153em として扱う。
const OUTLINE_EM = 0.153;

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

const getCtx = (): CanvasRenderingContext2D | null => {
  if (ctx === undefined) {
    ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return ctx;
};

// canvas が使えない環境（型チェック/SSR）用の粗い推定。全角1.0em / ASCII 0.62em。
const estimateChar = (ch: string): number => (ch.charCodeAt(0) < 0x2e80 ? 0.62 : 1.0);

/** 1文字ぶんの送り幅(px)。フォント指定は Word() の `fontWeight:800` と揃える。 */
const charWidth = (ch: string, size: number, family: string): number => {
  const key = `${family}|${size}|${ch}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = getCtx();
  let w: number;
  if (c) {
    c.font = `800 ${size}px ${family}, sans-serif`;
    w = c.measureText(ch).width;
  } else {
    w = estimateChar(ch) * size;
  }
  cache.set(key, w);
  return w;
};

/** 1行の実描画幅(px)＝文字送りの総和＋字間＋外フチの張り出し。 */
export const textWidth = (text: string, size: number, handwrite?: boolean): number => {
  const family = handwrite ? MPLUS_ROUNDED : MOCHIY_POP;
  const ls = handwrite ? LS_ROUNDED : LS_MOCHIY;
  const chars = Array.from(text);
  let w = 0;
  for (const ch of chars) w += charWidth(ch, size, family) + size * ls;
  return w + size * OUTLINE_EM;
};

/** 1行の実描画高さ(px)。lineHeight 1.05（縦書きは1.18）＋外フチ。 */
export const textHeight = (size: number, vertical?: boolean): number =>
  size * (vertical ? 1.18 : 1.05) + size * OUTLINE_EM;

/**
 * center / giant: 与えたサイズで画面幅を超えるなら、収まるまでサイズを落とす。
 * 手置きサイズを上限として尊重し、**縮める方向にしか動かさない**。
 */
export const fitToWidth = (
  text: string,
  size: number,
  frameW: number,
  handwrite?: boolean,
  fill = 0.94,
): number => {
  const avail = frameW * fill;
  const w = textWidth(text, size, handwrite);
  return w <= avail ? size : Math.floor(size * (avail / w));
};

/** split（縦書き）: 画面高を超えるなら縮める。 */
export const fitToHeight = (text: string, size: number, frameH: number, fill = 0.86): number => {
  const avail = frameH * fill;
  const h = Array.from(text).length * size * 1.18 + size * OUTLINE_EM;
  return h <= avail ? size : Math.floor(size * (avail / h));
};

export type PlacedWord = ScatterWord & { size: number; xPx: number; yPx: number };

// 回転後のAABB幅（外接矩形）。scatter は ±7° 程度なので幅への効きは小さいが、無視すると
// 端の文字が隣に噛む。
const rotatedWidth = (w: number, h: number, rotDeg: number): number => {
  const r = (Math.abs(rotDeg) * Math.PI) / 180;
  return w * Math.cos(r) + h * Math.sin(r);
};

const rotatedHeight = (w: number, h: number, rotDeg: number): number => {
  const r = (Math.abs(rotDeg) * Math.PI) / 180;
  return w * Math.sin(r) + h * Math.cos(r);
};

/**
 * scatter の重なり解消。
 *
 * 方針: 作者が置いた y（＝段の高さ・大中小のリズム）と rot は動かさない。動かすのは x とサイズだけ。
 *  1. 縦の描画範囲が重なる語を「帯」としてまとめる（推移的に連結）。
 *  2. 帯の中を左→右に押し出し（順序は保つ）、右端がはみ出たら右→左に押し戻す。
 *  3. それでも入らない帯だけ、必要な比率でサイズを一律縮小してやり直す。
 * 縦に重なっていない語は互いに無関係なので、画面内クランプだけして手置きの x を維持する。
 */
export const resolveScatter = (
  input: ScatterWord[],
  frameW: number,
  frameH: number,
  scale: number,
): PlacedWord[] => {
  // lyrics.json 由来の配列をそのまま書き換えるとフレームを跨いで座標が累積してズレる。必ず複製する。
  const words: ScatterWord[] = input.map((w) => ({ ...w }));
  const gap = frameW * 0.012; // 語間の最小アキ
  const minLeft = frameW * 0.025;
  const maxRight = frameW * 0.975;

  const place = (sizes: number[]): PlacedWord[] =>
    words.map((w, i) => ({
      ...w,
      size: sizes[i],
      xPx: (w.x / 100) * frameW,
      yPx: (w.y / 100) * frameH,
    }));

  let sizes = words.map((w) => w.size * scale);

  // ---- 単語単体で画面幅を超えるものを先に縮める ----
  sizes = sizes.map((s, i) => {
    const raw = textWidth(words[i].t, s);
    const aabb = rotatedWidth(raw, textHeight(s), words[i].rot);
    const avail = maxRight - minLeft;
    return aabb <= avail ? s : Math.floor(s * (avail / aabb));
  });

  // ---- 縦に重なる語を帯にまとめる ----
  const bandOf = new Array(words.length).fill(-1);
  const vExtent = (i: number): [number, number] => {
    const h = rotatedHeight(textWidth(words[i].t, sizes[i]), textHeight(sizes[i]), words[i].rot);
    const cy = (words[i].y / 100) * frameH;
    return [cy - h / 2, cy + h / 2];
  };
  let bandCount = 0;
  for (let i = 0; i < words.length; i++) {
    if (bandOf[i] >= 0) continue;
    const band = bandCount++;
    const queue = [i];
    bandOf[i] = band;
    while (queue.length) {
      const a = queue.pop()!;
      const [aTop, aBot] = vExtent(a);
      for (let b = 0; b < words.length; b++) {
        if (bandOf[b] >= 0) continue;
        const [bTop, bBot] = vExtent(b);
        // 縦の描画範囲が少しでも重なるなら同じ帯（＝横に並べないと衝突する）
        if (aTop < bBot && bTop < aBot) {
          bandOf[b] = band;
          queue.push(b);
        }
      }
    }
  }

  // ---- 帯ごとに横方向を解く ----
  for (let band = 0; band < bandCount; band++) {
    const idx = words.map((_, i) => i).filter((i) => bandOf[i] === band);
    if (idx.length === 1) continue; // 単独＝押し出し不要（下でクランプする）
    idx.sort((a, b) => words[a].x - words[b].x);

    const widthOf = (i: number) => rotatedWidth(textWidth(words[i].t, sizes[i]), textHeight(sizes[i]), words[i].rot);

    // 必要幅が帯の使える幅を超えるなら、帯ごと縮めてから並べる
    const need = () => idx.reduce((s, i) => s + widthOf(i), 0) + gap * (idx.length - 1);
    const avail = maxRight - minLeft;
    if (need() > avail) {
      const k = (avail - gap * (idx.length - 1)) / (need() - gap * (idx.length - 1));
      for (const i of idx) sizes[i] = Math.floor(sizes[i] * k);
    }

    // 左→右に押し出す（手置きの位置を下回らない＝可能なら意図どおり）
    const left: Record<number, number> = {};
    let cursor = minLeft;
    for (const i of idx) {
      const w = widthOf(i);
      const authored = (words[i].x / 100) * frameW - w / 2;
      left[i] = Math.max(authored, cursor);
      cursor = left[i] + w + gap;
    }
    // 右端がはみ出たぶんを右→左に押し戻す
    let back = maxRight;
    for (let k = idx.length - 1; k >= 0; k--) {
      const i = idx[k];
      const w = widthOf(i);
      left[i] = Math.min(left[i], back - w);
      back = left[i] - gap;
    }
    // 押し戻しで左端を割ったら左詰めし直す（縮小済みなので入るはず）
    if (left[idx[0]] < minLeft) {
      cursor = minLeft;
      for (const i of idx) {
        const w = widthOf(i);
        left[i] = cursor;
        cursor += w + gap;
      }
    }
    for (const i of idx) words[i] = { ...words[i], x: ((left[i] + widthOf(i) / 2) / frameW) * 100 };
  }

  // ---- 最後に全語を画面内へクランプ ----
  const placed = place(sizes);
  return placed.map((p, i) => {
    const w = rotatedWidth(textWidth(p.t, p.size), textHeight(p.size), p.rot);
    const half = w / 2;
    const cx = Math.max(minLeft + half, Math.min(maxRight - half, p.xPx));
    const h = rotatedHeight(textWidth(p.t, p.size), textHeight(p.size), p.rot);
    const cy = Math.max(h / 2 + frameH * 0.01, Math.min(frameH * 0.99 - h / 2, p.yPx));
    return { ...p, xPx: cx, yPx: cy, x: (cx / frameW) * 100, y: (cy / frameH) * 100 };
  });
};
