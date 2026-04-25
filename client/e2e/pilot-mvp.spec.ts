import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const PASSWORD = 'Password123!';
const SUPABASE_URL = readEnv('VITE_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY');

test.skip(!SUPABASE_ANON_KEY, 'Local Supabase anon key is required for MVP browser E2E.');

test.beforeAll(async ({ request }) => {
  if (!SUPABASE_ANON_KEY) {
    return;
  }

  const response = await request.get(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });

  if (!response.ok()) {
    throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}. Start Supabase and Edge Functions before running browser E2E.`);
  }
});

test('pilot MVP browser flow: patient completes and clinician review APIs finalize', async ({ page, request }) => {
  const runId = Date.now();
  const clinician = await createClinician(request, `browser-e2e-${runId}@example.test`);
  const created = await createSession(request, clinician.accessToken, `BROWSER-E2E-${runId}`);
  const started = await startPatientSession(request, created.testNumber);

  await runPatientClickThrough(page, created.linkToken, started);

  const provisional = await getSession(request, clinician.accessToken, created.sessionId);
  expect(provisional.session.status).toBe('awaiting_review');
  expect(provisional.session.drawings).toHaveLength(3);
  expect(provisional.session.scoring_reviews.length).toBeGreaterThan(0);

  const targetDrawingReview = provisional.session.drawings[0];
  const targetScoringReview = provisional.session.scoring_reviews[0];
  const otherClinician = await createClinician(request, `browser-e2e-other-${runId}@example.test`);
  await expectSessionHiddenFromOtherClinician(request, otherClinician.accessToken, created.sessionId);
  await expectDrawingReviewHiddenFromOtherClinician(request, otherClinician.accessToken, targetDrawingReview.id);
  await expectScoringReviewHiddenFromOtherClinician(request, otherClinician.accessToken, targetScoringReview.id);

  const afterUnauthorizedAttempts = await getSession(request, clinician.accessToken, created.sessionId);
  expectReviewFieldsUnchanged(
    findReviewById(afterUnauthorizedAttempts.session.drawings, targetDrawingReview.id),
    targetDrawingReview,
  );
  expectReviewFieldsUnchanged(
    findReviewById(afterUnauthorizedAttempts.session.scoring_reviews, targetScoringReview.id),
    targetScoringReview,
  );

  for (const review of provisional.session.drawings) {
    await updateDrawingReview(request, clinician.accessToken, review.id, drawingMax(review.task_id));
  }

  const afterDrawings = await getSession(request, clinician.accessToken, created.sessionId);
  for (const review of afterDrawings.session.scoring_reviews) {
    await updateScoringReview(request, clinician.accessToken, review.id, review.max_score);
  }

  const final = await getSession(request, clinician.accessToken, created.sessionId);
  expect(final.session.status).toBe('completed');
  expect(final.session.scoring_report.pending_review_count).toBe(0);
  expect(final.session.scoring_report.total_provisional).toBe(false);
});

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

async function createSession(request: APIRequestContext, accessToken: string, caseId: string) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/create-session`, {
    headers: clinicianHeaders(accessToken),
    data: {
      caseId,
      mocaVersion: '8.3',
      ageBand: '70-79',
      educationYears: 12,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.sessionId).toBeTruthy();
  expect(body.linkToken).toBeTruthy();
  expect(body.testNumber).toMatch(/^\d{8}$/);
  return body as { sessionId: string; linkToken: string; testNumber: string };
}

async function startPatientSession(request: APIRequestContext, testNumber: string) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/start-session`, {
    headers: anonHeaders(),
    data: { token: testNumber },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ sessionId: string; linkToken: string; ageBand: string; educationYears: number; sessionDate: string }>;
}

async function runPatientClickThrough(
  page: Page,
  linkToken: string,
  started: { sessionId: string; ageBand: string; educationYears: number; sessionDate: string },
) {
  await page.addInitScript(({ linkToken: token, startedSession }) => {
    window.localStorage.setItem('moca_assessment_state', JSON.stringify({
      id: startedSession.sessionId,
      linkToken: token,
      scoringContext: {
        sessionId: startedSession.sessionId,
        sessionDate: startedSession.sessionDate,
        educationYears: startedSession.educationYears ?? 12,
        patientAge: 75,
      },
      lastPath: '/patient/trail-making',
      isComplete: false,
      tasks: {},
    }));
  }, { linkToken, startedSession: started });

  await page.goto('/#/patient/welcome');
  await expect(page.getByRole('heading', { name: /ברוך הבא למבחן MoCA/ })).toBeVisible();

  await page.getByRole('button', { name: /התחל מבחן/ }).click();
  await expect(page.getByText(/שלב 1 מתוך/)).toBeVisible();

  const completionResponse = page.waitForResponse(resp =>
    resp.url().includes('/functions/v1/complete-session') && resp.request().method() === 'POST',
  );

  for (let i = 0; i < 12; i += 1) {
    await page.getByRole('button', { name: /^המשך$/ }).click();
  }

  const completed = await completionResponse;
  expect(completed.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: /המבדק הושלם/ })).toBeVisible();
}

async function getSession(request: APIRequestContext, accessToken: string, sessionId: string) {
  const response = await getSessionResponse(request, accessToken, sessionId);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function updateDrawingReview(request: APIRequestContext, accessToken: string, reviewId: string, clinicianScore: number) {
  const response = await updateDrawingReviewResponse(request, accessToken, reviewId, clinicianScore);
  expect(response.ok()).toBeTruthy();
}

async function updateScoringReview(request: APIRequestContext, accessToken: string, reviewId: string, clinicianScore: number) {
  const response = await updateScoringReviewResponse(request, accessToken, reviewId, clinicianScore);
  expect(response.ok()).toBeTruthy();
}

async function expectSessionHiddenFromOtherClinician(request: APIRequestContext, accessToken: string, sessionId: string) {
  const response = await getSessionResponse(request, accessToken, sessionId);
  expect(response.status()).toBe(404);
  await expectJsonError(response, 'Session not found');
}

async function expectDrawingReviewHiddenFromOtherClinician(request: APIRequestContext, accessToken: string, reviewId: string) {
  const response = await updateDrawingReviewResponse(request, accessToken, reviewId, 0);
  expect(response.status()).toBe(404);
  await expectJsonError(response, 'Drawing review not found');
}

async function expectScoringReviewHiddenFromOtherClinician(request: APIRequestContext, accessToken: string, reviewId: string) {
  const response = await updateScoringReviewResponse(request, accessToken, reviewId, 0);
  expect(response.status()).toBe(404);
  await expectJsonError(response, 'Scoring review not found');
}

async function expectJsonError(response: APIResponse, error: string) {
  await expect(response.json()).resolves.toMatchObject({ error });
}

function findReviewById(reviews: Array<Record<string, unknown>>, reviewId: string) {
  const review = reviews.find(candidate => candidate.id === reviewId);
  expect(review).toBeTruthy();
  return review!;
}

function expectReviewFieldsUnchanged(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  expect(reviewMutationFields(actual)).toEqual(reviewMutationFields(expected));
}

function reviewMutationFields(review: Record<string, unknown>) {
  return {
    clinician_score: review.clinician_score ?? null,
    clinician_notes: review.clinician_notes ?? null,
    reviewed_at: review.reviewed_at ?? null,
    reviewed_by: review.reviewed_by ?? null,
  };
}

async function getSessionResponse(request: APIRequestContext, accessToken: string, sessionId: string) {
  return request.get(`${SUPABASE_URL}/functions/v1/get-session?sessionId=${sessionId}`, {
    headers: clinicianHeaders(accessToken),
  });
}

async function updateDrawingReviewResponse(
  request: APIRequestContext,
  accessToken: string,
  reviewId: string,
  clinicianScore: number,
) {
  return request.post(`${SUPABASE_URL}/functions/v1/update-drawing-review`, {
    headers: clinicianHeaders(accessToken),
    data: { reviewId, clinicianScore, clinicianNotes: 'browser e2e' },
  });
}

async function updateScoringReviewResponse(
  request: APIRequestContext,
  accessToken: string,
  reviewId: string,
  clinicianScore: number,
) {
  return request.post(`${SUPABASE_URL}/functions/v1/update-scoring-review`, {
    headers: clinicianHeaders(accessToken),
    data: { reviewId, clinicianScore, clinicianNotes: 'browser e2e' },
  });
}

function drawingMax(taskId: string): number {
  if (taskId === 'moca-clock') return 3;
  return 1;
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
