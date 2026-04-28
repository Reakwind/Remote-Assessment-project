#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'Password123!';
const VERSIONS = ['8.1', '8.2', '8.3'];
const TASKS = [
  'moca-visuospatial',
  'moca-cube',
  'moca-clock',
  'moca-naming',
  'moca-memory-learning',
  'moca-vigilance',
  'moca-serial-7s',
  'moca-language',
  'moca-abstraction',
  'moca-delayed-recall',
  'moca-digit-span',
  'moca-orientation-task',
];
const DRAWING_MAX = {
  'moca-visuospatial': 1,
  'moca-cube': 1,
  'moca-clock': 3,
};
const NAMING = {
  '8.1': ['אריה', 'קרנף', 'גמל'],
  '8.2': ['נחש', 'פיל', 'תנין'],
  '8.3': ['סוס', 'נמר', 'ברווז'],
};
const WORDS = ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'];
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLl9TwAAAABJRU5ErkJggg==';

const options = parseArgs(process.argv.slice(2));
const env = readClientEnv();
const baseUrl = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const origin = process.env.E2E_ORIGIN || DEFAULT_ORIGIN;
const batch = options.batch || `FLOW${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12)}`;
validateBatch(batch);
const outDir = resolve('/tmp/remote-assessment-bulk-flow-qa', batch);
const eventsPath = resolve(outDir, 'events.jsonl');
const failuresPath = resolve(outDir, 'failures.jsonl');
const summaryPath = resolve(outDir, 'summary.json');

if (options.reportBatch) {
  validateBatch(options.reportBatch);
  console.log(JSON.stringify(localBatchReport(options.reportBatch), null, 2));
  process.exit(0);
}

if (options.cleanupBatch) {
  validateBatch(options.cleanupBatch);
  console.log(JSON.stringify(cleanupBatch(options.cleanupBatch), null, 2));
  process.exit(0);
}

if (!anonKey) fail('Missing Supabase anon key. Set SUPABASE_ANON_KEY or client/.env.local VITE_SUPABASE_ANON_KEY.');
mkdirSync(outDir, { recursive: true });

const startedAt = new Date().toISOString();
const startMs = performance.now();
const stats = {
  batch,
  cliniciansTarget: options.clinicians,
  patientsTarget: options.patients,
  testsPerPatient: options.testsPerPatient,
  versionsTarget: Object.fromEntries(VERSIONS.map(version => [version, options.testsPerPatient / VERSIONS.length])),
  cliniciansCreated: 0,
  patientsCreated: 0,
  sessionsCreated: 0,
  sessionsStarted: 0,
  sessionsCompleted: 0,
  sessionsFinalized: 0,
  pdfExports: 0,
  csvExports: 0,
  auditChecks: 0,
  notificationChecks: 0,
  isolationChecks: 0,
  storageDenialChecks: 0,
  negativeStartChecks: 0,
  versionCounts: Object.fromEntries(VERSIONS.map(version => [version, 0])),
  profileEdgeCases: {},
  scoreBands: { low: 0, mid: 0, high: 0 },
  failures: [],
};

console.log(`Bulk flow QA batch: ${batch}`);
console.log(`Target: ${options.clinicians} clinicians, ${options.patients} patients, ${options.testsPerPatient} tests/patient (${options.patients * options.testsPerPatient} sessions)`);
console.log(`Target URL: ${baseUrl}`);
console.log(`Concurrency: ${options.concurrency} patients`);
if (options.resumeExisting) console.log(`Resume mode: ${options.indexes.map(index => index + 1).join(', ')}`);
console.log(`Event log: ${eventsPath}`);

await preflight();

const profileIndexes = options.indexes.length > 0 ? options.indexes : Array.from({ length: options.patients }, (_, index) => index);
const profiles = profileIndexes.map(index => buildProfile(index));
await runPool(profiles, options.concurrency, runPatientFlow);

const endedAt = new Date().toISOString();
const durationSeconds = Math.round((performance.now() - startMs) / 1000);
const summary = {
  ...stats,
  startedAt,
  endedAt,
  durationSeconds,
  eventsPath,
  failuresPath,
  summaryPath,
  pass: options.resumeExisting
    ? stats.failures.length === 0
    : stats.failures.length === 0 &&
      stats.cliniciansCreated === options.clinicians &&
      stats.patientsCreated === options.patients &&
      stats.sessionsFinalized === options.patients * options.testsPerPatient,
};
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log('\nBulk flow QA summary');
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);

