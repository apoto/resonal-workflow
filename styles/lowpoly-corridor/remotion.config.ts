import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
// three (WebGL) を Remotion でレンダーするのに必須
Config.setChromiumOpenGlRenderer('angle');
