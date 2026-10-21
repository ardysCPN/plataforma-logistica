try {
  const worker = require('metro-transform-worker');
  if (worker && !worker.default) {
    worker.default = worker;
  }
} catch (e) {}

const expoTransformer = require('@expo/metro-config/build/transform-worker/transform-worker');
const nativewindTransformer = require('nativewind/dist/metro/transformer');
const fs = require('fs');
const path = require('path');

module.exports = {
  ...nativewindTransformer,
  async transform(config, projectRoot, filename, data, options) {
    if (options.platform === 'web' && filename.endsWith('.css')) {
      // Si es el CSS de entrada de Tailwind / NativeWind, cargar el CSS compilado
      if (config.nativewind && config.nativewind.output) {
        const compiledCssPath = `${config.nativewind.output}.web.css`;
        if (fs.existsSync(compiledCssPath)) {
          data = fs.readFileSync(compiledCssPath);
        }
      }
      return expoTransformer.transform(config, projectRoot, filename, data, options);
    }
    return nativewindTransformer.transform(config, projectRoot, filename, data, options);
  },
};
