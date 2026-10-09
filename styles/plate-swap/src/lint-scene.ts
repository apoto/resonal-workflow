import { lintScene, formatFindings } from '../../_mv-kit/src/headless';
import { scene } from './scene';
const f = lintScene(scene);
console.log(formatFindings(f));
process.exit(f.some((x) => x.level === 'error') ? 1 : 0);
