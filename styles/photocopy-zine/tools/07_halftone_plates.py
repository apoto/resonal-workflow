#!/usr/bin/env python3
"""07_halftone_plates.py — プレート画像を「あらかじめ網点化」して書き出す。

なぜ焼くか:
  CSS で「スクリーン固定のドット格子 × 動く画像」を毎フレーム合成すると、
  紙が1px動くだけで全ドットが計算し直され＝全画面が新しい絵になり、書き出しが極端に重くなる。
  網点を画像に焼けば、紙の動き＝単なる平行移動になり x264 の動きベクトルで安く済む。
  本物の網点は紙に刷られているので、紙と一緒に動くのが物理的にも正しい。

方式: クラスタードット型の閾値マトリクス（新聞・コピー機と同じ「点が太る」網点）。
  - セル中心からの距離を閾値にする＝暗いほどドットが太る
  - スクリーン角 15°（印刷の定石。0°だと格子が目立つ）
  - 2倍で作ってから縮小＝アンチエイリアスが乗って印刷らしくなる

入力: public/plate_a.png 等（PLATES のリスト。1920x1080 推奨）
出力: public/ht/<plate>_<level>.png（白地・黒ドット。Remotion 側は multiply で紙に重ねるだけ）
使い方: python3 tools/07_halftone_plates.py [plate_a plate_b ...]（要 numpy / Pillow）
"""
from __future__ import annotations
import math, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "public"
OUT = ROOT / "public" / "ht"
OUT.mkdir(parents=True, exist_ok=True)

PLATES = ["plate_a", "plate_a2", "plate_b", "plate_c", "plate_d"]
# 劣化レベル（Stage 側でこの中の最も近いものへスナップする）
LEVELS = [0.10, 0.25, 0.40, 0.55, 0.70, 0.88]

W, H = 1920, 1080
SS = 2  # スーパーサンプリング倍率
ANGLE = 15.0  # スクリーン角


def threshold_field(w: int, h: int, cell: float, angle_deg: float) -> np.ndarray:
    """クラスタードットの閾値場（0..1）。セル中心=0（先に黒くなる）／セル隅=1。"""
    a = math.radians(angle_deg)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    # 回転座標系でセルに折り返す
    u = (xs * math.cos(a) + ys * math.sin(a)) / cell
    v = (-xs * math.sin(a) + ys * math.cos(a)) / cell
    du = (u % 1.0) - 0.5
    dv = (v % 1.0) - 0.5
    r = np.sqrt(du * du + dv * dv) / 0.7071  # セル対角で1になるよう正規化
    return np.clip(r, 0.0, 1.0)


def tone_curve(gray: np.ndarray, bright: float, contrast: float) -> np.ndarray:
    """Remotion 側で当てていた brightness/contrast と同じ絵作りを再現する。"""
    g = gray * bright
    g = (g - 0.5) * contrast + 0.5
    return np.clip(g, 0.0, 1.0)


def render(plate: str, degrade: float) -> Image.Image:
    img = Image.open(SRC / f"{plate}.png").convert("L").resize((W * SS, H * SS), Image.LANCZOS)
    gray = np.asarray(img, dtype=np.float32) / 255.0

    # ここは Paper.tsx の Halftone と同じ意味の係数（見た目を変えないため）
    bright = 1.13 + degrade * 0.12
    contrast = 1.15 - degrade * 0.16
    cell = (6.0 + degrade * 3.5) * SS

    g = tone_curve(gray, bright, contrast)
    th = threshold_field(W * SS, H * SS, cell, ANGLE)

    # 明るいほど閾値を超えやすい＝白。暗いほどドットが太る。
    ink = (g < th).astype(np.float32)  # 1=インク
    # 劣化するほど中間調が飛んで2値に寄る＝ドットのエッジを硬くする
    out = 1.0 - ink
    arr = (out * 255).astype(np.uint8)
    im = Image.fromarray(arr, mode="L").resize((W, H), Image.LANCZOS)
    return im.convert("RGB")


def main():
    only = sys.argv[1:] or PLATES
    n = 0
    for p in only:
        for lv in LEVELS:
            im = render(p, lv)
            name = f"{p}_{int(round(lv * 100)):02d}.png"
            im.save(OUT / name, optimize=True)
            n += 1
            print(f"  {name}  {(OUT / name).stat().st_size / 1024:.0f} KB")
    print(f"[ok] {n} 枚 → {OUT}")


if __name__ == "__main__":
    main()