async function runPatientFlow(profile) {
  const label = profile.caseId;
  const result = { caseId: profile.caseId, clinicianEmail: profile.email, sessions: 0, failures: 0 };
  try {
    let clinicianHeaders;
    let patientId;
    if (options.resumeExisting) {
      const signedIn = await signIn(profile.email);
      clinicianHeaders = {
        ...anonHeaders(),
        Authorization: `Bearer ${signedIn.body.access_token}`,
      };
      const patient = await request(`/rest/v1/patients?select=id,case_id,date_of_birth,gender,dominant_hand,education_years,language&case_id=eq.${encodeURIComponent(profile.caseId)}`, {
        method: 'GET',
        headers: clinicianHeaders,
      });
      expect(patient.status === 200 && patient.body?.[0]?.id, `${label} existing patient lookup`, patient);
      patientId = patient.body[0].id;
    } else {
      const signup = await request('/auth/v1/signup', {
        method: 'POST',
        headers: anonHeaders(),
        body: JSON.stringify({
          email: profile.email,
          password: PASSWORD,
          data: {
            full_name: profile.clinicianName,
            clinic_name: profile.clinicName,
          },
        }),
      });
      expect(signup.status < 300 && signup.body?.access_token, `${label} clinician signup`, signup);
      stats.cliniciansCreated += 1;

      clinicianHeaders = {
        ...anonHeaders(),
        Authorization: `Bearer ${signup.body.access_token}`,
      };
      const clinicianId = jwtSubject(signup.body.access_token);

      const patient = await request('/rest/v1/patients?select=id,case_id,date_of_birth,gender,dominant_hand,education_years,language', {
        method: 'POST',
        headers: { ...clinicianHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({
          clinician_id: clinicianId,
          case_id: profile.caseId,
          full_name: profile.caseId,
          phone: profile.phone,
          date_of_birth: profile.dateOfBirth,
          gender: profile.gender,
          language: 'he',
          dominant_hand: profile.dominantHand,
          education_years: profile.educationYears,
          id_number: null,
          notes: profile.notes,
        }),
      });
      expect(patient.status === 201 && patient.body?.[0]?.id, `${label} patient profile create`, patient);
      stats.patientsCreated += 1;
      patientId = patient.body[0].id;
    }
    bump(stats.profileEdgeCases, `age_${profile.age}`);
    bump(stats.profileEdgeCases, `education_${profile.educationYears}`);
    bump(stats.profileEdgeCases, `gender_${profile.gender}`);
    bump(stats.profileEdgeCases, `hand_${profile.dominantHand}`);

    const other = options.resumeExisting
      ? await signIn(profile.otherEmail)
      : await request('/auth/v1/signup', {
          method: 'POST',
          headers: anonHeaders(),
          body: JSON.stringify({
            email: profile.otherEmail,
            password: PASSWORD,
          }),
        });
    expect(other.status < 300 && other.body?.access_token, `${label} isolation clinician auth`, other);
    const otherHeaders = {
      ...anonHeaders(),
      Authorization: `Bearer ${other.body.access_token}`,
    };

    const plan = options.resumeExisting
      ? await buildResumePlan(clinicianHeaders, profile.caseId)
      : buildVersionPlan(options.testsPerPatient);
    for (let sessionIndex = 0; sessionIndex < plan.length; sessionIndex += 1) {
      const version = typeof plan[sessionIndex] === 'string' ? plan[sessionIndex] : plan[sessionIndex].version;
      const effectiveSessionIndex = typeof plan[sessionIndex] === 'string' ? sessionIndex : plan[sessionIndex].sessionIndex;
      await completeOneSession({
        profile,
        patientId,
        clinicianHeaders,
        otherHeaders,
        version,
        sessionIndex: effectiveSessionIndex,
      });
      result.sessions += 1;
      const totalDone = stats.sessionsFinalized;
      if (totalDone % options.progressEvery === 0) {
        console.log(`[${batch}] finalized ${totalDone}/${options.patients * options.testsPerPatient}`);
      }
    }
    record('patient-ok', result);
  } catch (error) {
    result.failures += 1;
    const failure = { caseId: profile.caseId, message: error.message, details: error.details ?? null };
    stats.failures.push(failure);
    appendFileSync(failuresPath, `${JSON.stringify(failure)}\n`);
    console.error(`FAIL ${profile.caseId}: ${error.message}`);
  }
}

async function completeOneSession({ profile, patientId, clinicianHeaders, otherHeaders, version, sessionIndex }) {
  const label = `${profile.caseId} ${version} #${sessionIndex + 1}`;
  const edge = buildSessionEdge(profile, version, sessionIndex);
  const created = await request('/functions/v1/create-session', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({ patientId, mocaVersion: version, language: 'he' }),
  });
  expect(created.status === 200 && created.body?.sessionId && /^\d{8}$/.test(created.body?.testNumber ?? ''), `${label} create session`, created);
  stats.sessionsCreated += 1;
  stats.versionCounts[version] += 1;

  const { sessionId, testNumber } = created.body;
  const hiddenBeforeStart = await request(`/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: otherHeaders,
  });
  expect(hiddenBeforeStart.status === 404, `${label} hidden from other clinician before start`, hiddenBeforeStart);
  stats.isolationChecks += 1;

  const started = await request('/functions/v1/start-session', {
    method: 'POST',
    headers: patientStartHeaders(edge),
    body: JSON.stringify({ token: testNumber, deviceContext: edge.deviceContext }),
  });
  expect(started.status === 200 && started.body?.sessionId === sessionId && started.body?.linkToken, `${label} patient start`, started);
  stats.sessionsStarted += 1;
  const linkToken = started.body.linkToken;

  if (options.negativeStarts && sessionIndex % 10 === 0) {
    const directTokenStart = await request('/functions/v1/start-session', {
      method: 'POST',
      headers: patientStartHeaders(edge),
      body: JSON.stringify({ token: linkToken }),
    });
    expect(directTokenStart.status === 404, `${label} link token cannot restart`, directTokenStart);
    stats.negativeStartChecks += 1;
  }

  const stimuli = await request('/functions/v1/get-stimuli', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ sessionId, linkToken }),
  });
  expect(stimuli.status === 200 && stimuli.body?.mocaVersion === version && Array.isArray(stimuli.body?.assets), `${label} stimuli manifest`, stimuli);

  for (const taskId of ['moca-visuospatial', 'moca-cube', 'moca-clock']) {
    await submitDrawing(sessionId, linkToken, taskId, edge);
  }
  await submitResult(sessionId, linkToken, 'moca-naming', { answers: Object.fromEntries(NAMING[version].map((answer, index) => [`item-${index + 1}`, edge.namingWrong ? `שגוי-${index + 1}` : answer])) });
  await submitResult(sessionId, linkToken, 'moca-memory-learning', { localFixture: true, attempts: edge.memoryAttempts });
  await submitResult(sessionId, linkToken, 'moca-vigilance', edge.vigilance);
  await submitResult(sessionId, linkToken, 'moca-serial-7s', edge.serial);
  await submitResult(sessionId, linkToken, 'moca-language', edge.language);
  await submitResult(sessionId, linkToken, 'moca-abstraction', edge.abstraction);
  await submitResult(sessionId, linkToken, 'moca-delayed-recall', { recalled: WORDS.slice(0, edge.recallCount) });

  const audio = await request('/functions/v1/save-audio', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskType: 'moca-digit-span',
      audioBase64: `data:audio/webm;base64,${Buffer.from(`bulk-${batch}-${profile.index}-${sessionIndex}`).toString('base64')}`,
      contentType: edge.audioType,
    }),
  });
  expect(audio.status === 200 && audio.body?.storagePath, `${label} save audio`, audio);
  await submitResult(sessionId, linkToken, 'moca-digit-span', {
    audioStoragePath: audio.body.storagePath,
    audioContentType: audio.body.contentType,
  });
  await submitResult(sessionId, linkToken, 'moca-orientation-task', { localReviewRequired: true, place: edge.place, city: edge.city });

  const completed = await request('/functions/v1/complete-session', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ sessionId, linkToken }),
  });
  expect(completed.status === 200 && completed.body?.scoringReport, `${label} complete session`, completed);
  stats.sessionsCompleted += 1;

  const detail = await getSession(clinicianHeaders, sessionId);
  expect(detail.session.moca_version === version, `${label} dashboard version`, detail.session);
  expect(detail.session.task_results?.length >= TASKS.length, `${label} dashboard task result count`, detail.session.task_results);
  expect(detail.session.drawings?.length === 3, `${label} dashboard drawing rows`, detail.session.drawings);
  expect(detail.session.audio_evidence_reviews?.some(row => row.raw_data?.audioSignedUrl), `${label} dashboard signed audio evidence`, detail.session.audio_evidence_reviews);
  await assertAnonymousStorageDenied('drawings', detail.session.drawings[0]?.storage_path, `${label} anonymous drawing denied`);
  await assertAnonymousStorageDenied('audio', audio.body.storagePath, `${label} anonymous audio denied`);

  const hidden = await request(`/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: otherHeaders,
  });
  expect(hidden.status === 404, `${label} hidden from other clinician after completion`, hidden);
  stats.isolationChecks += 1;

  for (const review of detail.session.drawings) {
    const max = DRAWING_MAX[review.task_id] ?? 0;
    const clinicianScore = Math.min(max, edge.reviewScore(max));
    const saved = await request('/functions/v1/update-drawing-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({ reviewId: review.id, clinicianScore, clinicianNotes: edge.note }),
    });
    expect(saved.status === 200, `${label} drawing review ${review.task_id}`, saved);
  }

  const afterDrawings = await getSession(clinicianHeaders, sessionId);
  for (const review of afterDrawings.session.scoring_reviews) {
    const clinicianScore = Math.min(review.max_score, edge.reviewScore(review.max_score));
    const saved = await request('/functions/v1/update-scoring-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({ reviewId: review.id, clinicianScore, clinicianNotes: edge.note }),
    });
    expect(saved.status === 200, `${label} scoring review ${review.item_id}`, saved);
  }

  const finalDetail = await getSession(clinicianHeaders, sessionId);
  expect(finalDetail.session.status === 'completed', `${label} status completed`, finalDetail.session);
  expect(finalDetail.session.scoring_report?.total_provisional === false, `${label} report finalized`, finalDetail.session.scoring_report);
  expect(finalDetail.session.scoring_report?.pending_review_count === 0, `${label} no pending reviews`, finalDetail.session.scoring_report);
  const adjusted = finalDetail.session.scoring_report?.total_adjusted ?? 0;
  if (adjusted <= 10) stats.scoreBands.low += 1;
  else if (adjusted <= 23) stats.scoreBands.mid += 1;
  else stats.scoreBands.high += 1;

  if (options.negativeStarts && sessionIndex % 10 === 0) {
    const completedStart = await request('/functions/v1/start-session', {
      method: 'POST',
      headers: patientStartHeaders(edge),
      body: JSON.stringify({ token: testNumber }),
    });
    expect(completedStart.status === 404, `${label} completed test number unavailable`, completedStart);
    stats.negativeStartChecks += 1;
  }

  const pdf = await request('/functions/v1/export-pdf', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({ sessionId }),
  });
  expect(pdf.status === 200 && String(pdf.body).startsWith('%PDF'), `${label} pdf export`, { status: pdf.status, bodyPrefix: String(pdf.body).slice(0, 4) });
  stats.pdfExports += 1;

  const csv = await request('/functions/v1/export-csv', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({ sessionId }),
  });
  expect(csv.status === 200 && typeof csv.body === 'string' && csv.body.includes(profile.caseId) && csv.body.includes(version), `${label} csv export`, csv);
  stats.csvExports += 1;

  const audits = await request(`/rest/v1/audit_events?select=event_type&session_id=eq.${sessionId}`, {
    method: 'GET',
    headers: clinicianHeaders,
  });
  const eventTypes = (audits.body || []).map(row => row.event_type);
  for (const eventType of ['session_created', 'session_started', 'stimuli_manifest_requested', 'task_result_submitted', 'audio_saved', 'drawing_saved', 'session_completed']) {
    expect(eventTypes.includes(eventType), `${label} audit ${eventType}`, eventTypes);
  }
  stats.auditChecks += 1;

  const notifications = await request(`/rest/v1/notification_events?select=notification_type,channel,provider,status&session_id=eq.${sessionId}`, {
    method: 'GET',
    headers: clinicianHeaders,
  });
  expect(
    notifications.status === 200 &&
      (notifications.body || []).some(event =>
        event.notification_type === 'clinician_completion_email' &&
        event.channel === 'email' &&
        event.provider === 'resend' &&
        ['sent', 'skipped', 'failed'].includes(event.status)
      ),
    `${label} notification event`,
    notifications,
  );
  stats.notificationChecks += 1;

  stats.sessionsFinalized += 1;
  record('session-ok', { caseId: profile.caseId, sessionId, version, sessionIndex, adjusted });
}

