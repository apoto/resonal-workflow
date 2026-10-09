import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// 背景が <Video>（ブラウザの動画デコード）なので、高並列だと同時デコードが競合して delayRender がタイムアウトする。
Config.setConcurrency(3);
Config.setDelayRenderTimeoutInMilliseconds(120000);
