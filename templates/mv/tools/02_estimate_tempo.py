#!/usr/bin/env python3
"""区間別テンポ実測。BPM も位相も「発注値」ではなく実音源から測る。

  Usage: python3 tools/02_estimate_tempo.py <audio.wav> [--sections 0,26.7,46.5,...] [--bpm 150 170]
                                                   [--out tempo.json] [--beats beats.json]

  1. ffmpeg で 22.05k mono に落として STFT → 対数マグニチュードの低域重みスペクトルフラックス（キック主体）
  2. 区間ごとに BPM×位相をグリッド総当たりし、拍位置でのオンセット強度の平均が最大の組を採る
  3. 高域（ハット/クラップ帯）で独立に同じ推定をして BPM を検算（差が 0.3 BPM 超なら警告）
  4. --out: 区間の配列 [{start,end,bpm,phase,score,hi_band_bpm}]
     --beats: 区間をつないだ拍グリッド {bpm, period, beats:[秒...]}（MV テンプレートの input/beats.json）

  なぜ区間か: 生成音源は発注 BPM とズレる・曲中で漸増することがあり、単一値の自己相関推定は外れやすい。
  依存: numpy と ffmpeg のみ。
"""
import argparse, json, subprocess, sys
import numpy as np

SR = 22050
N_FFT = 1024
HOP = 256
# フレーム i の時刻は窓の中心（先頭で数えると拍が窓半分≈23ms早く出る。合成クリックで実測 0.470→0.493／真値 0.5）
CENTER = N_FFT / 2 / SR


