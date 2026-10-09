/**
 * Minimal beat clock for the puppet rig — self-contained so the rig drops into
 * any Remotion project. If your project already has a useBeat()/punchOf(), use
 * those instead and delete this file; the rig only needs { frame, kick } + punchOf.
 *
 * Set BPM/FPS to match the song & composition.
 */
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const BPM = 130; // ← set to the song's tempo
export const FPS = 60; // ← set to the composition's fps

/** Snappy punch envelope: グワッ→すぐ戻る. Use this to shape kick-driven motion. */
export const punchOf = (kick: number) => Math.pow(kick, 0.55);

export const useBeat = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fpb = (60 / BPM) * fps; // frames per beat
  const beat = frame / fpb;
  const beatIndex = Math.floor(beat);
  const beatPhase = beat - beatIndex; // 0..1 within the current beat
  const kick = Math.exp(-beatPhase * 5); // sharp attack, exp decay — the "ドンッ"
  const pulse = Math.exp(-beatPhase * 2.2); // gentler sustained envelope
  const beatInBar = beatIndex % 4; // 0 = downbeat
  return { frame, fps, beat, beatIndex, beatPhase, kick, pulse, beatInBar };
};
