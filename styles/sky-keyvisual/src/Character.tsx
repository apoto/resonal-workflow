import React from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import type { ClipId } from './types';

/** ===== ②キャラ =====
 *  背景は Field が描くので、キャラ素材（透過動画）が背景を壊しようがない＝崩れないための構造。
 *
 *  静と動の落差:
 *    - 静側（Verse / 間奏 / Breakdown / 落ちサビ）は静止画（public/still/*.png）。カメラワークとエフェクトで持たせる。
 *    - サビは透過動画（public/character/*.webm）を使い、小節単位でクリップを切り替えて「いろんな踊り」に見せる。
 *    切り替えは拍にロックしたハードカット。
 *
 *  ビートシンク: 生成動画の動きは正確に拍へ乗らないが、始点と終点が揃ったループなら
 *    「クリップ実尺 → 小節長」へリタイムすれば継ぎ目が必ず小節頭に来る。
 *  OffthreadVideo は `transparent` が無いとアルファが落ちる。
 */

const VIDEO: Record<Exclude<ClipId, 'none'>, string> = {
  'A-standing': 'character/A-standing.webm',
  'B-beckon': 'character/B-beckon.webm',
  'C-para-A': 'character/C-para-A.webm',
  'C-para-B': 'character/C-para-B.webm',
  'D-armsup': 'character/D-armsup.webm',
  'E-closeup': 'character/E-closeup.webm',
  'F-shrug': 'character/F-shrug.webm',
  'G-still': 'character/G-still.webm',
};
const STILL: Record<Exclude<ClipId, 'none'>, string> = {
  'A-standing': 'still/A-standing.png',
  'B-beckon': 'still/B-beckon.png',
  'C-para-A': 'still/C-para-A.png',
  'C-para-B': 'still/C-para-B.png',
  'D-armsup': 'still/D-armsup.png',
  'E-closeup': 'still/E-closeup.png',
  'F-shrug': 'still/F-shrug.png',
  'G-still': 'still/G-still.png',
};

export interface CharacterProps {
  clip: ClipId;
  clips?: ClipId[];
  switchBars?: number;
  still?: boolean;
  clipDuration: number;
  bpm: number;
  loopBars?: number;
  silhouette?: boolean;
  adjust?: { scale?: number; x?: number; y?: number };
  /** セクション内の経過秒（クリップ切り替えの判定に使う） */
  localSec: number;
  /** 静止画のときの微動（呼吸・漂い）強度 0..1 */
  breathe?: number;
  /** full=全身 / bust=バストアップ / feet=足元だけ */
  framing?: 'full' | 'bust' | 'feet';
  /** セクション内進行 0..1（feet のカメラ上げに使う） */
  progress?: number;
  /** 9:16（縦ショート）。16:9素材をそのまま contain すると高さの3割しか使わず小さくなる。 */
  short?: boolean;
}

export const Character: React.FC<CharacterProps> = ({
  clip, clips, switchBars = 2, still, clipDuration, bpm, loopBars = 3,
  silhouette, adjust, localSec, breathe = 1, framing = 'full', progress = 0, short,
}) => {
  const { fps } = useVideoConfig();
  const barSec = (60 / bpm) * 4;

  // サビ: 小節単位でクリップを回す＝「いろんな踊り」
  const pool = clips && clips.length > 0 ? clips : [clip];
  const barIdx = Math.floor(localSec / (barSec * switchBars));
  const active = pool[((barIdx % pool.length) + pool.length) % pool.length];
  if (active === 'none') return null;

  // フレーミング: 素材は全身1枚なので、拡大＋上下オフセットで寄りを作る。
  //   bust=顔〜胸が画面に来るよう下へ送る / feet=足元が画面中央に来るよう上へ送る。
  // transformOrigin が '50% 88%'（足元基準）なので、拡大すると上半身は大きく画面外へ飛ぶ。
  // 顔(元画像の y≈15%)を画面中央へ戻すオフセットを計算して当てる:
  //   new_y = 0.88 + (0.15 - 0.88) * scale  →  bust は約 +1.36画面分 送る必要がある。
  // 素材ごとに元のフレーミングが違う（全身 / 膝上 / 既にバストアップ）ので、
  //   一律に拡大すると寄りすぎて顔が枠を突き抜ける。素材側の画角を係数で吸収する。
  const SRC_FRAME: Partial<Record<Exclude<ClipId, 'none'>, number>> = {
    'E-closeup': 0.0,  // 元素材が既にバストアップ＝拡大しない（拡大すると首で切れる）
    'F-shrug': 0.55,   // 膝上
  };
  const k = SRC_FRAME[active] ?? 1.0; // 既定＝全身素材
  const bustS = 1 + (2.1 - 1) * k;
  // 足元は「引いて太ももまで入れる」＝拡大を抑える
  const feetS = 1 + (1.62 - 1) * k;
  // じわーっと上へカメラを上げていく。
  //   カメラが上昇する＝映る範囲が足元→太もも→上半身へ移動する。
  //   キャラは相対的に「下へ」送られるので、オフセットは負の大きい値から小さい値へ。
  const feetPan = -350 + 330 * progress;   // 開始時点で太ももまで入る位置から、上へ
  const FRAME = {
    full: { s: 1.0, y: 0 },
    bust: { s: bustS, y: 1460 * ((bustS - 1) / 1.45) },
    feet: { s: feetS, y: feetPan * ((feetS - 1) / 0.62) },
  }[framing];
  // 9:16: 16:9素材を contain すると横幅基準で縮み、キャラが画面の3割しか占めない。
  //   縦画面では拡大して、足元が画面下部に来るよう下へ送る。
  //   拡大しすぎると頭（と上げた腕）が画面上端で切れるので 1.65 に抑え、下へ送って足元を床に置く。
  //   bust は元素材が既に寄っているので縦画面で拡大しない（拡大すると額から上が切れる）。
  const SHORT = { full: { s: 1.65, y: 430 }, bust: { s: 1.0, y: 250 }, feet: { s: 1.3, y: 520 } }[framing];
  const shortS = short ? SHORT.s : 1;
  const shortY = short ? SHORT.y : 0;
  const s = (adjust?.scale ?? 1) * FRAME.s * shortS;
  const dx = adjust?.x ?? 0;
  const dy = (adjust?.y ?? 0) + FRAME.y + shortY;

  // 静止画でも完全静止にはしない（骨格ルール: 完全静止フレーム禁止）
  const bob = still ? Math.sin(localSec * 1.9) * 5 * breathe : 0;
  const sway = still ? Math.sin(localSec * 0.7) * 0.004 * breathe : 0;

  const wrap = (inner: React.ReactNode) => (
    <AbsoluteFill
      style={{
        transform: `translate(${dx}px, ${dy + bob}px) scale(${s + sway})`,
        transformOrigin: '50% 88%',
        filter: silhouette ? 'brightness(0) saturate(0)' : undefined,
      }}
    >
      {inner}
    </AbsoluteFill>
  );

  if (still) {
    return wrap(
      <Img src={staticFile(STILL[active])} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    );
  }

  const loopSec = barSec * loopBars;
  const rate = clipDuration / loopSec;
  const loopFrames = Math.round(loopSec * fps);
  return wrap(
    <Loop durationInFrames={loopFrames}>
      <OffthreadVideo
        src={staticFile(VIDEO[active])}
        transparent
        playbackRate={rate}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </Loop>
  );
};
