import { Composition, staticFile } from 'remotion';
import { MainScene } from './MainScene';
import { CineTest } from './CineTest';
import { ShortScene, SHORT_START, SHORT_END } from './ShortScene';

const FPS = 30;
const AUDIO_SEC = 60; // public/audio.wav の実測尺（ffprobe）に合わせる

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={MainScene}
        durationInFrames={Math.round(FPS * AUDIO_SEC)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ audioSrc: staticFile('audio.wav') }}
      />
      <Composition
        id="Short"
        component={ShortScene}
        durationInFrames={Math.round(FPS * (SHORT_END - SHORT_START))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition id="CineTest" component={CineTest} durationInFrames={30} fps={30} width={1920} height={1080} />
    </>
  );
};
