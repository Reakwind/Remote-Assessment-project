import { defineConfig, devices } from '@playwright/test';

const defaultBaseURL = 'http://127.0.0.1:5173';
const webServerURL = process.env.E2E_WEB_SERVER_URL ?? defaultBaseURL;
const baseURL = process.env.E2E_APP_URL ?? webServerURL;
const webServerCommand =
  process.env.E2E_WEB_SERVER_COMMAND ?? 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort';
const shouldStartWebServer = !process.env.E2E_APP_URL && process.env.E2E_NO_WEB_SERVER !== '1';

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
          command: webServerCommand,
          url: webServerURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
