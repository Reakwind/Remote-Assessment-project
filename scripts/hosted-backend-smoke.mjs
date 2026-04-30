#!/usr/bin/env node

const DEFAULT_PATIENT_ORIGIN = 'https://reakwind-remote-assessment-patient-staging.netlify.app';
const DEFAULT_CLINICIAN_ORIGIN = 'https://reakwind-remote-assessment-clinician.netlify.app';
const DEFAULT_MOCA_VERSION = '8.3';
const DEFAULT_PASSWORD = 'Password123!';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const FAKE_AUDIO = `data:audio/webm;base64,${Buffer.from('hosted-smoke-audio').toString('base64')}`;
const DRAWING_TASKS = ['moca-visuospatial', 'moca-cube', 'moca-clock'];
const DRAWING_MAX = {
  'moca-visuospatial': 1,
  'moca-cube': 1,
  'moca-clock': 3,
};
const NAMING_ANSWERS_BY_VERSION = {
  '8.1': { 'item-1': 'אריה', 'item-2': 'קרנף', 'item-3': 'גמל' },
  '8.2': { 'item-1': 'נחש', 'item-2': 'פיל', 'item-3': 'תנין' },
  '8.3': { 'item-1': 'סוס', 'item-2': 'נמר', 'item-3': 'ברווז' },
};

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log('Usage: node scripts/hosted-backend-smoke.mjs [--keep-records]');
  console.log('');
  console.log('Required env: HOSTED_SUPABASE_URL, HOSTED_SUPABASE_ANON_KEY, HOSTED_SUPABASE_SERVICE_ROLE_KEY');
  console.log('Fallback env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(0);
}

const baseUrl = requireEnv('HOSTED_SUPABASE_URL', 'SUPABASE_URL');
const anonKey = requireEnv('HOSTED_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
const serviceRoleKey = requireEnv('HOSTED_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
const patientOrigin = normalizeOrigin(process.env.PATIENT_STAGING_URL || DEFAULT_PATIENT_ORIGIN, 'PATIENT_STAGING_URL');
const clinicianOrigin = normalizeOrigin(process.env.CLINICIAN_STAGING_URL || DEFAULT_CLINICIAN_ORIGIN, 'CLINICIAN_STAGING_URL');
const mocaVersion = process.env.HOSTED_SMOKE_MOCA_VERSION || DEFAULT_MOCA_VERSION;
const password = process.env.HOSTED_SMOKE_PASSWORD || DEFAULT_PASSWORD;
const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || 'local';
const suffix = `${runId}-${runAttempt}-${Math.random().toString(36).slice(2, 8)}`;
const email = `hosted-smoke-${suffix}@example.test`;
const caseId = `HSMOKE-${suffix}`.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 48);

const cleanupState = {
  userId: null,
  patientId: null,
  sessionId: null,
  storagePaths: {
    drawings: [],
    audio: [],
  },
};

try {
  console.log(`Hosted backend smoke target: ${safeHost(baseUrl)}`);

  const user = await createClinicianUser();
  cleanupState.userId = user.id;

  const session = await signInClinician();
  const clinicianId = session.user?.id || user.id;
  assert(clinicianId === user.id, 'signed-in clinician matches created user', { createdUserId: user.id, signedInUserId: clinicianId });

  const clinicianHeaders = {
    ...anonHeaders(),
    Authorization: `Bearer ${session.access_token}`,
    Origin: clinicianOrigin,
  };

  const patient = await createPatient(clinicianHeaders, clinicianId);
  cleanupState.patientId = patient.id;

  const created = await request('/functions/v1/create-session', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({
      patientId: patient.id,
      mocaVersion,
      language: 'he',
    }),
  });
  assert(
    created.status === 200 &&
      created.body?.sessionId &&
      created.body?.linkToken === undefined &&
      /^\d{8}$/.test(created.body?.testNumber ?? '') &&
      created.body?.sessionUrl?.includes(created.body.testNumber) &&
      created.body?.mocaVersion === mocaVersion,
    'create-session returns the hosted patient-start contract',
    summarizeResponse(created),
  );
  cleanupState.sessionId = created.body.sessionId;

  const started = await request('/functions/v1/start-session', {
    method: 'POST',
    headers: {
      ...anonHeaders(),
      Origin: patientOrigin,
    },
    body: JSON.stringify({
      token: created.body.testNumber,
      deviceContext: { smoke: true, source: 'github-actions' },
    }),
  });
  assert(
    started.status === 200 &&
      started.body?.status === 'ready' &&
      started.body?.sessionId === created.body.sessionId &&
      typeof started.body?.linkToken === 'string' &&
      started.body.linkToken !== created.body.testNumber &&
      started.body?.mocaVersion === mocaVersion,
    'start-session accepts the hosted test number and returns an internal link token',
    summarizeResponse(started),
  );

  const sessionRow = await request(`/rest/v1/sessions?select=id,status,access_code,moca_version,patient_age_years,assessment_language&id=eq.${encodeURIComponent(created.body.sessionId)}`, {
    method: 'GET',
    headers: serviceHeaders(),
  });
  assert(
    sessionRow.status === 200 &&
      Array.isArray(sessionRow.body) &&
      sessionRow.body[0]?.status === 'in_progress' &&
      /^\d{8}$/.test(sessionRow.body[0]?.access_code ?? '') &&
      sessionRow.body[0]?.moca_version === mocaVersion &&
      sessionRow.body[0]?.patient_age_years >= 60 &&
      sessionRow.body[0]?.assessment_language === 'he',
    'hosted schema stores the expected session contract',
    summarizeResponse(sessionRow),
  );

  await submitCompleteAssessment({
    sessionId: created.body.sessionId,
    linkToken: started.body.linkToken,
    clinicianHeaders,
    mocaVersion,
  });

  console.log(`PASS hosted backend data smoke session=${created.body.sessionId} testNumberLength=${created.body.testNumber.length}`);
} finally {
  if (!options.keepRecords) {
    await cleanupSmokeRecords();
  } else {
    console.log('Skipping hosted smoke cleanup because --keep-records was passed.');
  }
}

