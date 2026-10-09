import React from 'react';
import { AbsoluteFill, Composition, useVideoConfig } from 'remotion';
import { Scene, sceneDuration } from '../../_mv-kit/src';
import '../../_mv-kit/styles/portrait-frame';
import { scene } from './scene';
import { ShortLyrics } from './ShortLyrics';
import { Thumbnail } from './Thumbnail';
import { SHORT_FROM, SHORT_TO } from './short';

/**
 * portrait-frame のテンプレ。
 * 画・被写体・配色・区間はすべて `src/scene.ts` の SceneSpec 側にある。
 * 曲ごとに変えるのは scene.ts / short.ts / input/project.json / public/。
 */

const Wide: React.FC = () => <Scene spec={scene} audio={Boolean(scene.meta.audio)} />;

/**
 * 縦ショート（9:16）。16:9 の world を高さ基準で拡大クロップして中央に置き、上下にできた帯に
 * 歌詞（ShortLyrics）と曲名を出す。時間軸は startSec でシフト＝音声も一緒にずれて同期する。
 */
const CROP = 1.28;      // 高さ方向の拡大率（1.78 で全画面クロップ／下げるほど広く写り、上下に帯ができる）
const FOCUS_X = 0.32;   // 16:9 の画面幅に対する「見せたい点」（キャラの中心）

/** ショート区間だけ立ち絵を寄りに差し替える（本編は変えない）。セクション id → figures */
const SHORT_FIGURES: Record<string, { src: string; scale: number; x: number; y: number; flip?: boolean }[]> = {
  chorus: [{ src: 'char_bust.png', scale: 0.86, x: 32, y: 80 }],
};

const shortSpec = {
  ...scene,
  sections: scene.sections.map((sec) =>
    SHORT_FIGURES[sec.id]
      ? { ...sec, stage: { ...(sec.stage ?? {}), figures: SHORT_FIGURES[sec.id] } }
      : sec
  ),
};

const Short: React.FC = () => {
  const { width, height } = useVideoConfig();
  const SW = scene.meta.width;
  const SH = scene.meta.height;
  const vw = SW * CROP;                       // 拡大後の world 幅
  const vh = SH * CROP;                       // 拡大後の world 高さ
  const left = width / 2 - vw * FOCUS_X;
  const top = (height - vh) / 2;              // 上下に均等な帯ができる
  return (
    <AbsoluteFill style={{ background: scene.stage.fill ?? '#000', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: SW,
          height: SH,
          left: 0,
          top: 0,
          transform: `translate(${left}px, ${top}px) scale(${CROP})`,
          transformOrigin: 'top left',
        }}
      >
        {/* 歌詞は本編側を描かない（縦型専用の ShortLyrics と二重に出るため） */}
        <Scene spec={shortSpec} startSec={SHORT_FROM} audio={Boolean(scene.meta.audio)} lyrics={false} />
      </div>
      <ShortLyrics bandTop={top} bandBottom={height - (top + vh)} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LyricVideo"
      component={Wide}
      durationInFrames={sceneDuration(scene)}
      fps={scene.meta.fps}
      width={scene.meta.width}
      height={scene.meta.height}
    />
    <Composition
      id="Thumbnail"
      component={Thumbnail}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="ShortVideo"
      component={Short}
      // ★ショートの尺は**切り出す区間の長さ**（本編の全長ではない）
      durationInFrames={Math.round((SHORT_TO - SHORT_FROM) * scene.meta.fps)}
      fps={scene.meta.fps}
      width={1080}
      height={1920}
    />
  </>
);