def load_mono(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def onset_strength(y, lo_hz, hi_hz, weight_low=True):
    """半波整流スペクトルフラックス。lo_hz〜hi_hz のビンだけ使う。weight_low で低いビンを重く。"""
    win = np.hanning(N_FFT).astype(np.float32)
    n_frames = 1 + (len(y) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n_frames)[:, None]
    frames = y[idx] * win
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(N_FFT, 1.0 / SR)
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    logmag = np.log1p(mag[:, band] * 100.0)
    if weight_low:
        w = 1.0 / np.sqrt(np.maximum(freqs[band], 20.0))
        logmag = logmag * (w / w.max())
    diff = np.diff(logmag, axis=0, prepend=logmag[:1])
    flux = np.maximum(diff, 0.0).sum(axis=1)
    # 局所正規化（区間内のダイナミクス差でスコアが偏らないように）
    k = int(SR / HOP * 2)  # 2秒
    pad = np.pad(flux, (k // 2, k // 2), mode="edge")
    local = np.array([pad[i:i + k].mean() for i in range(len(flux))])
    return flux / (local + 1e-6)


def fit_section(env, fps, t0, t1, bmin, bmax):
    """区間 [t0,t1) で BPM×位相を総当たり。拍位置（±1フレーム）の env 最大値の平均をスコアにする。"""
    f0, f1 = int(t0 * fps), int(t1 * fps)
    seg = env[f0:f1]
    if len(seg) < fps * 4:
        return None
    # ±1フレームの許容 = 近傍最大
    segmax = np.maximum(np.maximum(seg, np.roll(seg, 1)), np.roll(seg, -1))
    best = (-1.0, None, None)
    for bpm in np.arange(bmin, bmax + 1e-9, 0.02):
        period = 60.0 / bpm * fps  # frames per beat
        n_beats = int(len(seg) / period)
        if n_beats < 4:
            continue
        beats = np.arange(n_beats) * period
        for ph in np.arange(0.0, period, 0.005 * fps):  # 位相は 5ms 刻み
            pos = np.round(beats + ph).astype(int)
            pos = pos[pos < len(seg)]
            sc = segmax[pos].mean()
            if sc > best[0]:
                best = (sc, float(bpm), ph)
    sc, bpm, ph = best
    return {"start": round(t0, 3), "end": round(t1, 3), "bpm": round(bpm, 2),
            "phase": round(t0 + ph / fps + CENTER, 3), "score": round(float(sc), 2)}


def write_beats(sections, path):
    """区間ごとの (bpm, phase) で拍を並べてつなぐ。境界で半拍未満に詰まった拍は捨てる。"""
    beats = []
    for s in sections:
        period = 60.0 / s["bpm"]
        t = s["phase"] - int((s["phase"] - s["start"]) / period) * period  # 区間頭まで遡って埋める
        while t < s["end"]:
            if t >= s["start"] - 1e-6 and (not beats or t - beats[-1] >= period * 0.5):
                beats.append(round(t, 3))
            t += period
    # 代表 BPM は尺で重み付けした中央値（短い区間の外れ値に引っ張られない）
    w = sorted(((s["bpm"], s["end"] - s["start"]) for s in sections))
    half, acc, bpm = sum(d for _, d in w) / 2, 0.0, w[0][0]
    for b, d in w:
        acc += d
        if acc >= half:
            bpm = b
            break
    open(path, "w").write(json.dumps({"bpm": bpm, "period": round(60.0 / bpm, 4), "beats": beats}) + "\n")
    print(f"[beats] {path}  {len(beats)} 拍 / 代表 {bpm} BPM", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--sections", default="", help="境界秒をカンマ区切り（先頭0・末尾は曲長で自動）")
    ap.add_argument("--bpm", nargs=2, type=float, default=[120.0, 200.0], metavar=("MIN", "MAX"))
    ap.add_argument("--window", type=float, default=30.0, help="--sections 無指定時の等分窓（秒）")
    ap.add_argument("--out", default="")
    ap.add_argument("--beats", default="", help="拍グリッド {bpm,period,beats} の出力先")
    a = ap.parse_args()

    y = load_mono(a.audio)
    dur = len(y) / SR
    fps = SR / HOP
    env_lo = onset_strength(y, 30, 200, weight_low=True)      # キック帯
    env_hi = onset_strength(y, 3000, 10000, weight_low=False)  # ハット/クラップ帯（独立検算）

    if a.sections:
        b = [float(x) for x in a.sections.split(",") if x.strip() != ""]
    else:
        b = list(np.arange(0.0, dur, a.window))
    if b[0] > 0:
        b = [0.0] + b
    if dur - b[-1] < 8:
        b = b[:-1]
    b.append(dur)

    # 粗→細: まず全曲で粗い BPM を取り、区間はその ±3 BPM に絞る（総当たりの時間短縮）
    coarse = fit_section(env_lo, fps, 0, min(dur, 60), a.bpm[0], a.bpm[1]) if a.bpm[1] - a.bpm[0] > 8 else None
    bmin, bmax = (coarse["bpm"] - 3, coarse["bpm"] + 3) if coarse else (a.bpm[0], a.bpm[1])
    print(f"[coarse] {coarse['bpm'] if coarse else '-'} BPM (0-60s) → 区間探索 {bmin:.1f}-{bmax:.1f}", file=sys.stderr)

    out = []
    for t0, t1 in zip(b[:-1], b[1:]):
        lo = fit_section(env_lo, fps, t0, t1, bmin, bmax)
        hi = fit_section(env_hi, fps, t0, t1, bmin, bmax)
        if not lo:
            continue
        agree = hi and abs(hi["bpm"] - lo["bpm"]) <= 0.3
        flag = "" if agree else f"  [WARN] 高域検算 {hi['bpm'] if hi else '-'} と不一致"
        print(f"[{t0:7.2f}-{t1:7.2f}] bpm {lo['bpm']:7.2f}  phase {lo['phase']:8.3f}  score {lo['score']:.2f}"
              f"  | hi-band {hi['bpm'] if hi else '-'}{flag}", file=sys.stderr)
        lo["hi_band_bpm"] = hi["bpm"] if hi else None
        out.append(lo)

    if not out:
        sys.exit("[ERR] 推定できた区間が無い（4秒未満の音源／無音）")
    if a.beats:
        write_beats(out, a.beats)
    js = json.dumps(out, indent=1, ensure_ascii=False)
    if a.out:
        open(a.out, "w").write(js + "\n")
        print(f"[out] {a.out}", file=sys.stderr)
    else:
        print(js)


if __name__ == "__main__":
    main()
