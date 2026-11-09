import { defineConfig } from '@playwright/test';

// Story 4.28. Own Vite dev server on 5199 so it never clashes with the `webgis` container on 5173.
const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  workers: 1, // flow 1 hits the shared real backend; keep it gentle
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Edge ships with Windows, so no browser download. E2E_BROWSER=chrome | chromium to change.
    channel: process.env.E2E_BROWSER === 'chromium' ? undefined : (process.env.E2E_BROWSER || 'msedge'),
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { VITE_API_BASE_URL: process.env.E2E_API_BASE_URL || 'http://localhost:8080' }
  }
});
