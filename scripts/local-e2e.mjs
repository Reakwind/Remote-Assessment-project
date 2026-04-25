#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_ORIGIN = 'http://127.0.0.1:5173';
const PASSWORD = 'Password123!';

const MOCA_VERSIONS = {
  '8.1': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8-3/MOCA 8.1-Hebrew Test .pdf',
    instructionsPdf: '/Users/etaycohen/Downloads/Hebrew-8-3/Moca Instructions-Hebrew 8.1.pdf',
  },
  '8.2': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8-2/MOCA 8.2-Hebrew Test .pdf',
    instructionsPdf: '/Users/etaycohen/Downloads/Hebrew-8-2/Moca Instructions-Hebrew 8.2.pdf',
  },
  '8.3': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8/MOCA 8.3-Hebrew.pdf',
    instructionsPdf: '/Users/etaycohen/Downloads/Hebrew-8/Moca Instructions-Hebrew 8.3.pdf',
  },
};

const DRAWING_MAX = {
  'moca-visuospatial': 1,
  'moca-cube': 1,
  'moca-clock': 3,
};

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLl9TwAAAABJRU5ErkJggg==';
const FAKE_AUDIO = `data:audio/webm;base64,${Buffer.from('local-e2e-audio').toString('base64')}`;

const options = parseArgs(process.argv.slice(2));
const env = readClientEnv();
const baseUrl = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const origin = process.env.E2E_ORIGIN || DEFAULT_ORIGIN;
const versions = options.allVersions ? Object.keys(MOCA_VERSIONS) : [options.version || '8.3'];

if (!anonKey) {
  fail('Missing Supabase anon key. Set SUPABASE_ANON_KEY or client/.env.local VITE_SUPABASE_ANON_KEY.');
}

for (const version of versions) {
  if (!MOCA_VERSIONS[version]) fail(`Unsupported MoCA version "${version}". Use one of: ${Object.keys(MOCA_VERSIONS).join(', ')}`);
}

console.log(`Local E2E target: ${baseUrl}`);
console.log(`MoCA versions: ${versions.join(', ')}`);
console.log('Licensed PDF check only: this script does not copy or extract MoCA stimuli.');

for (const version of versions) {
  verifyLicensedFiles(version);
}

for (const version of versions) {
  await runVersion(version);
}

console.log('\nE2E verification completed.');

