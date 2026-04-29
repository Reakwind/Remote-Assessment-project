#!/usr/bin/env node

const DEFAULT_PATIENT_ORIGIN = 'https://reakwind-remote-assessment-patient-staging.netlify.app';
const DEFAULT_CLINICIAN_ORIGIN = 'https://reakwind-remote-assessment-clinician.netlify.app';
const DEFAULT_MOCA_VERSION = '8.3';
const DEFAULT_PASSWORD = 'Password123!';

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

async function cleanupSmokeRecords() {
  const failures = [];
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
