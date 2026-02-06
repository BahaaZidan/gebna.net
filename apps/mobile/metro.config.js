import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { getDefaultConfig } from '@expo/metro-config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const uniwindDir = path.dirname(require.resolve('uniwind/package.json'));
const { withUniwindConfig } = require(path.join(uniwindDir, 'dist/metro/index.cjs'));

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;

const finalConfig = withUniwindConfig(config, {
  cssEntryFile: 'global.css',
  dtsFile: 'global.d.ts',
});

export default finalConfig
