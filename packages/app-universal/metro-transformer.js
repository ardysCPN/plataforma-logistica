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
    if (filename.endsWith('.css') && options.platform === 'web') {
      // En Web, cargar el CSS compilado de Tailwind para inyección en el bundle web
      if (config.nativewind && config.nativewind.output) {
        const compiledCssPath = `${config.nativewind.output}.web.css`;
        if (fs.existsSync(compiledCssPath)) {
          data = fs.readFileSync(compiledCssPath);
        }
      }
      return expoTransformer.transform(config, projectRoot, filename, data, options);
    }

    // Para plataformas nativas (Android/iOS) y módulos JS/TS:
    // Ejecutar el transformador de NativeWind para compilar y registrar todos los estilos nativos
    const result = await nativewindTransformer.transform(config, projectRoot, filename, data, options);

    // Metro source-map generator en Release exige que `map` sea un Array de raw mappings.
    // Si NativeWind adjuntó un objeto de mapa completo en CSS, lo aplanamos a [] para evitar
    // el error "Unexpected module with full source map found" preservando el 100% del código de estilos.
    if (result && Array.isArray(result.output)) {
      for (const out of result.output) {
        if (out && out.data && out.data.map && !Array.isArray(out.data.map)) {
          out.data.map = [];
        }
      }
    }

    return result;
  },
};
