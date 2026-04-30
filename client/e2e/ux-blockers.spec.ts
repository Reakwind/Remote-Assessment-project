import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const PASSWORD = 'Password123!';
const SUPABASE_URL = readEnv('VITE_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');

test.describe('patient mobile UX', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Trail Making fits phone width without footer overlay', async ({ page }) => {
    await seedAssessmentState(page, '/patient/trail-making');
    await page.goto('/#/patient/trail-making');

    await expect(page.getByRole('heading', { name: /מתח קו בין מספר לאות בסדר עולה/ })).toBeVisible();
    await expect(page.locator('footer')).toHaveCSS('position', 'static');
    await expect(page.getByTestId('patient-step-indicator')).toHaveText(/1\/12/);
    await expectNoHorizontalOverflow(page);
    await expectElementHeightAtMost(page, 'header', 120);

    const canvas = page.getByTestId('drawing-canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeLessThanOrEqual(390);
    expect(await elementsOverlap(page, '[data-testid="drawing-canvas"]', 'footer')).toBe(false);
  });

  test('memory audio task keeps instructions, recorder, and navigation in document flow', async ({ page }) => {
    await seedAssessmentState(page, '/patient/memory');
    await page.goto('/#/patient/memory');

    await expect(page.getByRole('heading', { name: /זכור את המילים הבאות/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /התחל הקלטה/ })).toBeVisible();
    await expect(page.locator('footer')).toHaveCSS('position', 'static');
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('landing test number entry', () => {
  test('requires exactly 8 digits before patient start submit is enabled', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const input = page.getByLabel('מספר מבדק בן 8 ספרות');
    const submit = page.getByRole('button', { name: /התחל מבדק/ });

    await expect(submit).toBeDisabled();
    await input.fill('1234567');
    await expect(page.getByText('יש להזין מספר מבדק בן 8 ספרות')).toBeVisible();
    await expect(submit).toBeDisabled();

    await input.fill('12345678');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/#\/session\/12345678/);
  });

  test('new local patients see welcome/system-check after valid test-number start', async ({ page }) => {
    await page.route('**/functions/v1/start-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(patientStartPayload('welcome-session', 'welcome-link-token')),
      });
    });

    await page.goto('/#/session/11112222');

    await expect(page.getByRole('heading', { name: 'ברוך הבא להערכה קוגניטיבית' })).toBeVisible();
    await expect(page).toHaveURL(/#\/patient\/welcome/);
  });

  test('returning local patients start a new valid test at the first task', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('moca_patient_onboarding_completed', 'previous-session');
    });
    await page.route('**/functions/v1/start-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(patientStartPayload('returning-session', 'returning-link-token')),
      });
    });

    await page.goto('/#/session/22223333');

    await expect(page.getByRole('heading', { name: /מתח קו בין מספר לאות בסדר עולה/ })).toBeVisible();
    await expect(page).toHaveURL(/#\/patient\/trail-making/);
  });

  test('same-device in-progress sessions resume only after the continue button is clicked', async ({ page }) => {
    await seedAssessmentState(page, '/patient/clock', { startToken: '33334444' });

    await page.goto('/#/session/33334444');

    await expect(page.getByRole('button', { name: 'המשך מהמקום שעצרת' })).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);

    await page.getByRole('button', { name: 'המשך מהמקום שעצרת' }).click();

    await expect(page).toHaveURL(/#\/patient\/clock/);
  });
});

