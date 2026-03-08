import { defineConfig } from '@playwright/test';

const previewPort = process.env.PLAYWRIGHT_PREVIEW_PORT ?? '43173';
const rawPort = process.env.PLAYWRIGHT_RAW_PORT ?? '43174';

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  projects: [
    {
      name: 'built-dist',
      testIgnore: ['**/open-map.spec.js', '**/open-fallback.spec.js'],
      use: {
        baseURL: `http://127.0.0.1:${previewPort}/gilmaru-public/`,
        headless: true,
        serviceWorkers: 'block',
      },
    },
    {
      name: 'raw-root',
      testIgnore: ['**/open-map.spec.js', '**/open-fallback.spec.js'],
      use: {
        baseURL: `http://127.0.0.1:${rawPort}/`,
        headless: true,
        serviceWorkers: 'block',
      },
    },
    {
      name: 'open-fallback',
      testMatch: '**/open-map.spec.js',
      use: {
        baseURL: `http://127.0.0.1:${rawPort}/`,
        headless: true,
        serviceWorkers: 'block',
      },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
      port: Number(previewPort),
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `python -m http.server ${rawPort} --bind 127.0.0.1`,
      port: Number(rawPort),
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
