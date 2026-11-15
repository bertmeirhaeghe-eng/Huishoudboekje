import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

// De tekstherkenning voor receptfoto's zetten we mee op onze eigen site,
// zodat ze niet afhangt van een externe server.
const OCR_FILES = {
  'worker.min.js': () => join(pkgDir('tesseract.js'), 'dist/worker.min.js'),
  'tesseract-core-lstm.wasm.js': () => join(pkgDir('tesseract.js-core'), 'tesseract-core-lstm.wasm.js'),
  'tesseract-core-simd-lstm.wasm.js': () => join(pkgDir('tesseract.js-core'), 'tesseract-core-simd-lstm.wasm.js'),
  'nld.traineddata.gz': () => join(pkgDir('@tesseract.js-data/nld'), '4.0.0_best_int/nld.traineddata.gz'),
};

function ocrFiles() {
  return {
    name: 'ocr-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url && req.url.match(/\/ocr\/([\w.-]+)$/);
        if (!m || !OCR_FILES[m[1]]) return next();
        res.setHeader('Content-Type', m[1].endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(OCR_FILES[m[1]]()));
      });
    },
    generateBundle() {
      for (const [name, path] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(path()) });
      }
    },
  };
}

// base './' zodat de app ook in een submap werkt (bv. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), ocrFiles()],
  build: { chunkSizeWarningLimit: 700 },
});