test.describe('clinician mobile UX', () => {
  test.skip(!SUPABASE_ANON_KEY, 'Local Supabase anon key is required for clinician UX E2E.');
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async ({ request }) => {
    if (!SUPABASE_ANON_KEY) return;
    const response = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok()) {
      throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}.`);
    }
  });

  test('dashboard uses mobile header and reachable case actions', async ({ page, request }) => {
    const runId = Date.now();
    const email = `ux-mobile-${runId}@example.test`;
    const clinician = await createClinician(request, email);
    await createCase(request, clinician.accessToken, `UX-MOBILE-${runId}`);

    await signInClinician(page, email);
    await expect(page.getByRole('heading', { name: 'תיקים' })).toBeVisible();
    await expect(page.getByRole('button', { name: /תיק חדש/ })).toBeVisible();
    await expect(page.getByPlaceholder(/חיפוש לפי מזהה תיק/)).toBeVisible();
    await expect(page.getByText(`תיק UX-MOBILE-${runId}`)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('create-test success state remains visible and copyable after refresh', async ({ page, request }) => {
    const runId = Date.now();
    const email = `ux-order-${runId}@example.test`;
    const clinician = await createClinician(request, email);
    const patient = await createCase(request, clinician.accessToken, `UX-ORDER-${runId}`);

    await signInClinician(page, email);
    await page.getByText(`תיק ${patient.case_id}`).click();
    await page.getByRole('button', { name: 'פתח מבדק' }).click();
    await page.getByRole('button', { name: 'צור מספר מבדק' }).click();

    await expect(page.getByRole('heading', { name: 'המבדק נוצר בהצלחה' })).toBeVisible();
    const dialog = page.getByRole('dialog', { name: 'המבדק נוצר בהצלחה' });
    const testNumber = page.locator('span[dir="ltr"]').filter({ hasText: /^\d{8}$/ });
    await expect(testNumber).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'העתק מספר מבדק' })).toHaveCount(1);
    await expect(dialog.getByText('סגור', { exact: true })).toBeVisible();
  });
});

test.describe('clinician desktop density UX', () => {
  test.skip(!SUPABASE_ANON_KEY, 'Local Supabase anon key is required for clinician UX E2E.');
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeAll(async ({ request }) => {
    if (!SUPABASE_ANON_KEY) return;
    const response = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok()) {
      throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}.`);
    }
  });

  test('login, dashboard, and profile keep primary controls above the laptop fold', async ({ page, request }) => {
    const runId = Date.now();
    const email = `ux-density-${runId}@example.test`;
    const clinician = await createClinician(request, email);
    const patient = await createCase(request, clinician.accessToken, `UX-DENSITY-${runId}`);

    await page.goto('/#/clinician/auth');
    const loginSubmit = page.getByRole('button', { name: /כניסה לקלינאים/ });
    await expect(loginSubmit).toBeVisible();
    await expectElementInsideViewport(page, loginSubmit);

    await signInClinician(page, email);
    const caseRow = page.getByRole('button', { name: new RegExp(patient.case_id) });
    await expect(caseRow).toBeVisible();
    await expectElementInsideViewport(page, caseRow);

    await caseRow.click();
    await expect(page.getByRole('heading', { name: `תיק ${patient.case_id}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'פתח מבדק' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'מבדק חדש' })).toHaveCount(0);
  });
});

test.describe('clinician case modal UX', () => {
  test.skip(!SUPABASE_ANON_KEY, 'Local Supabase anon key is required for clinician UX E2E.');
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeAll(async ({ request }) => {
    if (!SUPABASE_ANON_KEY) return;
    const response = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok()) {
      throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}.`);
    }
  });

  test('case form keeps required background fields reachable at laptop height', async ({ page, request }) => {
    const runId = Date.now();
    const email = `ux-case-modal-${runId}@example.test`;

    await createClinician(request, email);
    await signInClinician(page, email);
    await page.getByRole('button', { name: /תיק חדש/ }).click();

    await expect(page.getByRole('heading', { name: 'פתיחת תיק חדש' })).toBeVisible();
    const scrollBody = page.getByTestId('case-form-scroll');
    await scrollBody.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const education = page.getByPlaceholder('למשל 12');
    await expect(education).toBeVisible();
    await expect(page.getByRole('button', { name: 'פתח תיק' })).toBeVisible();

    const layout = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="למשל 12"]');
      const footer = document.querySelector('[data-testid="case-form-footer"]');
      if (!input || !footer) return null;
      const inputBox = input.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      return {
        inputBottom: inputBox.bottom,
        footerTop: footerBox.top,
        overlapsFooter:
          inputBox.left < footerBox.right &&
          inputBox.right > footerBox.left &&
          inputBox.top < footerBox.bottom &&
          inputBox.bottom > footerBox.top,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout?.overlapsFooter).toBe(false);
    expect(layout?.inputBottom).toBeLessThanOrEqual((layout?.footerTop ?? 0) + 1);
    await expectNoHorizontalOverflow(page);
  });
});

