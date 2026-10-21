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
    if (filename.endsWith('.css')) {
      if (options.platform === 'web') {
        // En Web, cargar el CSS compilado de Tailwind para inyección en el bundle web
        if (config.nativewind && config.nativewind.output) {
          const compiledCssPath = `${config.nativewind.output}.web.css`;
          if (fs.existsSync(compiledCssPath)) {
            data = fs.readFileSync(compiledCssPath);
          }
        }
        return expoTransformer.transform(config, projectRoot, filename, data, options);
      }
      // En plataformas nativas (Android/iOS), React Native no ejecuta CSS en el runtime.
      // Delegar a expoTransformer con módulo vacío para evitar errores de source maps en Release
      return expoTransformer.transform(config, projectRoot, filename, Buffer.from(''), options);
    }
    return nativewindTransformer.transform(config, projectRoot, filename, data, options);
  },
};
