#!/usr/bin/env python3
"""06_build_lyrics.py — 下の表（秒・文言・レイアウト）から input/lyrics.json を組む。

- 文言は歌詞の正典を手で写す。秒は whisper などの word オンセット実測を写す（等分で置かない）。
- 韻を踏んでいる行は1語ずつ分けて出すとメリハリが出る。
- 同じ韻のまとまりには `grp` を振る。同じ grp の行は画面上で階段状に並ぶ＝「ひと組」に見える。
- hold は「次の行が出るまで」＝重なりゼロ（ハードカット）。
- 下の値はダミー。
"""
import json, pathlib

FPS = 30
DURATION = 60.0
BPM = 150.0
FIRST_BEAT = 0.0

# (秒, テキスト, レイアウト, オプション)
#   layout: line / stamp / strip / small / tower
#   opt の grp = 韻のまとまり名 / gi = そのまとまりの中の順番 / gn = まとまりの総数
#   scale = 倍率 / accent = "amber"（差し色）
L = [
    (18.0, "Sample line one", "line", {}),
    (20.0, "sample line two", "line", {}),
    (22.0, "Same one", "line", {"grp": "a", "gi": 0, "gn": 3}),
    (22.8, "same two", "line", {"grp": "a", "gi": 1, "gn": 3}),
    (23.6, "same three", "line", {"grp": "a", "gi": 2, "gn": 3}),
    (24.4, "small note", "small", {}),
    (26.0, "SAMPLE TITLE", "stamp", {}),
    (28.0, "Sample line three", "line", {"accent": "amber"}),
    (30.0, "Kick", "strip", {"grp": "b", "gi": 0, "gn": 3}),
    (30.8, "stamp", "strip", {"grp": "b", "gi": 1, "gn": 3}),
    (31.6, "count", "strip", {"grp": "b", "gi": 2, "gn": 3}),
    (34.0, "Again", "tower", {"grp": "c", "gi": 0, "gn": 4}),
    (35.0, "again", "tower", {"grp": "c", "gi": 1, "gn": 4}),
    (36.0, "again", "tower", {"grp": "c", "gi": 2, "gn": 4}),
    (37.0, "again", "tower", {"grp": "c", "gi": 3, "gn": 4}),
    (40.0, "SAMPLE TITLE", "stamp", {}),
    (42.0, "Sample line four", "line", {}),
    (45.0, "SAMPLE END", "stamp", {"accent": "amber"}),
]

MAX_HOLD = 3.0


def build():
    out = []
    for i, (t, text, layout, opt) in enumerate(L):
        nxt = L[i + 1][0] if i + 1 < len(L) else t + 3.0
        gap = nxt - t - 0.02
        hold = max(0.30, min(MAX_HOLD, gap) if gap > 0 else 0.4)
        item = {"t": round(t, 2), "hold": round(hold, 2), "text": text, "layout": layout}
        item.update(opt)
        out.append(item)

    data = {
        "meta": {
            "duration": DURATION,
            "fps": FPS,
            "width": 1920,
            "height": 1080,
            "audio": "audio.wav",
            "bpm": BPM,
            "firstBeat": FIRST_BEAT,
            "timingOffsetSec": 0,
        },
        "lyrics": out,
    }
    p = pathlib.Path(__file__).resolve().parents[1] / "input" / "lyrics.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] {p}  lines={len(out)}")
    bad = 0
    for i in range(len(out) - 1):
        if out[i]["t"] + out[i]["hold"] > out[i + 1]["t"] + 1e-6:
            print("  重なり:", out[i]["text"], "→", out[i + 1]["text"]); bad += 1
    short = [o for o in out if o["hold"] < 0.33]
    print(f"  重なり: {bad} 件 / 極短(<0.33s): {len(short)} 件")


if __name__ == "__main__":
    build()
