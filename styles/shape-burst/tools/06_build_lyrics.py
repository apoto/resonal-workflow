#!/usr/bin/env python3
"""06_build_lyrics.py — 下のフレーズ表から input/lyrics.json を生成する。

方針:
  - 文言は歌詞の正典から手で写す。whisper の認識語は空耳が混じるので使わない。
  - 秒は whisper 実測。--words に 01_transcribe.sh の JSON を渡すと、各フレーズの t を
    最寄りの word オンセットへ吸着する（セグメント境界だけで割ると分割点がズレるため）。
  - shape-burst は短いスナップの畳み掛け＝1セグメントを2フレーズに割ることが多い。
  - フォントサイズは行幅から自動計算（PhraseView は nowrap なので、長い行を固定サイズで置くとはみ出す）。
  - 下の表と DURATION / BPM はダミー。

Usage: python3 tools/06_build_lyrics.py [--words input/audio_16k.json]
出力: input/lyrics.json
"""

from __future__ import annotations

import argparse
import bisect
import json
import unicodedata
from pathlib import Path

FPS = 30
DURATION = 60.0
BPM = 174

# ---------------------------------------------------------------------------
# フレーズ表: (t, hold, text, flags)
#   flags: 'd'=drop(特大＋強色収差/サビ) 'c'=cold(低体温Verse＝薄い色収差) 'e'=english
# ---------------------------------------------------------------------------
P: list[tuple[float, float, str, str]] = [
    # ---- Verse ----
    (0.50, 1.80, "Sample line one", "ce"),
    (2.40, 1.80, "sample line two", "ce"),
    (4.30, 1.60, "サンプルの歌詞", "c"),
    (6.00, 2.00, "short line", "ce"),
    (8.00, 1.90, "サンプル その二", "c"),
    # ---- Pre-Chorus ----
    (10.00, 1.30, "build up", "e"),
    (11.40, 1.30, "build up", "e"),
    (12.70, 1.30, "ビルドアップ", ""),
    # ---- Chorus ----
    (14.00, 1.40, "SAMPLE HOOK", "de"),
    (15.40, 1.60, "サビの一行目", "d"),
    (17.00, 1.40, "SAMPLE HOOK", "de"),
    (18.40, 1.60, "サビの二行目", "d"),
    (20.00, 1.80, "last chorus line", "de"),
    # ---- 22-26 は器楽＝クレジット枠（歌詞を置かない）----
    # ---- Verse 2 ----
    (26.00, 2.00, "Sample line three", "ce"),
    (28.00, 1.90, "サンプル その三", "c"),
    # ---- Pre-Chorus 2 ----
    (30.00, 1.90, "build again", "e"),
    (32.00, 1.90, "もう一度", ""),
    # ---- Post-Chorus ----
    (36.00, 1.00, "one, two", "de"),
    (37.00, 1.00, "one, two", "de"),
    # ---- 落ちサビ ----
    (38.50, 2.80, "quiet sample line", "ce"),
    (41.30, 2.60, "静かな一行", "c"),
    # ---- Final Chorus ----
    (44.00, 1.40, "SAMPLE HOOK", "de"),
    (45.40, 1.60, "サビの一行目", "d"),
    (47.00, 1.40, "SAMPLE HOOK", "de"),
    (48.40, 1.60, "サビの二行目", "d"),
    # ---- Outro ----
    (52.00, 2.00, "Sample outro", "e"),
    (54.00, 2.00, "おしまい", ""),
]


def visual_width(text: str) -> float:
    """行の見た目の幅（em単位）。全角=1.0 / 半角=0.55 で概算。"""
    w = 0.0
    for ch in text:
        if ch == " ":
            w += 0.35
            continue
        ea = unicodedata.east_asian_width(ch)
        w += 1.0 if ea in ("W", "F", "A") else 0.55
    return w


def fit_size(text: str, is_english: bool, is_drop: bool) -> int:
    """画面幅に収まる最大サイズを出す。

    PhraseView は whiteSpace:nowrap ＋ transform:scaleX(0.9)、日本語は jpBoost 1.08。
    実効の1文字あたり幅 ≒ size * 0.9 * (1.08 if JP else 1.0)。
    安全幅 = 1920 * 0.86（左右に余白を残す）。
    """
    boost = 1.0 if is_english else 1.08
    per_em = 0.9 * boost
    safe = 1920 * 0.86
    w = visual_width(text)
    max_size = safe / max(0.5, w * per_em)
    want = 210 if is_drop else 140  # 見せたい基準サイズ（drop は殴る）
    return int(max(64, min(want, max_size)))


