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
  const patient = await createCase(request, clinician.accessToken, `BROWSER-E2E-${runId}`);
  const created = await createSession(request, clinician.accessToken, patient.id);
  const started = await startPatientSession(request, created.testNumber);
  expect(started.patientAge).toBeGreaterThanOrEqual(60);
  expect(started.educationYears).toBe(16);

  await runPatientClickThrough(page, started.linkToken, started);

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

test('review regression: session creation exposes test number but not patient bearer token', async ({ request }) => {
  const runId = Date.now();
  const clinician = await createClinician(request, `browser-token-${runId}@example.test`);
  const patient = await createCase(request, clinician.accessToken, `TOKEN-E2E-${runId}`);
  const created = await createSession(request, clinician.accessToken, patient.id);

  expect(created.testNumber).toMatch(/^\d{8}$/);
  expect(created.sessionUrl).toContain(created.testNumber);

  const started = await startPatientSession(request, created.testNumber);
  expect(started.linkToken).toBeTruthy();
  expect(started.linkToken).not.toBe(created.testNumber);
});

test('review regression: audio evidence stays private and outside scoring review rows', async ({ request }) => {
  const runId = Date.now();
  const clinician = await createClinician(request, `browser-audio-${runId}@example.test`);
  const patient = await createCase(request, clinician.accessToken, `AUDIO-E2E-${runId}`);
  const created = await createSession(request, clinician.accessToken, patient.id);
  const started = await startPatientSession(request, created.testNumber);

  const malformedAudio = await saveAudioResponse(request, started.sessionId, started.linkToken, {
    taskType: 'moca-memory-learning',
    audioBase64: 'not-a-data-url',
    contentType: 'audio/webm',
  });
  expect(malformedAudio.status()).toBe(400);
  await expectJsonError(malformedAudio, 'audioBase64 must be a supported audio data URL');

  const audio = await saveAudio(request, started.sessionId, started.linkToken, {
    taskType: 'moca-memory-learning',
    audioBase64: 'data:audio/webm;base64,QUJD',
    contentType: 'audio/webm',
  });
  expect(audio.audioStoragePath).toMatch(new RegExp(`^${started.sessionId}/moca-memory-learning\\.webm$`));
  await expectAnonAudioReadBlocked(request, audio.audioStoragePath);

  await submitResult(request, started.sessionId, started.linkToken, 'moca-memory-learning', {
    audioId: audio.audioStoragePath,
    audioStoragePath: audio.audioStoragePath,
    audioContentType: audio.audioContentType,
  });
  await completeSession(request, started.sessionId, started.linkToken);

  const session = await getSession(request, clinician.accessToken, started.sessionId);
  type ReviewRow = {
    max_score?: unknown;
    task_type?: unknown;
    raw_data?: {
      audioStoragePath?: unknown;
      audioSignedUrl?: unknown;
    };
  };
  const scoringReviews = session.session.scoring_reviews as ReviewRow[];
  const audioEvidence = session.session.audio_evidence_reviews as ReviewRow[];

  expect(scoringReviews.every(review => Number(review.max_score) > 0)).toBeTruthy();
  expect(scoringReviews.some(review => review.raw_data?.audioStoragePath)).toBeFalsy();
  expect(audioEvidence.some(review =>
    review.task_type === 'moca-memory-learning' &&
    review.raw_data?.audioStoragePath === audio.audioStoragePath &&
    typeof review.raw_data?.audioSignedUrl === 'string'
  )).toBeTruthy();
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

async function createSession(request: APIRequestContext, accessToken: string, patientId: string) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/create-session`, {
    headers: clinicianHeaders(accessToken),
    data: {
      patientId,
      assessmentType: 'moca',
      language: 'he',
      mocaVersion: '8.3',
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.sessionId).toBeTruthy();
  expect(body.linkToken).toBeUndefined();
  expect(body.testNumber).toMatch(/^\d{8}$/);
  return body as { sessionId: string; sessionUrl: string; testNumber: string };
}

async function startPatientSession(request: APIRequestContext, testNumber: string) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/start-session`, {
    headers: anonHeaders(),
    data: { token: testNumber },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ sessionId: string; linkToken: string; ageBand: string; patientAge: number; educationYears: number; sessionDate: string }>;
}

async function runPatientClickThrough(
  page: Page,
  linkToken: string,
  started: { sessionId: string; ageBand: string; patientAge: number; educationYears: number; sessionDate: string },
) {
  await page.addInitScript(({ linkToken: token, startedSession }) => {
    window.localStorage.setItem('moca_assessment_state', JSON.stringify({
      id: startedSession.sessionId,
      linkToken: token,
      scoringContext: {
        sessionId: startedSession.sessionId,
        sessionDate: startedSession.sessionDate,
        educationYears: startedSession.educationYears ?? 12,
        patientAge: startedSession.patientAge ?? 75,
      },
      lastPath: '/patient/trail-making',
      isComplete: false,
      tasks: {},
    }));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
    });

    Object.defineProperty(window.speechSynthesis, 'getVoices', {
      configurable: true,
      value: () => [{ lang: 'he-IL', name: 'Hebrew test voice' }],
    });
    Object.defineProperty(window.speechSynthesis, 'speak', {
      configurable: true,
      value: (utterance: SpeechSynthesisUtterance) => {
        window.setTimeout(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent), 0);
      },
    });
    Object.defineProperty(window.speechSynthesis, 'cancel', {
      configurable: true,
      value: () => undefined,
    });

    class MockMediaRecorder {
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {}

      stop() {
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    });
  }, { linkToken, startedSession: started });

  await page.goto('/#/patient/welcome');
  await expect(page.getByRole('heading', { name: /ברוך הבא להערכה קוגניטיבית/ })).toBeVisible();

  await page.getByRole('button', { name: /בדיקת שמע בעברית/ }).click();
  await expect(page.getByText(/השמעת ההוראות בעברית עובדת/)).toBeVisible();
  await page.getByRole('button', { name: /בדיקת מיקרופון/ }).click();
  await expect(page.getByText(/המיקרופון זמין/)).toBeVisible();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /התחלת המבדק/ })).toBeEnabled();
  await page.getByRole('button', { name: /התחלת המבדק/ }).click();
  await expect(page.getByText(/שלב 1 מתוך/)).toBeVisible();

  const completionResponse = page.waitForResponse(resp =>
    resp.url().includes('/functions/v1/complete-session') && resp.request().method() === 'POST',
  );

  await drawOnCanvas(page);
  await clickContinue(page);

  await drawOnCanvas(page);
  await clickContinue(page);

  await drawOnCanvas(page);
  await clickContinue(page);

  await page.getByRole('button', { name: 'סוס' }).click();
  await page.getByRole('button', { name: 'לפריט הבא' }).click();
  await page.getByRole('button', { name: 'נמר' }).click();
  await page.getByRole('button', { name: 'לפריט הבא' }).click();
  await page.getByRole('button', { name: 'ברווז' }).click();
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await page.getByRole('button', { name: /הקש כאן/ }).click();
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  await recordAudio(page);
  await clickContinue(page);

  const completed = await completionResponse;
  expect(completed.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: /המבדק הושלם/ })).toBeVisible();
}

