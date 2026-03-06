import { defineConfig } from '@playwright/test';

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
        baseURL: 'http://127.0.0.1:4173/gilmaru-public/',
        headless: true,
        serviceWorkers: 'block',
      },
    },
    {
      name: 'raw-root',
      testIgnore: ['**/open-map.spec.js', '**/open-fallback.spec.js'],
      use: {
        baseURL: 'http://127.0.0.1:4174/',
        headless: true,
        serviceWorkers: 'block',
      },
    },
    {
      name: 'open-fallback',
      testMatch: '**/open-map.spec.js',
      use: {
        baseURL: 'http://127.0.0.1:4174/',
        headless: true,
        serviceWorkers: 'block',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'python -m http.server 4174 --bind 127.0.0.1',
      port: 4174,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