async function seedAssessmentState(page: Page, lastPath: string, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(([path, storedOverrides]) => {
    window.localStorage.setItem('moca_assessment_state', JSON.stringify({
      id: 'ux-session',
      linkToken: 'ux-link-token',
      startToken: 'ux-link-token',
      scoringContext: {
        sessionId: 'ux-session',
        sessionDate: '2026-04-26',
        educationYears: 12,
        patientAge: 75,
        mocaVersion: '8.3',
      },
      lastPath: path,
      isComplete: false,
      tasks: {},
      ...storedOverrides,
    }));
  }, [lastPath, overrides]);
}

function patientStartPayload(sessionId: string, linkToken: string) {
  return {
    sessionId,
    linkToken,
    sessionDate: '2026-04-26T10:00:00.000Z',
    educationYears: 12,
    patientAge: 75,
    mocaVersion: '8.3',
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return document.documentElement.scrollWidth > width + 1 || document.body.scrollWidth > width + 1;
  });
  expect(hasOverflow).toBe(false);
}

async function elementsOverlap(page: Page, firstSelector: string, secondSelector: string) {
  return page.evaluate(([first, second]) => {
    const firstElement = document.querySelector(first);
    const secondElement = document.querySelector(second);
    if (!firstElement || !secondElement) return false;
    const a = firstElement.getBoundingClientRect();
    const b = secondElement.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }, [firstSelector, secondSelector]);
}

async function expectElementInsideViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

async function expectElementHeightAtMost(page: Page, selector: string, maxHeight: number) {
  const height = await page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(maxHeight);
}

async function signInClinician(page: Page, email: string) {
  await page.goto('/#/clinician/auth');
  await page.getByPlaceholder('אימייל').fill(email);
  await page.getByPlaceholder('סיסמה').fill(PASSWORD);
  await page.getByRole('button', { name: /כניסה לקלינאים/ }).click();
  await expect(page.getByRole('heading', { name: 'תיקים' })).toBeVisible();
}

async function createClinician(request: APIRequestContext, email: string) {
  const response = await request.post(`${SUPABASE_URL}/auth/v1/signup`, {
    headers: anonHeaders(),
    data: { email, password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.access_token).toBeTruthy();
  return { accessToken: body.access_token as string };
}

async function createCase(request: APIRequestContext, accessToken: string, caseId: string) {
  const response = await request.post(`${SUPABASE_URL}/rest/v1/patients`, {
    headers: {
      ...clinicianHeaders(accessToken),
      Prefer: 'return=representation',
    },
    data: {
      clinician_id: jwtSubject(accessToken),
      case_id: caseId,
      full_name: caseId,
      phone: '0501234567',
      date_of_birth: '1950-04-15',
      gender: 'male',
      language: 'he',
      dominant_hand: 'right',
      education_years: 16,
      id_number: null,
      notes: null,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body[0]?.id).toBeTruthy();
  return body[0] as { id: string; case_id: string };
}

function anonHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function clinicianHeaders(accessToken: string) {
  return {
    ...anonHeaders(),
    Authorization: `Bearer ${accessToken}`,
  };
}

function jwtSubject(accessToken: string) {
  const [, payload] = accessToken.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return decoded.sub as string;
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