async function runVersion(version) {
  const now = Date.now();
  const email = `local-e2e-${version.replace('.', '-')}-${now}@example.test`;
  const headers = anonHeaders();

  console.log(`\n[${version}] Starting clinician-to-final-report flow`);
  const caseId = `E2E-${version}-${now}`;

  const signup = await request('/auth/v1/signup', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(signup.status < 300 && signup.body?.access_token, `[${version}] clinician signup`, signup);

  const clinicianHeaders = {
    ...headers,
    Authorization: `Bearer ${signup.body.access_token}`,
  };

  const created = await request('/functions/v1/create-session', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({
      caseId,
      mocaVersion: version,
      ageBand: '70-79',
      educationYears: 12,
    }),
  });
  assert(
    created.status === 200 &&
      created.body?.sessionId &&
      created.body?.linkToken &&
      /^\d{8}$/.test(created.body?.testNumber ?? '') &&
      created.body?.mocaVersion === version,
    `[${version}] create session`,
    created,
  );

  const { sessionId, linkToken, testNumber } = created.body;
  const directTokenStart = await request('/functions/v1/start-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: linkToken }),
  });
  assert(directTokenStart.status === 404, `[${version}] internal link token cannot start patient session`, directTokenStart);

  const started = await request('/functions/v1/start-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: testNumber }),
  });
  assert(
    started.status === 200 &&
      started.body?.sessionId === sessionId &&
      started.body?.linkToken === linkToken &&
      started.body?.mocaVersion === version,
    `[${version}] start patient session by test number`,
    started,
  );

  const stimuli = await request('/functions/v1/get-stimuli', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, linkToken }),
  });
  assertStimuliManifest(stimuli, version);

  const reusedStart = await request('/functions/v1/start-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: testNumber }),
  });
  assert(reusedStart.status === 410, `[${version}] one-time test number rejects second start`, reusedStart);

  await submitDrawing(headers, sessionId, linkToken, 'moca-visuospatial');
  await submitDrawing(headers, sessionId, linkToken, 'moca-cube');
  await submitDrawing(headers, sessionId, linkToken, 'moca-clock');

  await submitResult(headers, sessionId, linkToken, 'moca-naming', {
    answers: {
      lion: 'אריה',
      rhino: 'קרנף',
      camel: 'גמל',
    },
  });
  await submitResult(headers, sessionId, linkToken, 'moca-memory-learning', { localFixture: true });
  await submitResult(headers, sessionId, linkToken, 'moca-vigilance', { score: 1 });
  await submitResult(headers, sessionId, linkToken, 'moca-serial-7s', [
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: true },
    { isCorrect: true },
  ]);
  await submitResult(headers, sessionId, linkToken, 'moca-language', { rep1: true, rep2: true, fluencyCount: 11 });
  await submitResult(headers, sessionId, linkToken, 'moca-abstraction', { pair1: true, pair2: true });
  await submitResult(headers, sessionId, linkToken, 'moca-delayed-recall', { recalled: ['פנים', 'קטיפה', 'כנסייה', 'חרצית', 'אדום'] });

  const audio = await request('/functions/v1/save-audio', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskType: 'moca-digit-span',
      audioBase64: FAKE_AUDIO,
      contentType: 'audio/webm',
    }),
  });
  assert(audio.status === 200 && audio.body?.storagePath, `[${version}] save audio review fixture`, audio);
  await submitResult(headers, sessionId, linkToken, 'moca-digit-span', {
    audioStoragePath: audio.body.storagePath,
    audioContentType: audio.body.contentType,
  });

  await submitResult(headers, sessionId, linkToken, 'moca-orientation-task', { localReviewRequired: true });

  const completed = await request('/functions/v1/complete-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, linkToken }),
  });
  assert(completed.status === 200 && completed.body?.scoringReport?.totalProvisional === true, `[${version}] complete provisional report`, completed);

  const completedAgain = await request('/functions/v1/complete-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, linkToken }),
  });
  assert(
    completedAgain.status === 200 && completedAgain.body?.alreadyCompleted === true,
    `[${version}] complete session is idempotent after provisional completion`,
    completedAgain,
  );

  const detail = await getSession(clinicianHeaders, sessionId);
  assert(detail.session.moca_version === version, `[${version}] dashboard preserves MoCA version`, detail.session);
  assert(detail.session.drawings.length === 3, `[${version}] dashboard has 3 drawing review rows`, detail.session.drawings);
  assert(detail.session.scoring_reviews.length >= 1, `[${version}] dashboard has generic scoring review rows`, detail.session.scoring_reviews);
  assert(detail.session.scoring_reviews.some(row => row.raw_data?.audioSignedUrl), `[${version}] at least one review row has signed audio URL`, detail.session.scoring_reviews);

  for (const review of detail.session.drawings) {
    const score = DRAWING_MAX[review.task_id] ?? 0;
    const saved = await request('/functions/v1/update-drawing-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({ reviewId: review.id, clinicianScore: score, clinicianNotes: `local e2e ${version}` }),
    });
    assert(saved.status === 200, `[${version}] save drawing review ${review.task_id}`, saved);
  }

  const afterDrawings = await getSession(clinicianHeaders, sessionId);
  for (const review of afterDrawings.session.scoring_reviews) {
    const saved = await request('/functions/v1/update-scoring-review', {
      method: 'POST',
      headers: clinicianHeaders,
      body: JSON.stringify({ reviewId: review.id, clinicianScore: review.max_score, clinicianNotes: `local e2e ${version}` }),
    });
    assert(saved.status === 200, `[${version}] save generic scoring review ${review.item_id}`, saved);
  }

  const finalDetail = await getSession(clinicianHeaders, sessionId);
  assert(finalDetail.session.scoring_report?.pending_review_count === 0, `[${version}] pending review count is 0`, finalDetail.session.scoring_report);
  assert(finalDetail.session.scoring_report?.total_provisional === false, `[${version}] report is finalized`, finalDetail.session.scoring_report);
  assert(finalDetail.session.status === 'completed', `[${version}] session status completed`, finalDetail.session);

  const completedStart = await request('/functions/v1/start-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token: testNumber }),
  });
  assert(completedStart.status === 404, `[${version}] completed test number is unavailable`, completedStart);

  const pdfExport = await request('/functions/v1/export-pdf', {
    method: 'POST',
    headers: clinicianHeaders,
    body: JSON.stringify({ sessionId }),
  });
  assert(pdfExport.status === 200 && String(pdfExport.body).startsWith('%PDF'), `[${version}] finalized PDF export`, pdfExport);

  const csvExport = await request('/functions/v1/export-csv', {
    method: 'POST',
    headers: clinicianHeaders,
  });
  const csvHasExpectedFields =
    csvExport.status === 200 &&
    typeof csvExport.body === 'string' &&
    csvExport.body.includes('Total Adjusted') &&
    csvExport.body.includes('Domain Scores') &&
    csvExport.body.includes(version) &&
    csvExport.body.includes(caseId);
  assert(
    csvHasExpectedFields,
    `[${version}] completed-session CSV export`,
    csvExport,
  );

  const audits = await request(`/rest/v1/audit_events?select=event_type&session_id=eq.${sessionId}`, {
    method: 'GET',
    headers: clinicianHeaders,
  });
  const eventTypes = (audits.body || []).map(row => row.event_type);
  for (const eventType of ['session_created', 'session_started', 'stimuli_manifest_requested', 'task_result_submitted', 'audio_saved', 'drawing_saved', 'session_completed']) {
    assert(eventTypes.includes(eventType), `[${version}] audit includes ${eventType}`, eventTypes);
  }
  assert(
    eventTypes.some(eventType => eventType.startsWith('clinician_completion_email_')),
    `[${version}] audit includes clinician completion email outcome`,
    eventTypes,
  );

  const notificationEvents = await request(`/rest/v1/notification_events?select=notification_type,channel,provider,status&session_id=eq.${sessionId}`, {
    method: 'GET',
    headers: clinicianHeaders,
  });
  assert(notificationEvents.status === 200, `[${version}] notification events query`, notificationEvents);
  assert(
    (notificationEvents.body || []).some(event =>
      event.notification_type === 'clinician_completion_email' &&
      event.channel === 'email' &&
      event.provider === 'resend' &&
      ['sent', 'skipped', 'failed'].includes(event.status)
    ),
    `[${version}] completion email notification event recorded`,
    notificationEvents.body,
  );

  console.log(`[${version}] OK session=${sessionId} adjusted=${finalDetail.session.scoring_report.total_adjusted}/30 percentile=${finalDetail.session.scoring_report.norm_percentile}`);
}

