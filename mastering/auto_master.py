#!/usr/bin/env python3
"""auto_master.py — プラグイン無し（ffmpeg だけ）の自動マスタリング。

premaster（生成音源 or ミックスのバウンス）を渡すと
  ① トーン整形
     - 既定 標準テンプレート: profile の EQ を相対的に当てる（別の曲に寄せない）。profile の既定は workflow.config.json の
       mastering.profile＝streaming なら flat（EQ なし・音色はそのまま）、loud なら neutral（EDM・音ゲー向けの派手めのカーブ）
     - 明示時のみ matchering: --ref の曲へ全帯域で寄せる（matchering は同梱しない＝各自 pip install）
  ② workflow.config.json の mastering（Integrated / True Peak / 48k・24bit）へ着地（ゲイン＋4倍OSリミッターの反復）
  ③ 実測レポート（LUFS / TP / LRA / 帯域 / クリップ）を <曲>/MASTER-REPORT.md に書いて合否判定
出力は候補 <Title>_automaster.wav。--promote で PASS のときだけ <Title>.wav（マスター）に置き換える（候補は残らない）。

Usage:
  auto_master.py <premaster.wav|mp3> [--engine template|matchering] [--profile <name>] [--ref <wav>]
                 [--out <wav>] [--promote] [--force]

  --engine   template（既定）/ matchering（--ref 必須）
  --profile  音色 = flat（EQ なし）| bright | neutral | sub-driven | dark（後ろの4つは EDM 由来の派手めのカーブ）。既定は config
  --ref      matchering の寄せ先 WAV
  --promote  判定 PASS 時に <Title>.wav へ昇格
  --force    「既にマスター済み」ガード・既存マスターの上書き禁止を無視

依存: ffmpeg / ffprobe / node（設定の読み取り）。matchering エンジンのみ `pip install matchering`
（GPL-3.0 のため同梱しない。別の python を使うなら MATCHERING_PYTHON=/path/to/python）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent


# ======================================================================================
# 目標値（workflow.config.json の mastering だけが正本。ここに数値を焼かない）
# ======================================================================================
def load_spec() -> dict:
    p = subprocess.run(["node", str(REPO / "engine" / "config.js"), "mastering"], capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"[ERR] 設定 mastering が読めない（node engine/config.js mastering）:\n{p.stderr}")
    m = json.loads(p.stdout)
    need = ("integratedLufs", "lufsTolerance", "truePeakCeiling", "sampleRate", "bitDepth")
    miss = [k for k in need if not isinstance(m.get(k), (int, float))]
    if miss:
        sys.exit(f"[ERR] workflow.config.json の mastering に数値が無い: {', '.join(miss)}")
    return m


SPEC = load_spec()
# 狙いは目標の 0.2 dB 静かめ側＝窓の中でリミッターの仕事が減り、ダイナミクス（LRA）が残る
TARGET_I = SPEC["integratedLufs"] - 0.2
WINDOW_I = (SPEC["integratedLufs"] - SPEC["lufsTolerance"], SPEC["integratedLufs"] + SPEC["lufsTolerance"])
TARGET_TP = SPEC["truePeakCeiling"]
TARGET_SR = int(SPEC["sampleRate"])
TARGET_BITS = int(SPEC["bitDepth"])
# 既にマスター済みの入力を弾く（二重にリミッターを掛けると潰れる）。-11 より静かな源は生成音源として通す
MASTERED_ABOVE = max(SPEC["integratedLufs"] - 2.5, -11.0)
LRA_FLOOR = 3.0      # これ未満まで削れていたら潰しすぎの疑い（premaster から 1 LU 超削ったときだけ見る）
OVERSAMPLE = 4       # リミッターをこの倍率で回してインターサンプルピークを掴む（等倍だと TP が漏れる）


# ======================================================================================
# 計測
# ======================================================================================
def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def ffprobe_info(path: Path) -> dict:
    p = run(["ffprobe", "-v", "quiet", "-select_streams", "a:0", "-show_entries",
             "stream=sample_rate,bits_per_raw_sample,channels,codec_name",
             "-show_entries", "format=duration", "-of", "json", str(path)])
    d = json.loads(p.stdout or "{}")
    st = (d.get("streams") or [{}])[0]
    return {
        "sr": int(st.get("sample_rate") or 0),
        "bits": int(st.get("bits_per_raw_sample") or 0),
        "channels": int(st.get("channels") or 0),
        "codec": st.get("codec_name") or "?",
        "duration": float((d.get("format") or {}).get("duration") or 0.0),
    }


def loudness(path: Path) -> dict:
    """ebur128 で Integrated / LRA / True Peak を実測する。"""
    out = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
               "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"]).stderr

    def grab(pattern: str, after: str) -> float | None:
        idx = out.find(after)
        if idx < 0:
            return None
        m = re.search(pattern, out[idx:])
        return float(m.group(1)) if m else None

    return {
        "I": grab(r"I:\s+(-?\d+\.?\d*)\s+LUFS", "Integrated loudness"),
        "LRA": grab(r"LRA:\s+(-?\d+\.?\d*)\s+LU", "Loudness range"),
        "TP": grab(r"Peak:\s+(-?\d+\.?\d*)\s+dBFS", "True peak"),
    }


def band_rms(path: Path, lo: int, hi: int) -> float:
    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
             "-af", f"highpass=f={lo},lowpass=f={hi},astats=metadata=1:reset=0", "-f", "null", "-"])
    vals = re.findall(r"RMS level dB:\s+(-?\d+\.?\d*|-?inf)", p.stderr)
    if not vals:
        return float("nan")
    return float("-inf") if vals[-1] == "-inf" else float(vals[-1])


def flatness(path: Path) -> dict:
    """Flat factor（頂点が平らに潰れていないか）。リミッターで丸めた音は ≈0、クリップすると立つ。"""
    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "astats=metadata=1:reset=0", "-f", "null", "-"])
    tail = p.stderr[p.stderr.rfind("Overall"):] if "Overall" in p.stderr else p.stderr

    def g(key: str) -> float:
        m = re.search(rf"{key}:\s+(-?\d+\.?\d*)", tail)
        return float(m.group(1)) if m else float("nan")

    return {"flat": g("Flat factor"), "peak_count": g("Peak count")}


BANDS = [("low<120", 20, 120), ("mid400-2k", 400, 2000), ("hi5-10k", 5000, 10000), ("air10-16k", 10000, 16000)]


def tone_profile(path: Path) -> dict:
    prof = {name: band_rms(path, lo, hi) for name, lo, hi in BANDS}
    prof["gap_low_mid"] = prof["low<120"] - prof["mid400-2k"]
    prof["gap_mid_hi"] = prof["mid400-2k"] - prof["hi5-10k"]   # 小さいほど「抜け」がある
    return prof


# ======================================================================================
# 変換 / マスタリング
# ======================================================================================
def to_target_wav(src: Path, workdir: Path) -> Path:
    """入力を目標の SR / bit の WAV に一度だけ変換する（以降は SRC しない）。"""
    info = ffprobe_info(src)
    if info["codec"] == f"pcm_s{TARGET_BITS}le" and info["sr"] == TARGET_SR:
        return src
    out = workdir / "premaster.wav"
    if run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:a",
            "-c:a", f"pcm_s{TARGET_BITS}le", "-ar", str(TARGET_SR), str(out)]).returncode != 0:
        sys.exit(f"[ERR] {TARGET_SR}Hz/{TARGET_BITS}bit への変換に失敗: {src}")
    print(f"[prep] {info['codec']} {info['sr']}Hz → pcm_s{TARGET_BITS}le {TARGET_SR}Hz")
    return out


def matchering_python() -> str:
    py = os.environ.get("MATCHERING_PYTHON", sys.executable)
    if run([py, "-c", "import matchering"]).returncode != 0:
        sys.exit(f"[ERR] matchering が無い（{py}）。自分で入れる: {py} -m pip install matchering"
                 "\n  別の venv に入れたなら MATCHERING_PYTHON=/path/to/python を指定する。")
    return py


def matchering(target: Path, reference: Path, out: Path) -> None:
    """matchering でトーン＋レベルを --ref に寄せる（EQ 相当まで）。
    内部 SR は目標に固定（既定 44.1k のままだと SRC が1回挟まる）。matchering のリミッターは切り、
    ピーク処理は finalize() の1回だけにする（二重掛けでダイナミクスが死ぬ）。"""
    code = f'''
import matchering as mg
mg.log(print)
mg.process(
    target={str(target)!r},
    reference={str(reference)!r},
    results=[mg.Result({str(out)!r}, "PCM_{TARGET_BITS}", use_limiter=False, normalize=False)],
    config=mg.Config(internal_sample_rate={TARGET_SR}),
)
'''
    p = run([matchering_python(), "-c", code])
    if p.returncode != 0 or not out.exists():
        sys.exit(f"[ERR] matchering 失敗:\n{p.stdout[-2000:]}\n{p.stderr[-2000:]}")
    for line in p.stdout.splitlines():
        if any(k in line for k in ("Resampling", "RMS coefficient", "amplitude coefficient")):
            print(f"[match] {line.strip()}")


# 標準テンプレート: 手作業マスターで毎回ほぼ同じだった処理を相対 EQ で再現する。
#   low=100Hz ローシェルフ / scoop=550Hz 箱鳴り(Q0.7) / presence=3.3k(Q1.2) / shelf7k=7k ハイシェルフ（抜け）/
#   harsh=8.5k 刺さり抑え(Q1.0) / air=12k(Q1.0) / exc=aexciter 量（既定 0＝使わない。--exciter で有効）
HOUSE_PROFILES = {
    "flat":       {"low": 0.0, "scoop": 0.0, "presence": 0.0, "shelf7k": 0.0, "harsh": 0.0, "air": 0.0, "exc": 0.0},
    "bright":     {"low": 2.0, "scoop": -1.5, "presence": 1.0, "shelf7k": 1.5, "harsh": -2.0, "air": 0.5, "exc": 0.0},
    "neutral":    {"low": 2.5, "scoop": -1.2, "presence": 1.0, "shelf7k": 1.5, "harsh": -2.0, "air": 0.4, "exc": 0.0},
    "sub-driven": {"low": 1.5, "scoop": -1.2, "presence": 1.0, "shelf7k": 1.5, "harsh": -2.0, "air": 0.3, "exc": 0.0},
    "dark":       {"low": 2.5, "scoop": -1.2, "presence": 1.0, "shelf7k": 2.0, "harsh": -1.5, "air": 0.5, "exc": 0.0},
}
EXCITER_AMOUNT = {"flat": 1.0, "bright": 1.2, "neutral": 1.5, "sub-driven": 1.0, "dark": 2.5}
DEFAULT_PROFILE = "flat"  # config に profile が無いとき


def house_master(src: Path, out: Path, profile: str, knobs: dict) -> dict:
    """HPF28 → 100 ローシェルフ → 550 スクープ → 3.3k → 7k シェルフ → 8.5k ディップ → 12k（→ finalize）"""
    k = {**HOUSE_PROFILES[profile], **knobs}
    chain = [
        "highpass=f=28",                                              # sub の下だけ落とす（sub は残す）
        f"lowshelf=f=100:g={k['low']:.2f}",
        f"equalizer=f=550:width_type=q:w=0.7:g={k['scoop']:.2f}",
        f"equalizer=f=3300:width_type=q:w=1.2:g={k['presence']:.2f}",
        f"highshelf=f=7000:g={k['shelf7k']:.2f}",
        f"equalizer=f=8500:width_type=q:w=1.0:g={k['harsh']:.2f}",
        f"equalizer=f=12000:width_type=q:w=1.0:g={k['air']:.2f}",
    ]
    if k["exc"] > 0:
        # 生成倍音が 24k を超えて折り返すとシャリつく＝4倍オーバーサンプリングで囲う
        chain += [f"aresample={TARGET_SR * OVERSAMPLE}:filter_size=64",
                  f"aexciter=amount={k['exc']:.2f}:drive=5.0:freq=7000:ceil=13000:blend=0",
                  f"aresample={TARGET_SR}:filter_size=64"]
    if run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", ",".join(chain),
            "-c:a", f"pcm_s{TARGET_BITS}le", "-ar", str(TARGET_SR), str(out)]).returncode != 0 or not out.exists():
        sys.exit("[ERR] 標準テンプレート適用に失敗")
    print(f"[house] profile={profile} low100={k['low']:+.1f} scoop={k['scoop']:+.1f} 3.3k={k['presence']:+.1f} "
          f"7kShelf={k['shelf7k']:+.1f} harsh8.5k={k['harsh']:+.1f} air={k['air']:+.1f} exciter={k['exc']:.1f}")
    return k


def finalize(src: Path, out: Path) -> dict:
    """目標 Integrated / True Peak へ収束させる（ゲイン＋4倍OSリミッターを反復。TP は毎回実測して詰める）。"""
    gain = 0.0
    ceiling = TARGET_TP - 0.2   # サンプルピーク天井の初期値。TP は実測で超えたら下げる
    last: dict = {}
    for attempt in range(1, 8):
        lim = f"alimiter=level_in=1:level_out=1:limit={10 ** (ceiling / 20):.5f}:attack=3:release=60:level=disabled"
        af = (f"volume={gain:.2f}dB,aresample={TARGET_SR * OVERSAMPLE}:filter_size=64,{lim},"
              f"aresample={TARGET_SR}:filter_size=64")
        if run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", af,
                "-c:a", f"pcm_s{TARGET_BITS}le", "-ar", str(TARGET_SR), str(out)]).returncode != 0:
            sys.exit("[ERR] 最終段（ゲイン＋リミッター）の書き出しに失敗")
        m = last = loudness(out)
        print(f"[final #{attempt}] gain={gain:+.2f}dB ceiling={ceiling:.2f}dBFS (OS×{OVERSAMPLE}) "
              f"→ I={m['I']} LUFS / TP={m['TP']} dBTP / LRA={m['LRA']} LU")
        tp_over = (m["TP"] if m["TP"] is not None else -99) - TARGET_TP
        if tp_over > 0.0:
            ceiling -= tp_over + 0.05
            continue
        di = TARGET_I - (m["I"] if m["I"] is not None else TARGET_I)
        if abs(di) > 0.15:
            gain += di
            continue
        return last
    return last


# ======================================================================================
# レポート
# ======================================================================================
@dataclass
class Report:
    song: str
    premaster: dict
    result: dict
    tone: dict
    info: dict
    engine: str = "template"
    profile: str = ""
    reference: str = ""
    ref_tone: dict | None = None
    flat: dict = field(default_factory=dict)
    hand: dict | None = None
    verdict: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.verdict


def judge(rep: Report) -> None:
    r, t, i = rep.result, rep.tone, rep.info
    if r["TP"] is None or r["TP"] > TARGET_TP:
        rep.verdict.append(f"True Peak {r['TP']} dBTP が上限 {TARGET_TP} を超過")
    if r["I"] is None or not (WINDOW_I[0] <= r["I"] <= WINDOW_I[1]):
        rep.verdict.append(f"Integrated {r['I']} LUFS が許容窓 {WINDOW_I[0]:.1f}〜{WINDOW_I[1]:.1f} の外")
    if i["sr"] != TARGET_SR:
        rep.verdict.append(f"サンプルレート {i['sr']}Hz（{TARGET_SR} でない）")
    if i["bits"] != TARGET_BITS:
        rep.verdict.append(f"ビット深度 {i['bits']}bit（{TARGET_BITS} でない）")
    # 潰しすぎ＝premaster から大きく削って低い所に着地したときだけ。元々低 LRA の源を保っただけなら NG にしない
    fin_lra = r["LRA"] or 0
    dl = (rep.premaster["LRA"] or 0) - fin_lra
    if dl > 1.0 and fin_lra < LRA_FLOOR:
        rep.verdict.append(f"LRA {fin_lra} LU（premaster {rep.premaster['LRA']} から -{dl:.1f}・{LRA_FLOOR} 未満＝潰しすぎ）")
    if rep.flat and rep.flat.get("flat", 0) > 1.0:
        rep.verdict.append(f"Flat factor {rep.flat['flat']:.2f}（頂点が平ら＝クリップ/歪みの疑い）")
    # matchering は寄せ先から極端に離れていないかを見る（template はカーブを当てただけ＝曲固有の量感を比べない）
    if rep.engine == "matchering" and rep.ref_tone is not None:
        for key, label in (("gap_low_mid", "低域<120 vs 中域400-2k"), ("gap_mid_hi", "中域400-2k vs 5-10k（抜け）")):
            d = t[key] - rep.ref_tone[key]
            if abs(d) > 3.0:
                rep.verdict.append(f"{label} がリファレンスと {d:+.1f}dB 乖離（許容 ±3dB）")


def fmt_report(rep: Report) -> str:
    p, r, t, ref = rep.premaster, rep.result, rep.tone, rep.ref_tone
    lines = [
        f"# {rep.song} — AUTO マスター実測レポート",
        "",
        f"- 目標（workflow.config.json）: Integrated {SPEC['integratedLufs']}±{SPEC['lufsTolerance']} LUFS"
        f"（狙い {TARGET_I:.1f}）/ True Peak ≤ {TARGET_TP} dBTP / {TARGET_SR}Hz {TARGET_BITS}bit",
        f"- 入力(premaster): I={p['I']} LUFS / TP={p['TP']} dBTP / LRA={p['LRA']} LU",
        f"- 出力(auto):      I={r['I']} LUFS / TP={r['TP']} dBTP / LRA={r['LRA']} LU / {rep.info['sr']}Hz {rep.info['bits']}bit",
        (f"- エンジン:        標準テンプレート（音色 profile={rep.profile}{'・EQ なし' if rep.profile == 'flat' else ''}）" if rep.engine == "template"
         else f"- エンジン:        matchering（寄せ先={rep.reference}）"),
        f"- クリップ検査:    Flat factor={rep.flat.get('flat', float('nan')):.2f}"
        f" / Peak count={rep.flat.get('peak_count', float('nan')):.0f}（リミッターで丸めた音は ≈0）",
        "",
    ]
    if ref is not None:
        lines += ["| 帯域RMS(dB) | auto | reference | 差 |", "|---|---|---|---|"]
        lines += [f"| {n} | {t[n]:.1f} | {ref[n]:.1f} | {t[n] - ref[n]:+.1f} |" for n, _, _ in BANDS]
        lines += [f"| **低域-中域ギャップ** | {t['gap_low_mid']:+.1f} | {ref['gap_low_mid']:+.1f} | {t['gap_low_mid'] - ref['gap_low_mid']:+.1f} |",
                  f"| **中域-5〜10k（抜け）** | {t['gap_mid_hi']:+.1f} | {ref['gap_mid_hi']:+.1f} | {t['gap_mid_hi'] - ref['gap_mid_hi']:+.1f} |", ""]
    else:
        lines += ["| 帯域RMS(dB) | auto |", "|---|---|"]
        lines += [f"| {n} | {t[n]:.1f} |" for n, _, _ in BANDS]
        lines += [f"| **低域-中域ギャップ** | {t['gap_low_mid']:+.1f} |",
                  f"| **中域-5〜10k（抜け）** | {t['gap_mid_hi']:+.1f}（小さいほど抜け） |", ""]
    if rep.hand:
        hl, ht = rep.hand["loud"], rep.hand["tone"]
        d = lambda a, b: (a or 0) - (b or 0)
        lines += ["## 既存マスターとの比較", "",
                  "| | auto | 既存マスター | 差 |", "|---|---|---|---|",
                  f"| Integrated (LUFS) | {r['I']} | {hl['I']} | {d(r['I'], hl['I']):+.1f} |",
                  f"| True Peak (dBTP) | {r['TP']} | {hl['TP']} | {d(r['TP'], hl['TP']):+.1f} |",
                  f"| LRA (LU) | {r['LRA']} | {hl['LRA']} | {d(r['LRA'], hl['LRA']):+.1f} |",
                  f"| 低域-中域ギャップ | {t['gap_low_mid']:+.1f} | {ht['gap_low_mid']:+.1f} | {t['gap_low_mid'] - ht['gap_low_mid']:+.1f} |",
                  f"| 中域-5〜10k（抜け） | {t['gap_mid_hi']:+.1f} | {ht['gap_mid_hi']:+.1f} | {t['gap_mid_hi'] - ht['gap_mid_hi']:+.1f} |",
                  "", "> LRA が既存マスターより 1.0 LU 以上小さいなら潰しすぎ。数値が近くても最後は耳で決める。", ""]
    lines += ["✅ **PASS** — 目標値を満たしている。" if rep.ok else "❌ **NG** — 下記を直すまで昇格しない。"]
    lines += [f"- {v}" for v in rep.verdict]
    lines += ["", "## 自動でやらないこと（人の判断）", "",
              "- 尺の編集（イントロ/アウトロのトリム）はしない＝生成された音源の尺が正",
              "- 音色の選択（既定は config の mastering.profile。こもる・刺さるなどは --low / --shelf7k / --harsh / --air で足す）",
              "- 最後の可否＝耳。数値が PASS でも違和感があれば profile を変える／手作業に戻す",
              "", "> `--promote` を付けて回すと、PASS のときだけ候補（`*_automaster.wav`）をマスター（`<Title>.wav`）に置き換える。"]
    return "\n".join(lines) + "\n"


# ======================================================================================
def song_title(song_dir: Path) -> str:
    try:
        t = json.loads((song_dir / "song.json").read_text(encoding="utf-8")).get("title")
    except (OSError, json.JSONDecodeError):
        t = None
    return t or re.sub(r"^\d{6}_", "", song_dir.name)


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser(description="自動マスタリング（既定=標準テンプレート）")
    ap.add_argument("premaster")
    ap.add_argument("--engine", choices=("template", "matchering"), default="template")
    ap.add_argument("--profile", choices=sorted(HOUSE_PROFILES), default=SPEC.get("profile", DEFAULT_PROFILE))
    ap.add_argument("--ref", help="matchering の寄せ先 WAV（--engine matchering 必須）")
    ap.add_argument("--out")
    ap.add_argument("--promote", action="store_true")
    ap.add_argument("--force", action="store_true")
    for k, h in (("low", "100Hz 低域"), ("scoop", "550Hz 箱スクープ"), ("presence", "3.3k presence"),
                 ("shelf7k", "7k ハイシェルフ"), ("harsh", "8.5k 刺さり抑え(負値)"), ("air", "12k air")):
        ap.add_argument(f"--{k}", type=float, default=None, help=f"{h} を上書き(dB)")
    ap.add_argument("--exciter", action="store_true", help="高域 Exciter を使う（既定 OFF）")
    args = ap.parse_args()

    # matchering は明示したときだけ。--ref だけでは走らせない（うっかり別の曲へ寄せない）
    if args.engine == "template" and args.ref:
        sys.exit("[ERR] --ref は matchering 専用。使うなら --engine matchering を明示する。")
    if args.engine == "matchering" and not args.ref:
        sys.exit("[ERR] --engine matchering には寄せ先 --ref <wav> が要る。")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"[ERR] {tool} が無い")

    src = Path(args.premaster).expanduser().resolve()
    if not src.exists():
        sys.exit(f"[ERR] 入力が無い: {src}")
    if args.out:
        out = Path(args.out).expanduser().resolve()
        song_dir = out.parent
    else:
        song_dir = src.parent
    song = song_title(song_dir)
    if not args.out:
        out = song_dir / f"{song}_automaster.wav"
    master = song_dir / f"{song}.wav"
    if src == master and not args.force:
        sys.exit(f"[ERR] 入力がマスター {master.name} そのもの。premaster（audio.wav 等）を渡す。")

    ref = None
    if args.engine == "matchering":
        ref = Path(args.ref).expanduser().resolve()
        if not ref.exists() or ref.stat().st_size < 10000:
            sys.exit(f"[ERR] リファレンスが無い/中身が無い: {ref}")
        if ref == master and not args.force:
            sys.exit("[ERR] リファレンスがこの曲自身のマスター＝一致して当たり前で検証にならない（意図的なら --force）")
        matchering_python()  # 未インストールなら処理を始める前に止める

    pre = loudness(src)
    print(f"[in ] {src.name}: I={pre['I']} LUFS / TP={pre['TP']} dBTP / LRA={pre['LRA']} LU")
    if not args.force and (pre["I"] if pre["I"] is not None else -99) > MASTERED_ABOVE:
        sys.exit(f"[ERR] 既にマスター済みに見える（I={pre['I']} LUFS > {MASTERED_ABOVE:.1f}）。二重マスターはしない。"
                 "\n  premaster を渡す。意図的なら --force。")

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        target = to_target_wav(src, work)
        toned = work / "toned.wav"
        if args.engine == "matchering":
            print(f"[engine] matchering ← {ref}")
            matchering(target, ref, toned)
        else:
            print("[engine] 標準テンプレート")
            kn = {"exc": EXCITER_AMOUNT[args.profile]} if args.exciter else {}
            kn.update({k: getattr(args, k) for k in ("low", "scoop", "presence", "shelf7k", "harsh", "air")
                       if getattr(args, k) is not None})
            house_master(target, toned, args.profile, kn)
        res = finalize(toned, out)

    rep = Report(song=song, premaster=pre, result=res, tone=tone_profile(out), flat=flatness(out),
                 info=ffprobe_info(out), engine=args.engine, profile=args.profile, reference=str(ref or ""),
                 ref_tone=(tone_profile(ref) if ref else None))
    if master.exists() and master.stat().st_size > 10000 and master != out:
        rep.hand = {"loud": loudness(master), "tone": tone_profile(master)}
        print(f"[hand] 既存マスターあり: {master.name} → 比較を出す")
    judge(rep)
    body = fmt_report(rep)
    (song_dir / "MASTER-REPORT.md").write_text(body, encoding="utf-8")
    print("\n" + body)
    print(f"[out] {out}")

    if args.promote:
        if not rep.ok:
            sys.exit("[ERR] 判定 NG なので昇格しない（先に NG 項目を直す）")
        if master.exists() and not args.force:
            sys.exit(f"[ERR] 既にマスターがある: {master.name}（上書きは --force）")
        shutil.move(out, master)  # 同じ音の候補を2つ残さない
        print(f"[promote] {master.name} に昇格した（候補ファイルはマスターに置き換えた）")

    sys.exit(0 if rep.ok else 1)


if __name__ == "__main__":
    main()