async function submitDrawing(sessionId, linkToken, taskId, edge) {
  const drawing = await request('/functions/v1/save-drawing', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskId,
      strokesData: edge.strokes,
      imageBase64: TINY_PNG,
    }),
  });
  expect(drawing.status === 200 && drawing.body?.storagePath, `${sessionId} save drawing ${taskId}`, drawing);
  await submitResult(sessionId, linkToken, taskId, {
    strokes: edge.strokes,
    storagePath: drawing.body.storagePath,
  });
}

async function submitResult(sessionId, linkToken, taskType, rawData) {
  const result = await request('/functions/v1/submit-results', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ sessionId, linkToken, taskType, rawData }),
  });
  expect(result.status === 200, `${sessionId} submit ${taskType}`, result);
}

async function getSession(headers, sessionId) {
  const detail = await request(`/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers,
  });
  expect(detail.status === 200 && detail.body?.session, `get session ${sessionId}`, detail);
  return detail.body;
}

async function assertAnonymousStorageDenied(bucket, storagePath, message) {
  expect(typeof storagePath === 'string' && storagePath.length > 0, `${message} storage path exists`, storagePath);
  const response = await request(`/storage/v1/object/${bucket}/${storagePath.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'GET',
    headers: anonHeaders(),
  });
  expect([400, 401, 403, 404].includes(response.status), message, response);
  stats.storageDenialChecks += 1;
}

