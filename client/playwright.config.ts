import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_APP_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