async function clickContinue(page: Page) {
  await page.waitForTimeout(50);
  await page.getByText('שומר תשובה...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
  await expect(page.getByText('שמירה נכשלה')).toHaveCount(0);
  await page.getByRole('button', { name: /^המשך$/ }).click();
}

async function drawOnCanvas(page: Page) {
  const canvas = page.getByTestId('drawing-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width * 0.35;
  const startY = box!.y + box!.height * 0.35;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 40);
  await page.mouse.move(startX + 80, startY + 10);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /בטל פעולה/ })).toBeEnabled();
}

async function recordAudio(page: Page) {
  await page.getByRole('button', { name: /התחל הקלטה/ }).click();
  await expect(page.getByRole('button', { name: /עצור הקלטה/ })).toBeVisible();
  await page.getByRole('button', { name: /עצור הקלטה/ }).click();
  await expect(page.getByText(/ההקלטה נשמרה בהצלחה/)).toBeVisible();
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

async function saveAudio(
  request: APIRequestContext,
  sessionId: string,
  linkToken: string,
  audio: { taskType: string; audioBase64: string; contentType: string },
) {
  const response = await saveAudioResponse(request, sessionId, linkToken, audio);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ audioStoragePath: string; audioContentType: string }>;
}

async function saveAudioResponse(
  request: APIRequestContext,
  sessionId: string,
  linkToken: string,
  audio: { taskType: string; audioBase64: string; contentType: string },
) {
  return request.post(`${SUPABASE_URL}/functions/v1/save-audio`, {
    headers: anonHeaders(),
    data: {
      sessionId,
      linkToken,
      taskType: audio.taskType,
      audioBase64: audio.audioBase64,
      contentType: audio.contentType,
    },
  });
}

async function expectAnonAudioReadBlocked(request: APIRequestContext, storagePath: string) {
  const response = await request.get(`${SUPABASE_URL}/storage/v1/object/audio/${storagePath}`, {
    headers: anonHeaders(),
  });
  expect([400, 401, 403, 404]).toContain(response.status());
}

async function submitResult(
  request: APIRequestContext,
  sessionId: string,
  linkToken: string,
  taskType: string,
  rawData: Record<string, unknown>,
) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/submit-results`, {
    headers: anonHeaders(),
    data: { sessionId, linkToken, taskType, rawData },
  });
  expect(response.ok()).toBeTruthy();
}

async function completeSession(request: APIRequestContext, sessionId: string, linkToken: string) {
  const response = await request.post(`${SUPABASE_URL}/functions/v1/complete-session`, {
    headers: anonHeaders(),
    data: { sessionId, linkToken },
  });
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
