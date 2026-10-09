#!/usr/bin/env python3
# テンポ推定（純Python・依存なし）: 16k mono wav → beats.json
# エネルギー novelty の自己相関でBPMを推定し、位相を合わせて均一ビートグリッドを出力。
# Usage: python3 tools/02_estimate_beats.py <audio_16k.wav> [bpm_min] [bpm_max] > input/beats.json
import wave, struct, math, json, sys

wav = sys.argv[1]
BMIN = float(sys.argv[2]) if len(sys.argv) > 2 else 135.0
BMAX = float(sys.argv[3]) if len(sys.argv) > 3 else 172.0
w = wave.open(wav, 'rb'); sr = w.getframerate(); n = w.getnframes(); ch = w.getnchannels()
raw = w.readframes(n); w.close()
s = struct.unpack('<' + 'h' * (len(raw) // 2), raw)
if ch == 2:
    s = [(s[i] + s[i + 1]) / 2 for i in range(0, len(s), 2)]
hop = 256
E = []
for i in range(0, len(s) - hop, hop):
    acc = 0.0
    for j in range(i, i + hop):
        v = s[j] / 32768.0; acc += v * v
    E.append(math.sqrt(acc / hop))
nov = [0.0] + [max(0.0, E[i] - E[i - 1]) for i in range(1, len(E))]
fps_env = sr / hop
best_bpm, best = 150.0, -1
bpm = BMIN
while bpm <= BMAX:
    li = int(round(fps_env * 60.0 / bpm))
    if li >= 1:
        acc = sum(nov[i] * nov[i - li] for i in range(li, len(nov)))
        if acc / max(1, len(nov) - li) > best:
            best, best_bpm = acc / max(1, len(nov) - li), bpm
    bpm += 0.25
period = 60.0 / best_bpm
best_ph, bestp = 0.0, -1
for k in range(100):
    ph = period * k / 100; t = ph; acc = 0.0
    while t < len(nov) / fps_env:
        idx = int(round(t * fps_env))
        if idx < len(nov): acc += nov[idx]
        t += period
    if acc > bestp: bestp, best_ph = acc, ph
dur = len(s) / sr
beats = []; t = best_ph
while t < dur:
    beats.append(round(t, 3)); t += period
print(json.dumps({"bpm": round(best_bpm, 2), "phase": round(best_ph, 3),
                  "period": round(period, 4), "beats": beats}))
