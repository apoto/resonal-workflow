#!/usr/bin/env python3
"""08_thumbprint.py — 親指の指紋（黒インク・背景透過）を生成する。

タイトルカードに押される指紋。写真から切り抜くとマットが汚いので、隆線をプログラムで描く。
指は描かず、指紋だけを押し込みの動き（潰れて戻る／圧の暈／インクのにじみ）で「押された」と読ませる前提の素材。

出力:
  public/thumbprint.png  — 押された指紋（紙に残る版・中心ほど濃い＝圧のかかり方）
"""
from __future__ import annotations
import math, pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public"
W, H = 900, 1180
SS = 2


def ridge_field(w: int, h: int) -> np.ndarray:
    """ループ型の指紋（隆線）。0..1 で 1=インク。"""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.5, h * 0.52
    x = (xs - cx) / (w * 0.5)
    y = (ys - cy) / (h * 0.5)

    # 芯（core）を少し上にずらした楕円座標＋うねり＝ループ紋
    r = np.sqrt((x * 1.25) ** 2 + ((y - 0.10) * 0.92) ** 2)
    th = np.arctan2(y - 0.10, x * 1.25)
    warp = 0.16 * np.sin(th * 1.0) + 0.09 * np.sin(th * 2.0 + 1.1)
    # デルタ（三角州）側の流れ
    delta = 0.10 * np.exp(-((x + 0.62) ** 2 + (y - 0.42) ** 2) / 0.10)

    phase = (r + warp + delta) * 30.0
    ridges = 0.5 + 0.5 * np.sin(phase * 2 * math.pi)
    ink = (ridges > 0.55).astype(np.float32)

    # 隆線の途切れ（本物の指紋は連続しない）＋インクのムラ
    rng = np.random.default_rng(7)
    n = rng.random((h // 6 + 1, w // 6 + 1)).astype(np.float32)
    n = np.array(Image.fromarray((n * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
    ink *= (n > 0.22).astype(np.float32)
    return ink


def pad_mask(w: int, h: int, soft: float) -> np.ndarray:
    """親指の腹の形（縦長の卵形）。押しつけたので下側が少し潰れている。"""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    x = (xs - w * 0.5) / (w * 0.46)
    y = (ys - h * 0.50) / (h * 0.47)
    y = np.where(y > 0, y * 0.92, y)  # 下を少し潰す
    d = np.sqrt(x ** 2 + y ** 2)
    m = np.clip((1.0 - d) / soft, 0.0, 1.0)
    return m


def save(arr_alpha: np.ndarray, path: pathlib.Path, blur: float = 0.0):
    a = (np.clip(arr_alpha, 0, 1) * 255).astype(np.uint8)
    img = Image.fromarray(a, mode="L").resize((W, H), Image.LANCZOS)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    rgba = Image.new("RGBA", (W, H), (20, 18, 16, 0))
    rgba.putalpha(img)
    rgba.save(path, optimize=True)
    print(f"  {path.name}  {path.stat().st_size // 1024} KB")


def main():
    w, h = W * SS, H * SS
    ink = ridge_field(w, h)
    mask = pad_mask(w, h, soft=0.13)

    # ① 紙に残る指紋＝隆線だけ。**中心ほど濃く縁は掠れる**＝親指を押しつけた圧の分布そのもの。
    #    大きく使うので隆線は少し太めに出す。
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.5, h * 0.5
    rr = np.sqrt(((xs - cx) / (w * 0.5)) ** 2 + ((ys - cy) / (h * 0.5)) ** 2)
    pressure = np.clip(1.30 - rr * 0.85, 0.32, 1.0)
    save(np.clip(ink * mask * pressure * 1.45, 0, 1), OUT / "thumbprint.png", blur=0.5)

    print("[ok] 指紋の版を書き出した")


if __name__ == "__main__":
    main()