async function createClinicianUser() {
  const response = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Hosted Smoke Clinician',
        clinic_name: 'Remote Check Smoke',
      },
    }),
  });
  const user = response.body?.user ?? response.body;
  assert(response.status < 300 && user?.id, 'admin creates a confirmed smoke clinician', summarizeResponse(response));
  return user;
}

async function signInClinician() {
  const response = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  assert(response.status === 200 && response.body?.access_token, 'smoke clinician can sign in', summarizeResponse(response));
  return response.body;
}

async function createPatient(headers, clinicianId) {
  const response = await request('/rest/v1/patients?select=id,case_id', {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      clinician_id: clinicianId,
      case_id: caseId,
      full_name: caseId,
      phone: '0500000000',
      date_of_birth: '1950-04-15',
      gender: 'male',
      language: 'he',
      dominant_hand: 'right',
      education_years: 12,
      id_number: null,
      notes: 'Hosted smoke record. Safe to delete.',
    }),
  });
  assert(response.status === 201 && response.body?.[0]?.id, 'clinician REST insert creates a complete patient profile', summarizeResponse(response));
  return response.body[0];
}

async function submitCompleteAssessment({ sessionId, linkToken, clinicianHeaders, mocaVersion }) {
  const patientHeaders = {
    ...anonHeaders(),
    Origin: patientOrigin,
  };

  for (const taskId of DRAWING_TASKS) {
    await submitDrawing(patientHeaders, sessionId, linkToken, taskId);
  }

  await submitResult(patientHeaders, sessionId, linkToken, 'moca-naming', {
    answers: NAMING_ANSWERS_BY_VERSION[mocaVersion] ?? NAMING_ANSWERS_BY_VERSION[DEFAULT_MOCA_VERSION],
  });
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-memory-learning', {
    presentedWords: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'],
    smoke: true,
  });
  await submitAudioTask(patientHeaders, sessionId, linkToken, 'moca-digit-span');
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-vigilance', { score: 1 });
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-serial-7s', [
    { answer: 93, isCorrect: true },
    { answer: 86, isCorrect: true },
    { answer: 79, isCorrect: true },
    { answer: 72, isCorrect: true },
    { answer: 65, isCorrect: true },
  ]);
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-language', {
    repetition: [true, true],
    fluencyCount: 12,
  });
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-abstraction', {
    pair1: true,
    pair2: true,
  });
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-delayed-recall', {
    recalled: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'],
  });
  await submitResult(patientHeaders, sessionId, linkToken, 'moca-orientation-task', {
    date: true,
    month: true,
    year: true,
    day: true,
    place: true,
    city: true,
  });

  const completed = await request('/functions/v1/complete-session', {
    method: 'POST',
    headers: patientHeaders,
    body: JSON.stringify({ sessionId, linkToken }),
  });
  assert(
    completed.status === 200 && completed.body?.scoringReport?.totalProvisional === true,
    'complete-session accepts the full hosted patient assessment and creates a provisional report',
    summarizeResponse(completed),
  );

  const detail = await getSession(clinicianHeaders, sessionId);
  assert(
    detail.session?.status === 'awaiting_review' &&
      Array.isArray(detail.session?.task_results) &&
      detail.session.task_results.length >= 12 &&
      Array.isArray(detail.session?.drawings) &&
      detail.session.drawings.length === 3 &&
      Array.isArray(detail.session?.scoring_reviews),
    'clinician get-session exposes the full hosted assessment review queue',
    summarizeSession(detail.session),
  );
  assert(
    detail.session.audio_evidence_reviews?.some((row) => row.raw_data?.audioSignedUrl),
    'clinician get-session exposes signed hosted audio evidence',
    summarizeSession(detail.session),
  );

  for (const review of detail.session.drawings) {
    const response = await request('/functions/v1/update-drawing-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({
        reviewId: review.id,
        clinicianScore: DRAWING_MAX[review.task_id] ?? 0,
        clinicianNotes: 'hosted smoke',
      }),
    });
    assert(response.status === 200, `clinician can score hosted drawing ${review.task_id}`, summarizeResponse(response));
  }

  const afterDrawings = await getSession(clinicianHeaders, sessionId);
  for (const review of afterDrawings.session.scoring_reviews) {
    const response = await request('/functions/v1/update-scoring-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({
        reviewId: review.id,
        clinicianScore: review.max_score,
        clinicianNotes: 'hosted smoke',
      }),
    });
    assert(response.status === 200, `clinician can score hosted review ${review.item_id ?? review.task_type}`, summarizeResponse(response));
  }

  const final = await getSession(clinicianHeaders, sessionId);
  assert(
    final.session?.status === 'completed' &&
      final.session?.scoring_report?.pending_review_count === 0 &&
      final.session?.scoring_report?.total_provisional === false,
    'clinician scoring finalizes the full hosted assessment',
    summarizeSession(final.session),
  );
}