async function submitDrawing(headers, sessionId, linkToken, taskId) {
  const drawing = await request('/functions/v1/save-drawing', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      linkToken,
      taskId,
      strokesData: [{ x: 1, y: 1 }, { x: 20, y: 20 }],
      imageBase64: TINY_PNG,
    }),
  });
  assert(drawing.status === 200 && drawing.body?.storagePath, `save drawing ${taskId}`, drawing);
  await submitResult(headers, sessionId, linkToken, taskId, {
    strokes: [{ x: 1, y: 1 }, { x: 20, y: 20 }],
    storagePath: drawing.body.storagePath,
  });
}

async function submitResult(headers, sessionId, linkToken, taskType, rawData) {
  const result = await request('/functions/v1/submit-results', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, linkToken, taskType, rawData }),
  });
  assert(result.status === 200, `submit ${taskType}`, result);
}

async function getSession(headers, sessionId) {
  const detail = await request(`/functions/v1/get-session?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers,
  });
  assert(detail.status === 200 && detail.body?.session, `get session ${sessionId}`, detail);
  return detail.body;
}

function assertStimuliManifest(response, version) {
  assert(response.status === 200, `[${version}] get versioned stimulus manifest`, response);
  const body = response.body;
  assert(body?.mocaVersion === version, `[${version}] stimulus manifest preserves MoCA version`, body);
  assert(body?.bucket === 'stimuli', `[${version}] stimulus manifest uses private stimuli bucket`, body);
  assert(Array.isArray(body?.assets) && body.assets.length >= 6, `[${version}] stimulus manifest has expected assets`, body);
  assert(
    body.assets.every((asset) => typeof asset.storagePath === 'string' && asset.storagePath.startsWith(`${version}/`)),
    `[${version}] stimulus storage paths are version scoped`,
    body.assets,
  );
  assert(
    body.assets.some((asset) => asset.taskType === 'moca-naming' && asset.assetId === 'item-1'),
    `[${version}] stimulus manifest includes naming assets`,
    body.assets,
  );
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep raw text.
  }
  return { status: response.status, body };
}

function anonHeaders() {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    Origin: origin,
  };
}

function verifyLicensedFiles(version) {
  const files = MOCA_VERSIONS[version];
  for (const [kind, path] of Object.entries(files)) {
    if (!existsSync(path)) fail(`[${version}] Missing ${kind}: ${path}`);
    const stat = statSync(path);
    const hash = sha256(path);
    console.log(`[${version}] ${kind}: ${path} (${stat.size} bytes, sha256 ${hash.slice(0, 12)}...)`);
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
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

function parseArgs(args) {
  const parsed = { allVersions: false, version: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--all-versions') parsed.allVersions = true;
    if (args[i] === '--version') parsed.version = args[++i];
    if (args[i] === '--help') {
      console.log('Usage: node scripts/local-e2e.mjs [--version 8.1|8.2|8.3] [--all-versions]');
      process.exit(0);
    }
  }
  return parsed;
}

function assert(condition, message, details) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    console.error(JSON.stringify(details, null, 2));
    process.exit(1);
  }
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
