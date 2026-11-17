import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: 0,
  // Local runs share the Mac with other agents: use heavy-gate's per-slot worker
  // share (it exports HEAVY_GATE_WORKERS), never Playwright's half-the-cores default.
  workers: process.env.CI ? 1 : Number(process.env.HEAVY_GATE_WORKERS) || 2,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run start:client',
    port: 8080,
    reuseExistingServer: true,
  },
});
