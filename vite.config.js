import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function copyServiceWorker() {
  const serviceWorkerPath = path.resolve(__dirname, 'sw.js');

  return {
    name: 'copy-service-worker',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: fs.readFileSync(serviceWorkerPath, 'utf8'),
      });
    },
  };
}

export default defineConfig({
  root: './',
  base: '/gilmaru-public/',
  build: {
    outDir: 'dist',
  },
  plugins: [copyServiceWorker()],
  server: {
    open: true,
  },
});
