#!/usr/bin/env python3
"""グリーンバックのキーイング。静止画プレートと Kling 連番の両方から使う。

緑スクリーンは色が既知なので、合成の逆算で解く。観測 C = α·F + (1-α)·BG より
  α = 1 - clamp( (G - max(R,B)) / (BG_G - max(BG_R,BG_B)) )   ← 線形・しきい値の死角なし
  F = (C - (1-α)·BG) / α                                        ← アンプリマルチプライ
しきい値で α を作ると半透明の毛先に緑かぶりが残り、despill を「G から引く」だけにすると暗い緑グレーに潰れる。
この式なら白は任意の混合率で白に戻り、緑は透明、黒い衣装も保持される。

Usage: greenkey.py <in.png> <out.png>
依存: numpy / pillow / scipy
"""
import numpy as np
from PIL import Image
from scipy import ndimage


def sample_bg(rgb: np.ndarray, k: int = 24) -> np.ndarray:
    """四隅 k×k の中央値で背景の緑を実測（1点サンプルだと粒子を拾って外す）。"""
    corners = np.concatenate([
        rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
        rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
    ])
    return np.median(corners, axis=0)


def key(rgb: np.ndarray, bg: np.ndarray, drop_islands: bool = True, alpha_floor: float = 0.06):
    """RGB(float) → (前景RGB uint8, alpha uint8)。

    alpha_floor: これ以下の α は 0 に落として上を再スケールする。
      生成動画は背景の緑がフレーム間でドリフトする（緑優勢度 99 → 89 程度）。基準を1フレームで固定すると
      背景全体が薄い緑の霞になる。背景色はフレームごとに測るのが基本で、この床は取りこぼしの保険。
    """
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dbg = float(bg[1] - max(bg[0], bg[2]))
    if dbg < 20:
        raise SystemExit(f"[ERR] 背景が緑に見えない（緑優勢度 {dbg:.1f}）。グリーンバック画像か確認して")

    d = g - np.maximum(r, b)
    alpha = 1.0 - np.clip(d / dbg, 0.0, 1.0)
    if alpha_floor > 0:
        alpha = np.clip((alpha - alpha_floor) / (1.0 - alpha_floor), 0.0, 1.0)

    # アンプリマルチプライ（α が小さいほど誤差が暴れるので下限で守る）
    a = np.clip(alpha, 1e-3, 1.0)[..., None]
    fg = (rgb - (1.0 - a) * bg) / a

    # 残った緑かぶりだけ穏やかに抑える（引き算ではなく上限クランプ＝暗くしない）
    mx = np.maximum(fg[..., 0], fg[..., 2])
    over = np.maximum(fg[..., 1] - mx, 0.0)
    fg[..., 1] -= over * 0.85

    fg = np.clip(fg, 0, 255)

    if drop_islands:
        solid = alpha > 0.35
        lab, n = ndimage.label(solid)
        if n > 1:
            sizes = ndimage.sum(solid, lab, range(1, n + 1))
            big = sizes.max()
            drop = np.zeros(n + 1, dtype=bool)
            for i, s in enumerate(sizes, start=1):
                if s < big * 0.005:
                    drop[i] = True
            alpha = np.where(drop[lab], 0.0, alpha)

    return fg.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)


def key_file(src: str, dst: str, quiet: bool = False) -> float:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    bg = sample_bg(rgb)
    fg, a8 = key(rgb, bg)
    Image.fromarray(np.dstack([fg, a8]), 'RGBA').save(dst)
    cov = float((a8 > 10).mean())
    if not quiet:
        print(f"[key] bg={tuple(int(v) for v in bg)} 緑優勢度={bg[1]-max(bg[0],bg[2]):.0f} / 不透明率={cov*100:.1f}%")
    return cov


if __name__ == '__main__':
    import sys
    key_file(sys.argv[1], sys.argv[2])