async function submitDrawing(headers, sessionId, linkToken, taskId) {
  const strokes = [[
    { x: 40, y: 40, time: 0, pressure: 0.5, pointerType: 'touch' },
    { x: 120, y: 120, time: 50, pressure: 0.5, pointerType: 'touch' },
  ]];
  const drawing = await request('/functions/v1/save-drawing', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskId,
      imageBase64: TINY_PNG,
      strokesData: strokes,
    }),
  });
  assert(
    drawing.status === 200 &&
      drawing.body?.ok === true &&
      drawing.body?.storagePath === `${sessionId}/${taskId}.png`,
    `save-drawing stores hosted ${taskId}`,
    summarizeResponse(drawing),
  );
  cleanupState.storagePaths.drawings.push(drawing.body.storagePath);

  await submitResult(headers, sessionId, linkToken, taskId, {
    strokes,
    drawingPath: drawing.body.storagePath,
  });
}

async function submitAudioTask(headers, sessionId, linkToken, taskType) {
  const audio = await request('/functions/v1/save-audio', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskType,
      audioBase64: FAKE_AUDIO,
      contentType: 'audio/webm',
    }),
  });
  assert(audio.status === 200 && audio.body?.audioStoragePath, `save-audio stores hosted ${taskType}`, summarizeResponse(audio));
  cleanupState.storagePaths.audio.push(audio.body.audioStoragePath);

  await submitResult(headers, sessionId, linkToken, taskType, {
    audioStoragePath: audio.body.audioStoragePath,
    audioContentType: audio.body.audioContentType,
  });
}

async function submitResult(headers, sessionId, linkToken, taskType, rawData) {
  const response = await request('/functions/v1/submit-results', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, linkToken, taskType, rawData }),
  });
  assert(response.status === 200 && response.body?.ok === true, `submit-results stores hosted ${taskType}`, summarizeResponse(response));
}

