#!/usr/bin/env node
// Audio analysis for picking the Short (9:16) clip window.
//   node analyze.mjs <path-to-wav> [searchFromSec]
//
// Prints: duration, estimated BPM + beat/bar grid, a per-second energy
// envelope, the detected DROP (biggest sustained jump into high energy), and
// a suggested Short window:
//   - START: a downbeat shortly BEFORE the drop (minimal build-up — the first
//     seconds of a Short matter most, so get to the drop fast).
//   - END:   a downbeat at a high-energy phrase boundary (8/16 bars after the
//     drop) so it ends "バスッと" (abruptly) while still hyped.
// Use the printed bar grid to snap START/END to whole bars, then trim with:
//   ffmpeg -y -ss <START> -t <END-START> -i public/audio.wav -c:a pcm_s16le public/short.wav
//
// WAV only (PCM 16-bit). For mp3 inputs, first: ffmpeg -i in.mp3 public/audio.wav
import fs from 'fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node analyze.mjs <path-to-wav> [searchFromSec]');
  process.exit(1);
}
const b = fs.readFileSync(file);

// --- parse WAV chunks ---
let off = 12, dataOff = -1, dataLen = 0, fmt = {};
while (off + 8 <= b.length) {
  const id = b.toString('ascii', off, off + 4);
  const sz = b.readUInt32LE(off + 4);
  if (id === 'fmt ') {
    fmt.channels = b.readUInt16LE(off + 10);
    fmt.rate = b.readUInt32LE(off + 12);
    fmt.bits = b.readUInt16LE(off + 22);
  }
  if (id === 'data') { dataOff = off + 8; dataLen = sz; break; }
  off += 8 + sz + (sz & 1);
}
const { channels, rate, bits } = fmt;
if (dataOff < 0 || bits !== 16) {
  console.error('Need a 16-bit PCM WAV. Convert first: ffmpeg -i in.* out.wav');
  process.exit(1);
}
const bp = bits / 8;
const frames = Math.floor(dataLen / (bp * channels));
const dur = frames / rate;

// --- mono signal ---
const mono = new Float32Array(frames);
for (let i = 0; i < frames; i++) {
  let v = 0;
  for (let c = 0; c < channels; c++) v += b.readInt16LE(dataOff + (i * channels + c) * bp);
  mono[i] = v / channels / 32768;
}

// --- per-second RMS energy envelope ---
const win = Math.floor(rate);
const secs = Math.floor(frames / win);
const env = [];
for (let s = 0; s < secs; s++) {
  let sum = 0;
  for (let i = 0; i < win; i++) { const x = mono[s * win + i]; sum += x * x; }
  env.push(Math.sqrt(sum / win));
}
const emax = Math.max(...env, 1e-9);

// --- tempo via onset autocorrelation (10ms hop) ---
const hop = Math.floor(rate * 0.01);
const nh = Math.floor(frames / hop);
const e10 = new Float32Array(nh);
for (let h = 0; h < nh; h++) {
  let s = 0;
  for (let i = 0; i < hop; i++) { const x = mono[h * hop + i]; s += x * x; }
  e10[h] = Math.sqrt(s / hop);
}
const onset = new Float32Array(nh);
for (let h = 1; h < nh; h++) { const d = e10[h] - e10[h - 1]; onset[h] = d > 0 ? d : 0; }
const hps = 100; // hops per second
const lagOf = (bpm) => Math.round((60 / bpm) * hps);
let best = { bpm: 0, score: -1 };
for (let bpm = 70; bpm <= 180; bpm += 0.5) {
  const lag = lagOf(bpm);
  let s = 0, n = 0;
  for (let h = lag; h < nh; h++) { s += onset[h] * onset[h - lag]; n++; }
  s /= n;
  if (s > best.score) best = { bpm, score: s };
}
const bpm = best.bpm;
const spb = 60 / bpm;        // sec per beat
const barSec = spb * 4;      // sec per 4/4 bar
const lag = lagOf(bpm);
let phase = 0, pv = -1;
for (let p = 0; p < lag; p++) { let s = 0; for (let h = p; h < nh; h += lag) s += onset[h]; if (s > pv) { pv = s; phase = p; } }
const beat0 = phase / hps;
const nearestBeat = (t) => beat0 + Math.round((t - beat0) / spb) * spb;

// --- detect the DROP: largest jump to a sustained-high region ---
const searchFrom = Number(process.argv[3] ?? 0);
let drop = { sec: -1, jump: -1 };
for (let s = Math.max(2, Math.floor(searchFrom)); s < secs - 4; s++) {
  const before = (env[s - 2] + env[s - 1]) / 2;
  const after = (env[s] + env[s + 1] + env[s + 2] + env[s + 3]) / 4;
  const jump = after - before;
  if (after > 0.6 * emax && jump > drop.jump) drop = { sec: s, jump };
}

// --- print ---
console.log(`file: ${file}`);
console.log(`duration=${dur.toFixed(2)}s  rate=${rate}  ch=${channels}  bits=${bits}`);
console.log(`estimated BPM ~ ${bpm.toFixed(1)}   sec/beat=${spb.toFixed(3)}   sec/bar(4/4)=${barSec.toFixed(3)}   beat0=${beat0.toFixed(3)}s`);
console.log('\n--- per-second energy envelope ---');
env.forEach((e, i) => {
  const n = Math.round((e / emax) * 40);
  const mark = i === drop.sec ? '  <== DROP' : '';
  console.log(String(i).padStart(3) + 's |' + '#'.repeat(n).padEnd(40) + '| ' + (e / emax).toFixed(2) + mark);
});

if (drop.sec >= 0) {
  const dropBeat = nearestBeat(drop.sec);
  // START: ~1 bar before the drop (minimal build-up). Snap to a bar.
  const startBar = nearestBeat(dropBeat - barSec * 1.5);
  // END candidates: 8 / 16 bars after the drop downbeat.
  const end8 = nearestBeat(dropBeat + barSec * 8);
  const end16 = nearestBeat(dropBeat + barSec * 16);
  console.log('\n--- DROP & suggested Short window ---');
  console.log(`drop downbeat ~ ${dropBeat.toFixed(3)}s`);
  console.log(`suggested START (≈1.5 bar before drop) ~ ${startBar.toFixed(3)}s`);
  console.log(`suggested END   (8 bars after drop)     ~ ${end8.toFixed(3)}s   → length ${(end8 - startBar).toFixed(2)}s`);
  console.log(`suggested END   (16 bars after drop)    ~ ${end16.toFixed(3)}s   → length ${(end16 - startBar).toFixed(2)}s`);
  console.log('(pick the END nearest a real phrase change while energy is still high; aim ~20–40s total)');
  console.log('\n--- bar grid around the window (snap START/END here) ---');
  for (let bt = nearestBeat(startBar - barSec * 2); bt <= end16 + barSec * 2; bt += barSec) {
    if (bt >= 0) console.log('bar @ ' + bt.toFixed(3) + 's');
  }
}
