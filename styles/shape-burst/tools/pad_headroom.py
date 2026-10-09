#!/usr/bin/env python3
"""透過プレートの頭上に余白を足す（Stage.tsx の顔アップ構図 FACE_* で拡大しても頭が切れないようにする）。

画像生成は「頭上に余白を」と指示しても枠いっぱいに描くことがあるので、後処理で確実に作る。
キー済みRGBAを縮小して、上に指定%の空きがある位置へ貼り直す（キャンバスサイズは変えない）。

Usage: pad_headroom.py <in.png> <out.png> [余白%=12]
"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
pad = float(sys.argv[3]) if len(sys.argv) > 3 else 12.0

im = Image.open(src).convert('RGBA')
W, H = im.size
a = np.asarray(im)[..., 3]

# 実体のある上端（行の不透明画素が幅の0.5%以上ある最初の行）＝細い突起も拾う
rows = (a > 150).sum(axis=1)
top = int(np.argmax(rows > W * 0.005))

scale = 1.0 - pad / 100.0
newW, newH = int(round(W * scale)), int(round(H * scale))
small = im.resize((newW, newH), Image.LANCZOS)

canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
# 縮小後の実体上端が、キャンバスの pad% の位置に来るように置く
oy = int(round(H * pad / 100.0)) - int(round(top * scale))
ox = (W - newW) // 2
canvas.alpha_composite(small, (ox, max(0, oy)))
canvas.save(dst)

# 検証
b = np.asarray(canvas)[..., 3]
rows2 = (b > 150).sum(axis=1)
top2 = int(np.argmax(rows2 > W * 0.005))
print(f"[pad] {src} 実体上端 {top/H*100:.1f}% → {dst} {top2/H*100:.1f}% (目標 {pad:.0f}%) / 縮小 {scale:.2f}")
