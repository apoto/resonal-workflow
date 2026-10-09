import React from 'react';
import { Composition } from 'remotion';
import { LyricVideo, ShortVideo } from './LyricVideo';
import { Thumbnail } from './Thumbnail';
import { config as d } from '../../input/song.config';

// props は渡さない（関数を含む config は各コンポが直接 import。defaultProps は直列化されるため）。
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="LyricVideo" component={LyricVideo}
      durationInFrames={Math.ceil(d.meta.duration * d.meta.fps)} fps={d.meta.fps}
      width={d.meta.width ?? 1920} height={d.meta.height ?? 1080} />
    <Composition id="ShortVideo" component={ShortVideo}
      durationInFrames={Math.ceil((d.short.end - d.short.start) * d.meta.fps)} fps={d.meta.fps}
      width={1080} height={1920} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={d.meta.fps} width={1920} height={1080} />
  </>
);