def load_onsets(path: Path) -> list[float]:
    """whisper JSON の word オンセット（重複除去・昇順）。"""
    d = json.loads(path.read_text())
    return sorted({round(w["start"], 3) for s in d["segments"] for w in s.get("words", [])})


def snap_times(phrases: list[dict], onsets: list[float], tol: float = 0.7) -> list[tuple]:
    """各フレーズの t を最寄りの word オンセットへ吸着する（tol 以内のときだけ）。"""
    changes = []
    for ph in phrases:
        t = ph["t"]
        i = bisect.bisect_left(onsets, t)
        cands = [onsets[j] for j in (i - 1, i, i + 1) if 0 <= j < len(onsets)]
        if not cands:
            continue
        near = min(cands, key=lambda o: abs(o - t))
        if abs(near - t) <= tol and near != t:
            changes.append((t, near, ph["text"]))
            ph["t"] = round(near, 3)
    return changes


def refill_holds(phrases: list[dict], max_fill: float = 3.5, end: float = DURATION) -> None:
    """hold を「次のフレーズが出るまで」に伸ばす（ハードカットで間を空けない）。

    間隔が max_fill を超える所＝器楽区間なので、そこは元の hold を保って画面を空ける。
    """
    for i, ph in enumerate(phrases):
        nxt = phrases[i + 1]["t"] if i + 1 < len(phrases) else end
        gap = nxt - ph["t"]
        ph["hold"] = round(gap if gap <= max_fill else min(ph["hold"], max_fill), 3)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", type=Path, help="whisper の JSON（word_timestamps 付き）")
    args = ap.parse_args()

    phrases = []
    for i, (t, hold, text, fl) in enumerate(P):
        is_drop = "d" in fl
        is_en = "e" in fl
        p: dict = {
            "t": round(t, 3),
            "hold": round(hold, 3),
            "text": text,
            "size": fit_size(text, is_en, is_drop),
            "tilt": round((-1.0 if i % 2 else 1.0) * (1.1 + (i % 3) * 0.25), 2),
        }
        if is_drop:
            p["drop"] = True
        if is_en:
            p["english"] = True
        if "c" in fl:
            p["cold"] = True
        phrases.append(p)

    if args.words:
        changes = snap_times(phrases, load_onsets(args.words))
        print(f"[snap] word オンセットへ吸着: {len(changes)} 件（|Δ|>0.1s のみ表示）")
        for a, b, tx in sorted(changes, key=lambda c: -abs(c[1] - c[0])):
            if abs(b - a) > 0.1:
                print(f"        {b - a:+.3f}s  {a:7.2f} → {b:7.2f}  {tx}")
    phrases.sort(key=lambda x: x["t"])
    refill_holds(phrases)

    for a, b in zip(phrases, phrases[1:]):
        if a["t"] + a["hold"] > b["t"] + 1e-6:
            raise SystemExit(f"[ERR] 重なり: {a['text']!r} > {b['text']!r}")

    out = Path(__file__).resolve().parent.parent / "input" / "lyrics.json"
    meta: dict = {
        "duration": DURATION, "fps": FPS, "width": 1920, "height": 1080,
        "audio": "audio.wav", "bgColor": "#fff2f7", "bpm": BPM, "timingOffsetSec": 0,
        "bg": "bg.png", "bgVertical": "bg_vertical.png",
    }
    # 既存の lyrics.json にある素材の配線（tools/sync_plates.sh が書く）は引き継ぐ
    if out.exists():
        old = json.loads(out.read_text()).get("meta", {})
        for k in ("bgFar", "bgFarVertical", "charPlates", "charSeqs", "charCloseup", "thumbTitle"):
            if k in old:
                meta[k] = old[k]
    data = {"meta": meta, "phrases": phrases}
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"[ok] {out}  phrases={len(phrases)}")


if __name__ == "__main__":
    main()