async function preflight() {
  const health = await request('/auth/v1/settings', { method: 'GET', headers: anonHeaders() });
  expect(health.status === 200, 'Supabase auth settings reachable', health);
  const fn = await request('/functions/v1/start-session', { method: 'GET', headers: anonHeaders() });
  expect([400, 405].includes(fn.status), 'Edge Functions reachable', fn);
}

function buildProfile(index) {
  const ages = [60, 61, 65, 70, 79, 80, 89, 90, 100, 130];
  const educations = [0, 1, 6, 8, 12, 16, 22, 40];
  const gender = index % 2 === 0 ? 'male' : 'female';
  const hands = ['right', 'left', 'ambidextrous'];
  const age = ages[index % ages.length];
  const birthYear = 2026 - age;
  const suffix = String(index + 1).padStart(3, '0');
  return {
    index,
    age,
    email: `${batch.toLowerCase()}-clinician-${suffix}@example.test`,
    otherEmail: `${batch.toLowerCase()}-other-${suffix}@example.test`,
    clinicianName: `QA Clinician ${suffix}`,
    clinicName: `QA Edge Clinic ${index % 7}`,
    caseId: `${batch}-P${suffix}`,
    phone: `05${String(10000000 + index).slice(0, 8)}`,
    dateOfBirth: `${birthYear}-04-28`,
    gender,
    dominantHand: hands[index % hands.length],
    educationYears: educations[index % educations.length],
    notes: `bulk flow edge age=${age} education=${educations[index % educations.length]} hand=${hands[index % hands.length]}`,
  };
}

