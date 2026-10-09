import React from 'react';
import { Composition } from 'remotion';
import { Scene, sceneDuration } from '../../_mv-kit/src';
import '../../_mv-kit/styles/plate-swap';
import { scene } from './scene';
import { FontCompare } from './FontCompare';

/**
 * plate-swap のテンプレ。
 * 画・被写体・配色・区間はすべて `src/scene.ts` の SceneSpec 側にある。
 * **このファイルは触らない**のが正しい状態（曲ごとに変えるのは scene.ts と public/）。
 */

const Wide: React.FC = () => <Scene spec={scene} audio={Boolean(scene.meta.audio)} />;

const Short: React.FC = () => (
  <Scene spec={scene} scale={0.8} startSec={0} dropWideOnly audio={Boolean(scene.meta.audio)} />
);

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
      id="ShortVideo"
      component={Short}
      durationInFrames={sceneDuration(scene)}
      fps={scene.meta.fps}
      width={1080}
      height={1920}
    />
    {/* 書体候補の比較（判断用。作品には使わない） */}
    <Composition id="FontCompare" component={FontCompare} durationInFrames={1} fps={30} width={1920} height={1344} />
  </>
);
