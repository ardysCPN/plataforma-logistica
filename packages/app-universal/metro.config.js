try {
  const worker = require('metro-transform-worker');
  if (worker && !worker.default) {
    worker.default = worker;
  }
} catch (e) {}

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// Soporte para Monorepo: observar únicamente shared y la raíz necesaria para optimizar memoria
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.transformer.asyncRequireModulePath = require.resolve('metro-runtime/src/modules/asyncRequire');

const nwConfig = withNativeWind(config, { input: './global.css' });
nwConfig.transformerPath = require.resolve('./metro-transformer');

module.exports = nwConfig;
