import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const PASSWORD = 'Password123!';
const SUPABASE_URL = readEnv('VITE_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');

test.beforeAll(async ({ request }) => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY. Add it to client/.env.local or export it before running npm run e2e:browser.');
  }

  const response = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });

  if (!response.ok()) {
    throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}. Start Supabase and Edge Functions before running browser E2E.`);
  }
});

test('pilot MVP browser flow: clinician creates, patient completes, clinician finalizes', async ({ page }) => {
  const runId = Date.now();
  const email = `browser-e2e-${runId}@example.test`;
  const caseId = `BROWSER-E2E-${runId}`;

  await clinicianSignup(page, email);
  await createSession(page, caseId);
  const linkToken = await expectText(page.getByTestId('created-link-token'));

  await runPatientClickThrough(page, linkToken);
  await openSessionDetail(page, caseId);

  await expect(page.getByTestId('summary-task-count')).toContainText('12/12');
  await expect(page.getByTestId('summary-status')).toContainText('בסקירה');

  await completeDrawingReviews(page);
  await completeScoringReviews(page);

  await expect(page.getByTestId('summary-pending-review')).toContainText('0');
  await expect(page.getByTestId('summary-status')).toContainText('הושלם');
});

async function clinicianSignup(page: Page, email: string) {
  await page.goto('/#/dashboard');
  await page.getByTestId('clinician-auth-mode-toggle').click();
  await page.getByTestId('clinician-email').fill(email);
  await page.getByTestId('clinician-password').fill(PASSWORD);
  await page.getByTestId('clinician-auth-submit').click();
  await expect(page.getByTestId('create-session-case-id')).toBeVisible();
}

async function createSession(page: Page, caseId: string) {
  await page.getByTestId('create-session-case-id').fill(caseId);
  await page.getByTestId('create-session-moca-version').selectOption('8.2');
  await page.getByTestId('create-session-age-band').selectOption('70-79');
  await page.getByTestId('create-session-education-years').fill('12');
  await page.getByTestId('create-session-location-place').fill('בית');
  await page.getByTestId('create-session-location-city').fill('תל אביב');

  const response = page.waitForResponse(resp =>
    resp.url().includes('/functions/v1/create-session') && resp.request().method() === 'POST',
  );
  await page.getByTestId('create-session-submit').click();
  await expectResponseOk(await response, 'create-session');
  await expect(page.getByTestId('created-link-token')).toBeVisible();
}

async function runPatientClickThrough(page: Page, linkToken: string) {
  await page.goto(`/#/session/${linkToken}`);
  await expect(page.getByTestId('patient-start')).toBeVisible();
  await page.getByTestId('patient-start').click();
  await expect(page.getByText('גרסה 8.2')).toBeVisible();

  for (let index = 0; index < 12; index += 1) {
    const submitResponse = page.waitForResponse(resp =>
      resp.url().includes('/functions/v1/submit-results') && resp.request().method() === 'POST',
    );
    const completeResponse = index === 11
      ? page.waitForResponse(resp => resp.url().includes('/functions/v1/complete-session') && resp.request().method() === 'POST')
      : null;

    await page.getByTestId('patient-next').click();
    await expectResponseOk(await submitResponse, `submit-results task ${index + 1}`);
    if (completeResponse) await expectResponseOk(await completeResponse, 'complete-session');
  }

  await expect(page.getByTestId('patient-complete')).toBeVisible();
}

async function openSessionDetail(page: Page, caseId: string) {
  await page.goto('/#/dashboard');
  const row = page.getByTestId('session-row').filter({ hasText: caseId });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId('summary-task-count')).toBeVisible();
}

async function completeDrawingReviews(page: Page) {
  const tabs = page.getByTestId('drawing-review-tab');
  const count = await tabs.count();
  expect(count).toBe(3);

  for (let index = 0; index < count; index += 1) {
    await tabs.nth(index).click();
    const score = page.getByTestId('drawing-review-score');
    await fillMaxScore(score);

    const response = page.waitForResponse(resp =>
      resp.url().includes('/functions/v1/update-drawing-review') && resp.request().method() === 'POST',
    );
    await page.getByTestId('drawing-review-save').click();
    await expectResponseOk(await response, `update-drawing-review ${index + 1}`);
  }
}

async function completeScoringReviews(page: Page) {
  const reviews = page.getByTestId('scoring-review');
  const count = await reviews.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const review = reviews.nth(index);
    await fillMaxScore(review.getByTestId('scoring-review-score'));

    const response = page.waitForResponse(resp =>
      resp.url().includes('/functions/v1/update-scoring-review') && resp.request().method() === 'POST',
    );
    await review.getByTestId('scoring-review-save').click();
    await expectResponseOk(await response, `update-scoring-review ${index + 1}`);
  }
}

async function fillMaxScore(input: Locator) {
  const max = await input.getAttribute('max');
  await input.fill(max ?? '0');
}

async function expectText(locator: Locator): Promise<string> {
  await expect(locator).toBeVisible();
  const value = (await locator.textContent())?.trim();
  expect(value).toBeTruthy();
  return value ?? '';
}

async function expectResponseOk(response: { ok(): boolean; status(): number; text(): Promise<string> }, label: string) {
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()}: ${await response.text()}`);
  }
}

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];

  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return undefined;

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .find(entry => entry.startsWith(`${key}=`));

  return line?.slice(key.length + 1);
}
