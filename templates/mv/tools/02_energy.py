#!/usr/bin/env python3
"""02_energy.py — 音源から per-frame の駆動信号 input/energy.json を作る（スタイルが VJ 的に使う）。

    { fps, frames, sec: [0..1]*frames, hit: [0..1]*frames }

  sec = セクション強度（ゆっくり動く。Drop で高く / Verse・落ちサビで低く）→ 明るさ・彩度・ストロボ可否など
  hit = 打点（速く動く。キック/スネアの立ち上がり）→ ズームパンチ・ストロボの瞬間発火など

決定的（乱数なし）・依存は ffmpeg だけ:
  1. 16k mono の生 PCM で読む  2. フレームごとに RMS
  3. sec = RMS の長窓（既定 2.5 秒）移動平均 → パーセンタイルで正規化
  4. hit = RMS の正の差分 → 正規化 → 減衰付きピークホールド

Usage:
  02_energy.py <audio.wav|mp3> <out.json> [--fps 30] [--sec-window 2.5]
"""

from __future__ import annotations

import argparse
import array
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

SR = 16000


def read_mono_pcm(path: Path) -> array.array:
    """ffmpeg で 16k mono s16le に落として読む。"""
    if not shutil.which("ffmpeg"):
        sys.exit("[ERR] ffmpeg が無い")
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ar", str(SR), "-ac", "1",
         "-f", "s16le", "-c:a", "pcm_s16le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0:
        sys.exit(f"[ERR] ffmpeg 失敗: {proc.stderr.decode()[:400]}")
    a = array.array("h")
    a.frombytes(proc.stdout)
    return a


def percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    i = min(len(sorted_vals) - 1, max(0, int(round(q * (len(sorted_vals) - 1)))))
    return sorted_vals[i]


def normalize(vals: list[float], lo_q: float, hi_q: float) -> list[float]:
    """下位/上位パーセンタイルで挟んで 0..1 に伸ばす（外れ値で潰れないように）。"""
    s = sorted(vals)
    lo, hi = percentile(s, lo_q), percentile(s, hi_q)
    if hi - lo < 1e-9:
        return [0.0] * len(vals)
    return [min(1.0, max(0.0, (v - lo) / (hi - lo))) for v in vals]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--sec-window", type=float, default=2.5,
                    help="sec（セクション強度）の移動平均窓・秒")
    args = ap.parse_args()

    pcm = read_mono_pcm(Path(args.audio))
    total_sec = len(pcm) / SR
    fps = args.fps
    frames = int(math.ceil(total_sec * fps))
    hop = SR / fps  # 1フレーム分のサンプル数

    # ---- ① フレームごとの RMS ----
    rms: list[float] = []
    for f in range(frames):
        a = int(f * hop)
        b = min(len(pcm), int((f + 1) * hop))
        if b <= a:
            rms.append(0.0)
            continue
        acc = 0
        for i in range(a, b):
            v = pcm[i]
            acc += v * v
        rms.append(math.sqrt(acc / (b - a)) / 32768.0)

    # ---- ② sec = 長い窓の移動平均 → 正規化 ----
    w = max(1, int(args.sec_window * fps))
    half = w // 2
    prefix = [0.0]
    for v in rms:
        prefix.append(prefix[-1] + v)
    smooth = []
    for f in range(frames):
        a = max(0, f - half)
        b = min(frames, f + half + 1)
        smooth.append((prefix[b] - prefix[a]) / (b - a))
    # 下 8% / 上 96% で伸ばす（落ちサビの静けさを 0 付近に落とし、Drop を 1 に張らせる）
    sec = normalize(smooth, 0.08, 0.96)

    # ---- ③ hit = RMS の正の差分（オンセット）→ 正規化 → ピークホールド減衰 ----
    diff = [0.0]
    for f in range(1, frames):
        diff.append(max(0.0, rms[f] - rms[f - 1]))
    hit_raw = normalize(diff, 0.55, 0.995)
    hit: list[float] = []
    prev = 0.0
    decay = 0.62  # 1フレームごとの減衰（打点を数フレーム保たせて見える打点にする）
    for v in hit_raw:
        cur = max(v, prev * decay)
        hit.append(cur)
        prev = cur

    out = {
        "fps": fps,
        "frames": frames,
        "sec": [round(v, 4) for v in sec],
        "hit": [round(v, 4) for v in hit],
    }
    Path(args.out).write_text(json.dumps(out, separators=(",", ":")))

    # ---- サマリ（目で構造が見えるように）----
    print(f"[ok] {args.out}  fps={fps} frames={frames} ({total_sec:.2f}s)")
    print("  10秒ごとの sec（セクション強度）:")
    step = fps * 10
    for f in range(0, frames, step):
        v = sec[f]
        bar = "#" * int(round(v * 40))
        print(f"    {f/fps:6.1f}s {v:.2f} {bar}")


if __name__ == "__main__":
    main()
