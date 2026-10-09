import React from 'react';
import { Img, staticFile } from 'remotion';
import { punchOf, useBeat } from './beat';

/**
 * ── CSS cut-out "paper-doll" puppet rig ───────────────────────────────────────
 *
 * Make ONE still character illustration bend AT THE JOINTS (head nods, raised arm
 * pumps, torso leans), pure CSS, ~free to render. No Rive, no AI video, no SVG
 * displacement (that one is ~25s/frame — see SKILL.md "rejected approaches").
 *
 * HOW IT WORKS
 *   The single PNG is drawn as several stacked, full-size copies. Each copy is
 *   clip-path'd to ONE body part and rotated a small-to-medium amount about that
 *   part's joint (transform-origin = the joint, in % of the image box). The parts
 *   are NESTED so a parent's rotation propagates to its children — a real bone
 *   hierarchy: torso is the parent of head + arm, so when the torso leans the head
 *   and arm ride along, then bend further on their own joints.
 *
 * WHY IT DOESN'T TEAR
 *   Every pivot sits EXACTLY on the seam between a part and its parent, and the
 *   clip regions OVERLAP across that seam. So a rotation pivots about the shared
 *   edge and the overlap hides any sliver of gap. Verified: holds past ~20°.
 *   The limit is taste, not tearing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TO ADAPT TO A NEW CHARACTER  (see SKILL.md → "Calibrate for a new character")
 *   1. Set IMG + ASPECT to your art.
 *   2. Re-read the joint coords off a 10×10 grid overlay and rewrite CLIP + the
 *      ox/oy on each <Part> (those are the only character-specific numbers).
 *   3. Keep the clip rectangles OVERLAPPING at each shared joint by a few %.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const IMG = 'character.png'; // ← your character PNG in public/ (transparent bg)
const ASPECT = '1672 / 941'; // ← width / height of that PNG in px

/** one clipped, rotatable layer; children ride inside its rotated frame */
const Part: React.FC<{
  clip: string;
  /** transform-origin = the joint, in % of the image box */
  ox: number;
  oy: number;
  rotate: number;
  scaleY?: number;
  z?: number;
  children?: React.ReactNode;
}> = ({ clip, ox, oy, rotate, scaleY = 1, z = 0, children }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transformOrigin: `${ox}% ${oy}%`,
      transform: `rotate(${rotate}deg) scaleY(${scaleY})`,
      zIndex: z,
    }}
  >
    <Img
      src={staticFile(IMG)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        clipPath: `polygon(${clip})`,
      }}
    />
    {children}
  </div>
);

// CHARACTER-SPECIFIC: clip regions (polygon, % of the image box). Read off a grid.
// Neighbours MUST overlap a few % at each shared joint so rotations never gap.
const CLIP = {
  legs: '27% 46%, 73% 46%, 73% 100%, 27% 100%',
  torso: '30% 19%, 71% 19%, 71% 54%, 30% 54%',
  head: '36% 0%, 61% 0%, 61% 22%, 36% 22%',
  // the raised arm only (hand→elbow→shoulder), kept left of the chest
  arm: '39% 7%, 48% 10%, 50% 20%, 45% 31%, 35% 31%, 31% 22%, 36% 11%',
};

export const PuppetRig: React.FC<{
  imgStyle?: React.CSSProperties;
  /** multiply all joint angles — bump up to preview, 1 = ship. Seams hold past ~20°. */
  gain?: number;
}> = ({ imgStyle, gain = 1 }) => {
  const { frame, kick } = useBeat();
  const k = punchOf(kick);

  // BOLD, phase-offset joint angles (deg). Parts swing on DIFFERENT phases, and
  // the head/arm counter-lean AGAINST the torso, so the joints visibly FOLD
  // relative to each other instead of the figure drifting as one block.
  const torsoRot = Math.sin(frame * 0.05) * 5 * gain; // body leans at the waist
  const headRot = (-Math.sin(frame * 0.05) * 4 - k * 7) * gain; // counter-leans + nods on kick
  const armRot = (Math.sin(frame * 0.09 + 1) * 9 + k * 13) * gain; // raised arm pumps hard on kick
  const torsoSquash = 1 + Math.sin(frame * 0.07) * 0.03 - k * 0.05; // breathe + dip on kick

  // The rig fills a box with the image's EXACT aspect ratio so clip% == image px.
  return (
    <div
      style={{
        position: 'relative',
        height: '102%',
        aspectRatio: ASPECT,
        ...imgStyle,
      }}
    >
      {/* legs / lower body — planted (a standing figure doesn't need them) */}
      <Part clip={CLIP.legs} ox={49} oy={49} rotate={0} z={0} />

      {/* torso leans at the waist; head + raised arm are its CHILDREN (bones) */}
      <Part clip={CLIP.torso} ox={49} oy={49} rotate={torsoRot} scaleY={torsoSquash} z={1}>
        <Part clip={CLIP.head} ox={49} oy={20} rotate={headRot} z={3} />
        <Part clip={CLIP.arm} ox={46} oy={22} rotate={armRot} z={2} />
      </Part>
    </div>
  );
};
