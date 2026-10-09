import React from 'react';
import {
  AbsoluteFill, Audio, Img, Loop, OffthreadVideo, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont as loadJP } from '@remotion/google-fonts/NotoSansJP';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { PAL } from './Field';
import type { LyricData } from './types';

const { fontFamily: JP } = loadJP('normal', { weights: ['900'], subsets: ['japanese', 'latin'] });
const { fontFamily: ANTON } = loadAnton();

/** ===== 縦ショート（9:16）専用 =====
 *  本編の SkyKeyvisualStage を流用せず、縦用に組み直している:
 *   - 本編のセクション設計（bust/feet/構図ジャンプ）は縦では意図が読めないので使わない
 *   - サビスタート（入りの助走を付けない）
 *   - 常に全身・中央でずっと踊っている。踊りクリップを小節単位で切り替えて飽きさせない
 *   - 歌詞は曲の絶対秒で判定して出す（frame 0 起点と比べるとズレる）
 */

const DANCE = ['C-para-A', 'C-para-B', 'D-armsup', 'C-para-B'] as const;
const FILE: Record<string, string> = {
  'C-para-A': 'character/C-para-A.webm',
  'C-para-B': 'character/C-para-B.webm',
  'D-armsup': 'character/D-armsup.webm',
};

export const ShortVideo: React.FC<{ data: LyricData; from: number; to: number }> = ({ data, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = from + frame / fps;              // 曲の絶対秒（歌詞と同じ物差し）
  const local = frame / fps;                 // ショート内の経過秒
  const bpm = data.meta.bpm;
  const barSec = (60 / bpm) * 4;

  // --- 背景: 1枚を固定してゆっくり寄る（切り替えない＝短尺で場所を混乱させない） ---
  const bgZoom = 1.12 + local * 0.006;
  const bgPan = Math.sin(local * 0.25) * 14;

  // --- キャラ: 常に全身・中央。2小節ごとに踊りを替える ---
  const clip = DANCE[Math.floor(local / (barSec * 2)) % DANCE.length];
  const loopSec = barSec * 3;
  const rate = data.meta.clipDuration / loopSec;
  const loopFrames = Math.round(loopSec * fps);

  // --- 打点（サビの拍で軽く弾ませる） ---
  const beatPhase = (local % (barSec / 4)) / (barSec / 4);
  const punch = Math.max(0, 1 - beatPhase * 4);

  // --- 歌詞: 絶対秒 t で判定 ---
  const active = data.lyrics.filter((l) => t >= l.t && t <= l.t + (l.hold ?? 2.4));

  return (
    <AbsoluteFill style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
      <Audio src={staticFile(data.meta.audio!)} startFrom={Math.round(from * fps)} />

      <AbsoluteFill style={{ transform: `translateX(${bgPan}px) scale(${bgZoom})` }}>
        <Img src={staticFile('bg_front.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse at 50% 46%, rgba(255,255,255,0) 52%, rgba(255,255,255,0.4) 100%)' }}
      />

      {/* キャラ＝画面中央。縦枠いっぱいに使う（16:9素材を contain すると3割しか使えないので拡大する） */}
      <AbsoluteFill
        style={{
          // 足が床に接地する位置まで下げる（浮いて見えないように）
          transform: `translateY(${800 + punch * -10}px) scale(${1.72 + punch * 0.012})`,
          transformOrigin: '50% 88%',
        }}
      >
        <Loop durationInFrames={loopFrames}>
          <OffthreadVideo
            src={staticFile(FILE[clip])}
            transparent
            playbackRate={rate}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </Loop>
      </AbsoluteFill>

      {/* 歌詞は画面上側（キャラを接地させて下を使うので、文字は上に逃がす）。幅基準・折り返しあり */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.1 }}>
        {active.map((l, i) => {
          const el = (t - l.t) * fps;
          const inT = interpolate(el, [0, 5], [0, 1], { extrapolateRight: 'clamp' });
          const dur = (l.hold ?? 2.4) * fps;
          const outT = interpolate(el, [dur - 5, dur], [1, 0], { extrapolateLeft: 'clamp' });
          const pop = spring({ frame: el, fps, config: { damping: 18, mass: 0.35 } });
          const latin = /^[\x20-\x7E！]+$/.test(l.text);
          return (
            <div
              key={i}
              style={{
                fontFamily: latin ? ANTON : JP,
                fontWeight: 900,
                fontSize: width * (latin ? 0.115 : 0.086),
                lineHeight: 1.22,
                color: PAL.ink,
                textAlign: 'center',
                maxWidth: width * 0.88,
                letterSpacing: '-0.02em',
                opacity: Math.min(inT, outT),
                transform: `translateY(${interpolate(pop, [0, 1], [14, 0])}px)`,
                filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.95)) drop-shadow(0 0 6px rgba(255,255,255,0.9))',
              }}
            >
              {l.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
