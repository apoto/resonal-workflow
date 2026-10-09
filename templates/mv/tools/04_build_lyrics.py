#!/usr/bin/env python3
"""04_build_lyrics.py — LYRICS.md（文言の正典）× whisper 実測（秒）→ input/lyrics.json

  Usage: python3 tools/04_build_lyrics.py <song_dir> [--allow-unaligned] [--min-ratio 0.4] [--fps 30]

入力
  <song>/LYRICS.md                「## 歌詞（表示用）」節の1行＝画面の1フレーズ（無ければ最初の「## …歌詞…」節）。
                                  「## 歌詞（かな版）」節が同じ行数ならそれも対応付けに使う（whisper がかなで返した行に効く）。
                                  行末に {drop} のように書くとその行の pattern になる（既定 verse）。
                                  # > [ （ ( ``` - * | で始まる行は見出し・注記として無視（``` の囲みの中身は歌詞として読む）。
  <song>/transcribe/audio_16k.json  01_transcribe.sh の whisper 出力（word timestamps 必須）。

やること
  1. 歌詞と whisper の文字列を正規化（NFKC・小文字・カタカナ→ひらがな・記号除去）して文字単位で対応付け
     （difflib は順序を保つ＝繰り返すサビも前から順に当たる）。文言は whisper を使わない＝空耳が混じるため。
  2. 各行の開始＝対応した最初の文字の時刻。最寄りの word オンセットへ吸着（0.7 秒以内のときだけ）。
  3. hold を「次の行まで」に伸ばす。ただし間隔が 3.5 秒超＝間奏なので元の長さ（上限 3.5 秒）で切って画面を空ける。
  4. 行幅から字幕の上限サイズ maxSize を計算（style は size をこれで頭打ちにする＝nowrap の字幕がはみ出さない）。
  5. 行どうしの重なりを検査。

対応付けが取れない行（一致率が --min-ratio 未満・時刻が前の行より戻る）があれば一覧を出して非0で終わる
（lyrics.json は書かない）。--allow-unaligned を付けると前後の行から比例配分して書き、目視・耳での調整に回す。
"""
from __future__ import annotations

import argparse
import bisect
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

PROJ = Path(__file__).resolve().parent.parent

PATTERNS = {"title", "verse", "whisper", "drop", "hud", "break", "slam", "cut", "end"}
SKIP_PREFIX = re.compile(r"^([#>\[（(]|```|[-*] |\|)")
SNAP_TOL = 0.7        # 吸着する最大距離（秒）。これ以上離れたオンセットは別の語
MAX_FILL = 3.5        # これより長い間隔は間奏＝字幕を出しっぱなしにしない
COMP_16 = 1920        # 本編の幅
COMP_9 = 1080         # 縦ショートの幅
SHORT_SCALE = 0.82    # 縦ショートの字幕倍率（lyrics.json の meta.shortScale で src に渡す）
SAFE = 0.86           # 画面幅のうち字幕に使ってよい割合（左右に余白）
LINE_GAP = 3.0       # 1行の中で文字の間がこれ以上空いたら別の箇所への一致とみなす
FLOOR = 64            # これを下回るなら行が長すぎる＝LYRICS.md で行を割る


# ---------------------------------------------------------------------------
# LYRICS.md
# ---------------------------------------------------------------------------
def section(md: str, pred) -> list[str] | None:
    lines = md.splitlines()
    for i, l in enumerate(lines):
        if l.startswith("## ") and pred(l):
            body = []
            for m in lines[i + 1:]:
                if m.startswith("## "):
                    break
                body.append(m)
            return body
    return None


def lyric_lines(body: list[str]) -> list[str]:
    # ``` の囲みは書式だけ＝中身は歌詞として読む
    out = []
    for raw in body:
        l = raw.strip()
        if not l or SKIP_PREFIX.match(l):
            continue
        out.append(l)
    return out


def parse_line(l: str) -> tuple[str, str]:
    m = re.search(r"\s*\{(\w+)\}\s*$", l)
    if not m:
        return l, "verse"
    pat = m.group(1)
    if pat not in PATTERNS:
        sys.exit(f"[ERR] 不明な pattern {{{pat}}}: {l!r}（使えるのは {', '.join(sorted(PATTERNS))}）")
    return l[: m.start()].rstrip(), pat


