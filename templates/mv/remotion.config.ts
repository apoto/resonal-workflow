import { Config } from '@remotion/cli/config';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// 端末ごとの置き場（任意）: リポジトリ直下の .env の TMPDIR を、レンダーの中間ファイル（数GB）の置き場にする。
// tools/05_render.sh を通さず npx remotion render を直接叩いたときも効くようにここで読む。
const envFile = join(process.cwd(), '..', '..', '.env');
if (existsSync(envFile)) {
  const m = readFileSync(envFile, 'utf8').match(/^TMPDIR=["']?([^"'\n]+)["']?\s*$/m);
  if (m) { process.env.TMPDIR = m[1]; mkdirSync(m[1], { recursive: true }); }
}

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
