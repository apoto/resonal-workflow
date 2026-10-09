import { Config } from '@remotion/cli/config';
import path from 'path';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setEntryPoint('src/index.ts');

// キット（../_mv-kit）はこのプロジェクトの外にある。bare import（react / remotion）を
// このプロジェクトの node_modules 1実体に解決させる（2実体になると hooks が壊れる）。
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    modules: [path.resolve(process.cwd(), 'node_modules'), ...((c.resolve as any)?.modules ?? ['node_modules'])],
  },
}));