# ---------------------------------------------------------------------------
# 正規化と対応付け
# ---------------------------------------------------------------------------
def norm(s: str) -> str:
    out = []
    for ch in unicodedata.normalize("NFKC", s).lower():
        if "ァ" <= ch <= "ヶ":
            ch = chr(ord(ch) - 0x60)
        if unicodedata.category(ch)[0] in ("L", "N"):
            out.append(ch)
    return "".join(out)


def whisper_chars(words: list[dict]) -> tuple[str, list[tuple[float, float, float]]]:
    """whisper の語を文字に展開。各文字に (文字の推定時刻, 語の開始, 語の終了)。"""
    s, meta = [], []
    for w in words:
        c = norm(w["word"])
        a, b = float(w["start"]), float(w["end"])
        for j, ch in enumerate(c):
            s.append(ch)
            meta.append((a + (b - a) * j / max(1, len(c)), a, b))
    return "".join(s), meta


def cluster(h: list[tuple[int, int]], wmeta) -> list[tuple[int, int]]:
    """1行の一致を時間で塊に分け、最大の塊だけ残す（遠く離れた別の箇所への偶然の一致を捨てる）。"""
    if not h:
        return h
    groups, cur = [], [h[0]]
    for x in h[1:]:
        if wmeta[x[1]][0] - wmeta[cur[-1][1]][0] > LINE_GAP:
            groups.append(cur)
            cur = []
        cur.append(x)
    groups.append(cur)
    return max(groups, key=len)


def align(texts: list[str], wstr: str, wmeta) -> list[dict | None]:
    """行ごとに {t, end, ratio} を返す。対応が取れない行は None。"""
    lstr, owner = [], []
    for i, t in enumerate(texts):
        c = norm(t)
        lstr.append(c)
        owner += [i] * len(c)
    lstr = "".join(lstr)
    sm = difflib.SequenceMatcher(None, lstr, wstr, autojunk=False)
    hit: dict[int, list[tuple[int, int]]] = {}
    lens = [len(norm(t)) for t in texts]
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            i = owner[a + k]
            # 1文字だけの一致は偶然が多い＝短い行以外では数えない
            if n >= 2 or lens[i] <= 3:
                hit.setdefault(i, []).append((a + k, b + k))
    starts, pos = [], 0
    for L in lens:
        starts.append(pos)
        pos += L
    res: list[dict | None] = []
    for i, L in enumerate(lens):
        h = cluster(hit.get(i, []), wmeta)
        if not L or not h:
            res.append(None)
            continue
        (la, wa), (_, wb) = h[0], h[-1]
        # 行頭が一致していないときは、欠けた文字数ぶん手前へ戻す（1文字あたりの秒は一致区間から推定）
        span = h[-1][0] - la
        per = (wmeta[wb][0] - wmeta[wa][0]) / span if span > 0 else 0.15
        miss = la - starts[i]
        t0 = wmeta[wa][1] if miss == 0 else wmeta[wa][0] - miss * per
        res.append({"t": max(0.0, t0), "end": wmeta[wb][2], "ratio": len(h) / L})
    return res


# ---------------------------------------------------------------------------
# 秒の仕上げ（吸着 / hold 埋め）とサイズ
# ---------------------------------------------------------------------------
def snap_times(phrases: list[dict], onsets: list[float], tol: float = SNAP_TOL) -> list[tuple]:
    changes = []
    for ph in phrases:
        if ph.get("_interp"):
            continue
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


def refill_holds(phrases: list[dict], end: float, max_fill: float = MAX_FILL) -> None:
    for i, ph in enumerate(phrases):
        nxt = phrases[i + 1]["t"] if i + 1 < len(phrases) else end
        gap = nxt - ph["t"]
        ph["hold"] = round(gap if gap <= max_fill else min(ph["hold"], max_fill), 3)


def visual_width(text: str) -> float:
    """行の見た目の幅（em）。全角=1.0 / 半角=0.55 / 空白=0.35 で概算。"""
    w = 0.0
    for ch in text:
        if ch == " ":
            w += 0.35
            continue
        w += 1.0 if unicodedata.east_asian_width(ch) in ("W", "F", "A") else 0.55
    return w


def max_size(text: str) -> int:
    """本編と縦ショートの両方で画面幅の SAFE に収まる最大 px（縦は SHORT_SCALE 倍で描かれる）。"""
    w = max(0.5, visual_width(text))
    return int(min(COMP_16 * SAFE / w, COMP_9 * SAFE / (w * SHORT_SCALE)))