function buildVersionPlan(count) {
  if (count % VERSIONS.length !== 0) fail(`tests-per-patient must be divisible by ${VERSIONS.length}`);
  const perVersion = count / VERSIONS.length;
  return VERSIONS.flatMap(version => Array.from({ length: perVersion }, () => version));
}

async function buildResumePlan(headers, caseId) {
  const finalizedCounts = localFinalizedCounts(caseId);
  const target = options.testsPerPatient / VERSIONS.length;
  const plan = [];
  for (const version of VERSIONS) {
    for (let index = finalizedCounts[version]; index < target; index += 1) {
      plan.push({ version, sessionIndex: VERSIONS.indexOf(version) * target + index });
    }
  }
  console.log(`${caseId} resume finalized counts=${JSON.stringify(finalizedCounts)} missing=${plan.length}`);
  return plan;
}

function buildSessionEdge(profile, version, sessionIndex) {
  const mode = sessionIndex % 6;
  const high = mode === 0 || mode === 3;
  const low = mode === 2 || mode === 5;
  return {
    mode,
    namingWrong: low,
    memoryAttempts: mode + 1,
    vigilance: low ? { score: 0, offTargetTaps: 3 } : { score: 1, offTargetTaps: 0 },
    serial: Array.from({ length: 5 }, (_, i) => ({ isCorrect: high || (!low && i < 3) })),
    language: high ? { rep1: true, rep2: true, fluencyCount: 12 } : low ? { rep1: false, rep2: false, fluencyCount: 2 } : { rep1: true, rep2: false, fluencyCount: 10 },
    abstraction: high ? { pair1: true, pair2: true } : low ? { pair1: false, pair2: false } : { pair1: true, pair2: false },
    recallCount: high ? 5 : low ? 0 : 2,
    place: mode % 2 === 0 ? null : 'מרפאה',
    city: mode % 3 === 0 ? null : 'תל אביב',
    audioType: sessionIndex % 2 === 0 ? 'audio/webm' : 'audio/mp4',
    strokes: low ? [{ x: 1, y: 1 }] : [{ x: 1, y: 1 }, { x: 20, y: 20 }, { x: 30, y: 5 }],
    reviewScore: max => high ? max : low ? 0 : Math.floor(max / 2),
    note: `bulk ${batch} mode=${mode} patient=${profile.index} version=${version}`,
    deviceContext: {
      userAgent: sessionIndex % 2 === 0 ? 'QA iPad Safari' : 'QA iPhone Safari',
      viewport: sessionIndex % 2 === 0 ? '820x1180' : '390x844',
      localPatientOrdinal: profile.index,
    },
    sourceIp: `10.${Math.floor(profile.index / 200)}.${profile.index % 200}.${sessionIndex + 10}`,
  };
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function request(path, init) {
  const retries = isRetryablePath(path) ? options.retries : 0;
  let last;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      const text = await response.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Keep raw text.
      }
      last = { status: response.status, body };
      if (attempt >= retries || !isTransientResponse(last)) return last;
    } catch (error) {
      last = { status: 0, body: { error: error instanceof Error ? error.message : String(error) } };
      if (attempt >= retries) return last;
    }

    await delay(options.retryDelayMs * 2 ** attempt);
  }

  return last;
}

