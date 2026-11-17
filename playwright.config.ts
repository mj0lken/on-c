import { defineConfig, devices } from '@playwright/test';

/**
 * UI smoke tests in WebKit — the same engine the Tauri desktop app (WKWebView) uses,
 * so desktop-only rendering bugs (collapsed dialogs/popovers) surface in CI.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 490, height: 640 },
  },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 490, height: 640 } } }],
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js build && node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/app',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