async function getSession(headers, sessionId) {
  const response = await request(`/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers,
  });
  assert(response.status === 200 && response.body?.session, 'clinician get-session reads hosted session', summarizeResponse(response));
  return response.body;
}

async function cleanupSmokeRecords() {
  const failures = [];
  await cleanupSmokeStorage(failures);

  const deletions = [
    ['audit_events by session', cleanupState.sessionId && `/rest/v1/audit_events?session_id=eq.${encodeURIComponent(cleanupState.sessionId)}`],
    ['patient_start_attempts by session', cleanupState.sessionId && `/rest/v1/patient_start_attempts?session_id=eq.${encodeURIComponent(cleanupState.sessionId)}`],
    ['sessions', cleanupState.sessionId && `/rest/v1/sessions?id=eq.${encodeURIComponent(cleanupState.sessionId)}`],
    ['patients', cleanupState.patientId && `/rest/v1/patients?id=eq.${encodeURIComponent(cleanupState.patientId)}`],
    ['audit_events by actor', cleanupState.userId && `/rest/v1/audit_events?actor_user_id=eq.${encodeURIComponent(cleanupState.userId)}`],
    ['clinicians', cleanupState.userId && `/rest/v1/clinicians?id=eq.${encodeURIComponent(cleanupState.userId)}`],
  ];

  for (const [label, path] of deletions) {
    if (!path) continue;
    const response = await request(path, {
      method: 'DELETE',
      headers: serviceHeaders(),
    });
    if (response.status >= 300) failures.push(`${label}: HTTP ${response.status}`);
  }

  if (cleanupState.userId) {
    const response = await request(`/auth/v1/admin/users/${encodeURIComponent(cleanupState.userId)}`, {
      method: 'DELETE',
      headers: serviceHeaders(),
    });
    if (response.status >= 300) failures.push(`auth user: HTTP ${response.status}`);
  }

  if (failures.length > 0) {
    console.warn(`WARN hosted smoke cleanup incomplete: ${failures.join('; ')}`);
  } else {
    console.log('PASS hosted smoke cleanup');
  }
}

async function cleanupSmokeStorage(failures) {
  for (const [bucket, paths] of Object.entries(cleanupState.storagePaths)) {
    if (!Array.isArray(paths) || paths.length === 0) continue;
    const response = await request(`/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: serviceHeaders(),
      body: JSON.stringify({ prefixes: paths }),
    });
    if (response.status >= 300) failures.push(`${bucket} storage: HTTP ${response.status}`);
  }
}

async function request(path, init) {
  const response = await fetch(urlFor(path), init);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep raw text for CSV/PDF/non-JSON failures.
  }
  return { status: response.status, body };
}

function anonHeaders() {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  };
}

function serviceHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

function urlFor(path) {
  return new URL(path, baseUrl).href;
}

function summarizeResponse(response) {
  const body = response.body && typeof response.body === 'object' ? redact(response.body) : response.body;
  return { status: response.status, body };
}

function summarizeSession(session) {
  if (!session || typeof session !== 'object') return session;
  return {
    id: session.id,
    status: session.status,
    taskResultCount: session.task_results?.length ?? 0,
    drawingCount: session.drawings?.length ?? 0,
    scoringReviewCount: session.scoring_reviews?.length ?? 0,
    audioEvidenceReviewCount: session.audio_evidence_reviews?.length ?? 0,
    scoringReport: session.scoring_report
      ? {
          pending_review_count: session.scoring_report.pending_review_count,
          total_provisional: session.scoring_report.total_provisional,
          total_adjusted: session.scoring_report.total_adjusted,
        }
      : null,
  };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      /token|key|authorization|password|secret/i.test(key) ? '[redacted]' : redact(nested),
    ]),
  );
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return '[invalid-url]';
  }
}

function normalizeOrigin(value, name) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${name} must use https:// for hosted smoke.`);
  return url.origin;
}

function requireEnv(primaryName, fallbackName) {
  const value = process.env[primaryName] || process.env[fallbackName];
  if (!value) {
    console.error(`Missing ${primaryName}. Set ${primaryName} or ${fallbackName}.`);
    process.exit(1);
  }
  return value;
}

function parseArgs(args) {
  return {
    help: args.includes('--help'),
    keepRecords: args.includes('--keep-records'),
  };
}

function assert(condition, message, details) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    console.error(JSON.stringify(details, null, 2));
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`PASS ${message}`);
}
