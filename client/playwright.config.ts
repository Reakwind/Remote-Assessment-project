import { defineConfig, devices } from '@playwright/test';

const defaultBaseURL = 'http://127.0.0.1:5173';
const baseURL = process.env.E2E_APP_URL ?? defaultBaseURL;
const shouldStartWebServer = !process.env.E2E_APP_URL;

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
  ...(shouldStartWebServer
    ? {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
          url: defaultBaseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