def audio_duration(song: Path, title: str) -> float:
    for c in (song / f"{title}.wav", song / "audio.wav", song / "transcribe" / "audio_16k.wav"):
        if c.exists() and c.stat().st_size > 0:
            p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(c)],
                               capture_output=True, text=True)
            try:
                return round(float(p.stdout.strip()), 3)
            except ValueError:
                pass
    sys.exit(f"[ERR] 尺を測れる音源が無い（{title}.wav / audio.wav / transcribe/audio_16k.wav）")


# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="LYRICS.md × whisper → input/lyrics.json")
    ap.add_argument("song_dir")
    ap.add_argument("--allow-unaligned", action="store_true", help="対応付けできない行を比例配分で書く")
    ap.add_argument("--min-coverage", type=float, default=0.6, help="対応付けできた行の割合がこれ未満なら止める（既定 0.6）")
    ap.add_argument("--min-ratio", type=float, default=0.4, help="行の文字のうち whisper と一致した割合の下限")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=str(PROJ / "input" / "lyrics.json"))
    a = ap.parse_args()

    song = Path(a.song_dir).resolve()
    sj = {}
    if (song / "song.json").exists():
        sj = json.loads((song / "song.json").read_text(encoding="utf-8"))
    title = sj.get("title") or re.sub(r"^\d{6}_", "", song.name)

    md_path = song / "LYRICS.md"
    if not md_path.exists():
        sys.exit(f"[ERR] {md_path} が無い")
    md = md_path.read_text(encoding="utf-8")
    disp = section(md, lambda h: "表示用" in h) or section(md, lambda h: "歌詞" in h or "lyrics" in h.lower())
    if disp is None:
        sys.exit("[ERR] LYRICS.md に「## 歌詞（表示用）」節が無い")
    parsed = [parse_line(l) for l in lyric_lines(disp)]
    if not parsed:
        sys.exit("[ERR] 「## 歌詞（表示用）」節に歌詞の行が無い")
    texts = [t for t, _ in parsed]
    kana_body = section(md, lambda h: "かな" in h)
    kana = [parse_line(l)[0] for l in lyric_lines(kana_body)] if kana_body else []
    if kana and len(kana) != len(texts):
        print(f"[warn] かな版 {len(kana)} 行 / 表示用 {len(texts)} 行で一致しない＝かな版は対応付けに使わない")
        kana = []

    wj_path = song / "transcribe" / "audio_16k.json"
    if not wj_path.exists():
        sys.exit(f"[ERR] {wj_path} が無い（先に tools/01_transcribe.sh）")
    wj = json.loads(wj_path.read_text(encoding="utf-8"))
    words = [w for s in wj.get("segments", []) for w in s.get("words", []) if norm(w.get("word", ""))]
    if not words:
        sys.exit("[ERR] whisper 出力に word timestamps が無い（--word_timestamps True で転写し直す）")
    wstr, wmeta = whisper_chars(words)
    onsets = sorted({round(float(w["start"]), 3) for w in words})

    # ---- ① 対応付け（表示用とかな版の良い方を行ごとに採る）----
    res = align(texts, wstr, wmeta)
    src = ["表示"] * len(texts)
    if kana:
        rk = align(kana, wstr, wmeta)
        for i, r in enumerate(rk):
            if r and (res[i] is None or r["ratio"] > res[i]["ratio"]):
                res[i], src[i] = r, "かな"

    # 一致率の低い行を外す
    bad = []
    for i, r in enumerate(res):
        if r is not None and r["ratio"] < a.min_ratio:
            bad.append((i, "一致率 %.0f%%" % (r["ratio"] * 100)))
            res[i] = None
        elif r is None:
            bad.append((i, "一致なし"))
    # 曲の頭から時刻が増え続ける行の組を最大に残す（繰り返しのサビへの誤一致を1行ずつ捨てる）
    idx = [i for i, r in enumerate(res) if r]
    best = {i: (1, res[i]["ratio"], None) for i in idx}
    for x, i in enumerate(idx):
        for j in idx[:x]:
            if res[j]["t"] < res[i]["t"]:
                cand = (best[j][0] + 1, best[j][1] + res[i]["ratio"], j)
                if cand[:2] > best[i][:2]:
                    best[i] = cand
    keep, cur = set(), (max(idx, key=lambda i: best[i][:2]) if idx else None)
    while cur is not None:
        keep.add(cur)
        cur = best[cur][2]
    for i in idx:
        if i not in keep:
            bad.append((i, f"時刻 {res[i]['t']:.2f}s が前後の行と順番が合わない"))
            res[i] = None
    bad.sort()

    duration = audio_duration(song, title)
    coverage = len(keep) / len(res)
    if bad:
        print(f"[warn] 対応付けできない行が {len(bad)}/{len(res)} 件（前後の行から文字数で割り振る。耳で確認する）:")
        for i, why in bad:
            print(f"     {i + 1:3d}行目 {texts[i]!r}  … {why}")
        if coverage < a.min_coverage and not a.allow_unaligned:
            print(f"[NG] 対応付けできた行が {coverage * 100:.0f}%（基準 {a.min_coverage * 100:.0f}%）。"
                  "LYRICS.md を実際の歌に合わせるか、--allow-unaligned で割り振って耳で直す。lyrics.json は書いていない。")
            sys.exit(1)
        # 前後の対応済み行のあいだを文字数で割り振る（先頭側は 0 秒、末尾側は曲尾を端点にする）
        i = 0
        while i < len(res):
            if res[i]:
                i += 1
                continue
            j = i
            while j < len(res) and res[j] is None:
                j += 1
            lo = res[i - 1]["end"] if i > 0 else 0.0
            hi = res[j]["t"] if j < len(res) else duration
            w = [max(1, len(norm(texts[k]))) for k in range(i, j)]
            acc = 0
            for k in range(i, j):
                t = lo + (hi - lo) * acc / sum(w)
                acc += w[k - i]
                res[k] = {"t": t, "end": lo + (hi - lo) * acc / sum(w), "ratio": 0.0, "_interp": True}
            i = j

    phrases = []
    for i, ((text, pat), r) in enumerate(zip(parsed, res)):
        ms = max_size(text)
        if ms < FLOOR:
            print(f"[warn] {i + 1}行目 {text!r} は長すぎて {ms}px まで縮む（{FLOOR}px 未満）＝LYRICS.md で行を割る")
        ph = {"t": round(r["t"], 3), "hold": round(max(0.6, r["end"] - r["t"] + 0.3), 3),
              "pattern": pat, "text": text, "maxSize": ms}
        ph["_tag"] = "比例配分" if r.get("_interp") else f"{src[i]} {r['ratio'] * 100:3.0f}%"
        if r.get("_interp"):
            ph["_interp"] = True
        phrases.append(ph)

    # ---- ② 吸着 → ③ hold 埋め ----
    changes = snap_times(phrases, onsets)
    phrases.sort(key=lambda p: p["t"])
    refill_holds(phrases, duration)

    # ---- ④ 重なり検査 ----
    for x, y in zip(phrases, phrases[1:]):
        if x["t"] + x["hold"] > y["t"] + 1e-6:
            sys.exit(f"[ERR] 重なり: {x['text']!r} → {y['text']!r}")

    print(f"[snap] word オンセットへ吸着 {len(changes)} 件（|Δ|>0.1s のみ表示）")
    for p0, p1, tx in sorted(changes, key=lambda c: -abs(c[1] - c[0])):
        if abs(p1 - p0) > 0.1:
            print(f"        {p1 - p0:+.3f}s  {p0:7.2f} → {p1:7.2f}  {tx}")
    for ph in phrases:
        ph.pop("_interp", None)
        tag = ph.pop("_tag")
        print(f"  {ph['t']:7.2f}s +{ph['hold']:.2f}  {ph['pattern']:<7} max{ph['maxSize']:>4}px  [{tag}]  {ph['text']}")

    out = Path(a.out)
    meta = {}
    if out.exists():
        try:
            meta = json.loads(out.read_text(encoding="utf-8")).get("meta", {})
        except json.JSONDecodeError:
            pass
    meta.update({"duration": duration, "fps": a.fps, "width": COMP_16, "height": round(COMP_16 * 9 / 16),
                 "audio": meta.get("audio", "audio.wav"), "shortScale": SHORT_SCALE})
    beats = PROJ / "input" / "beats.json"
    if beats.exists():
        try:
            meta["bpm"] = json.loads(beats.read_text())["bpm"]
        except (KeyError, json.JSONDecodeError):
            pass
    out.write_text(json.dumps({"meta": meta, "lines": phrases}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"[ok] {out}  lines={len(phrases)} duration={duration}s" + ("（比例配分の行あり＝耳で確認）" if bad else ""))


if __name__ == "__main__":
    main()
