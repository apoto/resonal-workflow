#!/usr/bin/env python3
"""face_swap.py — 表情差分を「顔だけ」ベース立ち絵へ合成する。

なぜ要るか: 参照画つきで表情違いを生成すると、体・髪のシルエットも動く（アルファ IoU 88〜91% 程度）。
リグは clip-path を画像内の % で切っているので、体が動くと部位の切り出しがズレて継ぎ目が割れる。
→ ベース立ち絵の体・髪・アルファを 1px も動かさず、顔の楕円領域だけを差分から持ってくる。

位置合わせ: 差分側を ±N px 平行移動しながらアルファの IoU が最大になる位置を総当たりで探す。

Usage: face_swap.py <base.png> <variant.png> <out.png> [--search 24] [--face y0,y1]
  --face  顔の縦範囲（画像高に対する割合。例 0.24,0.47）。既定は通常頭身の 0.055,0.195。
          デフォルメ頭身は必ず渡す（グリッド画で眉〜顎を読む）。
出力は必ずベースと同じサイズ・同じアルファ。
"""
import sys
import numpy as np
from PIL import Image


def alpha(im):
    return (np.asarray(im.convert('RGBA'))[..., 3] > 128)


def best_shift(base_a, var_a, search):
    """アルファの IoU が最大になる (dy,dx) を探す。"""
    best, bdy, bdx = -1.0, 0, 0
    for dy in range(-search, search + 1, 2):
        for dx in range(-search, search + 1, 2):
            v = np.roll(np.roll(var_a, dy, axis=0), dx, axis=1)
            inter = (base_a & v).sum()
            union = (base_a | v).sum()
            iou = inter / max(1, union)
            if iou > best:
                best, bdy, bdx = iou, dy, dx
    return bdy, bdx, best


def face_box(base_a, fy0=0.055, fy1=0.195):
    """顔の楕円領域。縦は fy0〜fy1（画像高の割合）、横はその帯でのシルエット幅の中央 58%。"""
    h, w = base_a.shape
    y0, y1 = int(h * fy0), int(h * fy1)
    mid0, mid1 = fy0 + (fy1 - fy0) * 0.3, fy0 + (fy1 - fy0) * 0.75
    band = base_a[int(h * mid0):int(h * mid1)]
    cols = np.where(band.any(axis=0))[0]
    if len(cols) == 0:
        return (int(w * 0.40), y0, int(w * 0.60), y1)
    cx = (cols[0] + cols[-1]) / 2
    half = (cols[-1] - cols[0]) * 0.29
    return (int(cx - half), y0, int(cx + half), y1)


def main():
    base_p, var_p, out_p = sys.argv[1], sys.argv[2], sys.argv[3]
    search = 24
    if '--search' in sys.argv:
        search = int(sys.argv[sys.argv.index('--search') + 1])
    fy0, fy1 = 0.055, 0.195
    if '--face' in sys.argv:
        fy0, fy1 = (float(v) for v in sys.argv[sys.argv.index('--face') + 1].split(','))

    base = Image.open(base_p).convert('RGBA')
    var = Image.open(var_p).convert('RGBA')
    if base.size != var.size:
        var = var.resize(base.size, Image.LANCZOS)

    ba, va = alpha(base), alpha(var)
    dy, dx, iou = best_shift(ba, va, search)
    print(f'[align] dy={dy} dx={dx} → アルファIoU {iou*100:.1f}%')

    b = np.asarray(base).astype(np.float32)
    v = np.asarray(var).astype(np.float32)
    v = np.roll(np.roll(v, dy, axis=0), dx, axis=1)

    x0, y0, x1, y1 = face_box(ba, fy0, fy1)
    h, w = ba.shape
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    # 楕円の内側は 1、外へ 0 まで滑らかに落とす（境目を出さない）
    mask = np.clip((1.15 - d) / 0.30, 0, 1)[..., None]
    print(f'[face] 楕円 x{x0}-{x1} y{y0}-{y1}（実測シルエットから算出）')

    rgb = b[..., :3] * (1 - mask) + v[..., :3] * mask
    out = np.dstack([rgb, b[..., 3]]).astype(np.uint8)  # アルファはベースのまま＝シルエットは 1px も動かない
    Image.fromarray(out, 'RGBA').save(out_p)
    print(f'[OK] {out_p}')


if __name__ == '__main__':
    main()