async function signIn(email) {
  const response = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(response.status < 300 && response.body?.access_token, `${email} sign in`, response);
  return response;
}

function anonHeaders() {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    Origin: origin,
  };
}

function patientStartHeaders(edge) {
  return {
    ...anonHeaders(),
    'X-Forwarded-For': edge.sourceIp,
  };
}

function jwtSubject(token) {
  const [, payload] = String(token).split('.');
  const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return json.sub;
}

function readClientEnv() {
  const envPath = resolve(ROOT, 'client/.env.local');
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function expect(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function record(type, payload) {
  appendFileSync(eventsPath, `${JSON.stringify({ type, at: new Date().toISOString(), ...payload })}\n`);
}

function bump(object, key) {
  object[key] = (object[key] || 0) + 1;
}

function parseArgs(args) {
  const parsed = {
    clinicians: 50,
    patients: 50,
    testsPerPatient: 30,
    concurrency: 5,
    progressEvery: 25,
    batch: '',
    negativeStarts: false,
    resumeExisting: false,
    indexes: [],
    retries: 2,
    retryDelayMs: 250,
    cleanupBatch: '',
    reportBatch: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--clinicians') parsed.clinicians = Number(args[++i]);
    else if (arg === '--patients') parsed.patients = Number(args[++i]);
    else if (arg === '--tests-per-patient') parsed.testsPerPatient = Number(args[++i]);
    else if (arg === '--concurrency') parsed.concurrency = Number(args[++i]);
    else if (arg === '--progress-every') parsed.progressEvery = Number(args[++i]);
    else if (arg === '--batch') parsed.batch = args[++i];
    else if (arg === '--negative-starts') parsed.negativeStarts = true;
    else if (arg === '--resume-existing') parsed.resumeExisting = true;
    else if (arg === '--indexes') parsed.indexes = args[++i].split(',').map(value => Number(value.trim()) - 1);
    else if (arg === '--retries') parsed.retries = Number(args[++i]);
    else if (arg === '--retry-delay-ms') parsed.retryDelayMs = Number(args[++i]);
    else if (arg === '--cleanup-batch') parsed.cleanupBatch = args[++i];
    else if (arg === '--report-batch') parsed.reportBatch = args[++i];
    else if (arg === '--help') {
      console.log('Usage: node scripts/bulk-flow-qa.mjs [--batch FLOWQA] [--patients 50 --clinicians 50 --tests-per-patient 30 --concurrency 5] [--negative-starts] [--resume-existing --indexes 9,12] [--report-batch FLOWQA] [--cleanup-batch FLOWQA]');
      process.exit(0);
    }
  }
  if (parsed.cleanupBatch || parsed.reportBatch) return parsed;
  if (parsed.clinicians !== parsed.patients) fail('This runner maps one clinician to one patient; clinicians must equal patients.');
  if (!Number.isInteger(parsed.patients) || parsed.patients < 1) fail('patients must be a positive integer.');
  if (!Number.isInteger(parsed.testsPerPatient) || parsed.testsPerPatient < 1) fail('tests-per-patient must be a positive integer.');
  if (parsed.testsPerPatient % VERSIONS.length !== 0) fail('tests-per-patient must be divisible by 3.');
  if (!Number.isInteger(parsed.concurrency) || parsed.concurrency < 1) fail('concurrency must be a positive integer.');
  if (!Number.isInteger(parsed.retries) || parsed.retries < 0) fail('retries must be a non-negative integer.');
  if (!Number.isInteger(parsed.retryDelayMs) || parsed.retryDelayMs < 0) fail('retry-delay-ms must be a non-negative integer.');
  if (parsed.indexes.some(index => !Number.isInteger(index) || index < 0)) fail('indexes must be comma-separated 1-based patient numbers.');
  if (parsed.resumeExisting && parsed.indexes.length === 0) fail('resume-existing requires --indexes.');
  return parsed;
}

function isRetryablePath(path) {
  return [
    '/functions/v1/save-drawing',
    '/functions/v1/save-audio',
    '/functions/v1/submit-results',
    '/functions/v1/complete-session',
    '/functions/v1/update-drawing-review',
    '/functions/v1/update-scoring-review',
    '/functions/v1/export-pdf',
    '/functions/v1/export-csv',
  ].some(prefix => path.startsWith(prefix));
}

function isTransientResponse(response) {
  if ([502, 503, 504].includes(response.status)) return true;
  if (response.status !== 500) return false;
  const text = JSON.stringify(response.body ?? '');
  return text.includes('WorkerAlreadyRetired') ||
    text.includes('worker has already retired') ||
    text.includes('upstream server');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function localFinalizedCounts(caseId) {
  const sql = `
    select coalesce(json_object_agg(moca_version, finalized), '{}'::json)
    from (
      select s.moca_version, count(*)::int as finalized
      from public.sessions s
      join public.scoring_reports sr on sr.session_id = s.id
      where s.case_id = ${sqlLiteral(caseId)}
        and s.status = 'completed'
        and sr.total_provisional is false
        and sr.pending_review_count = 0
      group by s.moca_version
    ) counted;
  `;
  return { ...Object.fromEntries(VERSIONS.map(version => [version, 0])), ...localPsqlJson(sql) };
}

function localBatchReport(batchName) {
  const pattern = `${batchName}-%`;
  const emailPattern = `${batchName.toLowerCase()}-%`;
  const sql = `
    with batch_sessions as (
      select s.id, s.case_id, s.moca_version, s.status, sr.total_provisional, sr.pending_review_count
      from public.sessions s
      left join public.scoring_reports sr on sr.session_id = s.id
      where s.case_id like ${sqlLiteral(pattern)}
    ),
    version_counts as (
      select coalesce(json_object_agg(moca_version, finalized), '{}'::json) value
      from (
        select moca_version, count(*) filter (
          where status = 'completed' and total_provisional is false and pending_review_count = 0
        )::int finalized
        from batch_sessions
        group by moca_version
      ) counted
    ),
    patient_counts as (
      select coalesce(json_object_agg(finalized, patients), '{}'::json) value
      from (
        select finalized::text, count(*)::int patients
        from (
          select case_id, count(*) filter (
            where status = 'completed' and total_provisional is false and pending_review_count = 0
          )::int finalized
          from batch_sessions
          group by case_id
        ) per_patient
        group by finalized
      ) counted
    )
    select json_build_object(
      'batch', ${sqlLiteral(batchName)},
      'clinicians', (select count(*) from auth.users where email like ${sqlLiteral(emailPattern || '')} and email like '%-clinician-%'),
      'patients', (select count(*) from public.patients where case_id like ${sqlLiteral(pattern)}),
      'sessions', (select count(*) from batch_sessions),
      'finalized', (select count(*) from batch_sessions where status = 'completed' and total_provisional is false and pending_review_count = 0),
      'versionCounts', (select value from version_counts),
      'patientsByFinalizedCount', (select value from patient_counts)
    );
  `;
  return localPsqlJson(sql);
}

function cleanupBatch(batchName) {
  const pattern = `${batchName}-%`;
  const emailPattern = `${batchName.toLowerCase()}%`;
  const before = localBatchReport(batchName);
  const sql = `
    begin;
    create temp table qa_sessions as select id from public.sessions where case_id like ${sqlLiteral(pattern)};
    create temp table qa_patients as select id from public.patients where case_id like ${sqlLiteral(pattern)};
    create temp table qa_users as select id from auth.users where email like ${sqlLiteral(emailPattern)};
    alter table storage.objects disable trigger protect_objects_delete;
    delete from storage.objects o using qa_sessions s where o.name like s.id::text || '/%';
    alter table storage.objects enable trigger protect_objects_delete;
    delete from public.notification_events where session_id in (select id from qa_sessions);
    delete from public.audit_events where session_id in (select id from qa_sessions);
    delete from public.session_events where session_id in (select id from qa_sessions);
    delete from public.scoring_item_reviews where session_id in (select id from qa_sessions);
    delete from public.drawing_reviews where session_id in (select id from qa_sessions);
    delete from public.task_results where session_id in (select id from qa_sessions);
    delete from public.scoring_reports where session_id in (select id from qa_sessions);
    delete from public.patient_start_attempts where session_id in (select id from qa_sessions);
    delete from public.sessions where id in (select id from qa_sessions);
    delete from public.patients where id in (select id from qa_patients);
    delete from auth.refresh_tokens where session_id in (select id from auth.sessions where user_id in (select id from qa_users));
    delete from auth.sessions where user_id in (select id from qa_users);
    delete from auth.identities where user_id in (select id from qa_users);
    delete from public.clinicians where id in (select id from qa_users) or email like ${sqlLiteral(emailPattern)};
    delete from auth.users where id in (select id from qa_users);
    commit;
  `;
  localPsql(sql);
  return { before, after: localBatchReport(batchName) };
}

function localPsqlJson(sql) {
  const output = localPsql(sql).trim();
  return output ? JSON.parse(output) : null;
}

function localPsql(sql) {
  try {
    return execFileSync('docker', [
      'exec',
      'supabase_db_Remote_Assessment_project',
      'psql',
      'postgresql://supabase_admin:postgres@127.0.0.1:5432/postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error
      ? String(error.stderr)
      : '';
    fail(`Local database command failed. Ensure Docker/Supabase is running and this shell can access the Docker socket.\n${stderr.trim()}`);
  }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validateBatch(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    fail('Batch names may only contain letters, numbers, underscore, and dash.');
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
