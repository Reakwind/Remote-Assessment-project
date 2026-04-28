import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const clientDist = path.join(repoRoot, 'client', 'dist');
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has('--json');
const failOnBlocked = args.has('--fail-on-blocked');

const patientPwaFiles = [
  'patient.webmanifest',
  'patient-sw.js',
  'offline.html',
  'patient-icon.svg',
  'patient-icon-192.png',
  'patient-icon-512.png',
];

const expectedManifestIcons = [
  { src: '/patient-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
  { src: '/patient-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
  { src: '/patient-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
];

const forbiddenCachePrefixes = ['"/auth/"', '"/functions/"', '"/rest/"', '"/storage/"'];

const realDeviceModes = [
  {
    mode: 'ipad-installed-pwa',
    label: 'iPadOS Safari installed PWA',
    checks: [
      'install-from-patient-staging',
      'standalone-open',
      'test-number-entry',
      'preflight',
      'drawing',
      'audio',
      'naming',
      'completion',
      'resume-after-relaunch',
    ],
  },
  {
    mode: 'tablet-browser-fallback',
    label: 'Tablet browser fallback',
    checks: [
      'browser-open',
      'test-number-entry',
      'preflight',
      'drawing',
      'audio',
      'naming',
      'completion',
      'controls-reachable-with-browser-chrome',
    ],
  },
  {
    mode: 'phone-portrait-fallback',
    label: 'Phone portrait fallback',
    checks: [
      'phone-portrait',
      'test-number-entry',
      'preflight',
      'drawing',
      'audio',
      'naming',
      'phone-drawing-flagged',
    ],
  },
];

const results = [];

function record(gate, status, detail) {
  results.push({ gate, status, detail });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function verifyManifestIcons(name, manifest) {
  const failures = [];
  if (!Array.isArray(manifest.icons)) {
    return ['manifest icons'];
  }

  for (const expectedIcon of expectedManifestIcons) {
    const icon = manifest.icons.find((candidate) => candidate?.src === expectedIcon.src);
    if (!icon) {
      failures.push(`manifest icon ${expectedIcon.src}`);
      continue;
    }

    for (const field of ['sizes', 'type', 'purpose']) {
      if (icon[field] !== expectedIcon[field]) {
        failures.push(`manifest icon ${expectedIcon.src} ${field}`);
      }
    }
  }

  return failures.map((failure) => `${name} ${failure}`);
}

function verifyOfflineFallback(offlineHtml) {
  const failures = [];
  if (!offlineHtml?.includes('<title>אין חיבור לאינטרנט</title>')) {
    failures.push('offline title');
  }
  if (!offlineHtml?.includes('כדי להתחיל או להמשיך את המבדק יש להתחבר לאינטרנט')) {
    failures.push('offline recovery copy');
  }
  return failures;
}

function verifyPatientServiceWorker(serviceWorker) {
  const failures = [];
  if (!serviceWorker?.includes('const OFFLINE_URL = "/offline.html"')) {
    failures.push('offline fallback URL');
  }
  if (!serviceWorker?.includes('caches.match(OFFLINE_URL)')) {
    failures.push('offline navigation fallback');
  }
  for (const prefix of forbiddenCachePrefixes) {
    if (!serviceWorker?.includes(prefix)) {
      failures.push(`forbidden cache prefix ${prefix}`);
    }
  }
  return failures;
}

async function verifySurfaceBuildMetadata(name, outDir) {
  const metadataText = await readText(path.join(outDir, 'surface-build.json'));
  if (!metadataText) return ['surface build metadata'];

  try {
    const metadata = JSON.parse(metadataText);
    const expectedSurface = name === 'clinician' ? 'clinician' : 'patient';
    const expectedEnvironment = name === 'patient-staging' ? 'staging' : 'production';
    const failures = [];
    if (metadata.surface !== expectedSurface) failures.push('surface flag');
    if (metadata.deployEnvironment !== expectedEnvironment) failures.push(`${expectedEnvironment} deploy flag`);
    return failures;
  } catch {
    return ['surface build metadata JSON'];
  }
}

async function verifyPatientOutput(name) {
  const outDir = path.join(clientDist, name);
  const indexPath = path.join(outDir, 'index.html');
  const manifestPath = path.join(outDir, 'patient.webmanifest');
  const offlinePath = path.join(outDir, 'offline.html');
  const serviceWorkerPath = path.join(outDir, 'patient-sw.js');
  const indexHtml = await readText(indexPath);
  const manifestText = await readText(manifestPath);
  const offlineHtml = await readText(offlinePath);
  const serviceWorker = await readText(serviceWorkerPath);
  const missingFiles = [];

  for (const filename of ['index.html', ...patientPwaFiles]) {
    if (!(await exists(path.join(outDir, filename)))) missingFiles.push(filename);
  }

  if (missingFiles.length > 0) {
    record(
      `local:${name}`,
      'fail',
      `Missing built files in client/dist/${name}: ${missingFiles.join(', ')}`,
    );
    return;
  }

  const failures = [];
  if (!indexHtml?.includes('<title>Remote Assessment</title>')) {
    failures.push('patient title');
  }
  if (!indexHtml?.includes('rel="manifest" href="/patient.webmanifest"')) {
    failures.push('manifest link');
  }
  if (!indexHtml?.includes('name="apple-mobile-web-app-capable" content="yes"')) {
    failures.push('iOS PWA metadata');
  }
  try {
    const manifest = JSON.parse(manifestText ?? '{}');
    if (manifest.name !== 'Remote Assessment') failures.push('manifest name');
    if (manifest.short_name !== 'Assessment') failures.push('manifest short_name');
    if (manifest.start_url !== '/#/') failures.push('manifest start_url');
    if (manifest.scope !== '/') failures.push('manifest scope');
    if (manifest.display !== 'standalone') failures.push('manifest display');
    failures.push(...verifyManifestIcons(name, manifest));
  } catch {
    failures.push('manifest JSON');
  }
  failures.push(...verifyOfflineFallback(offlineHtml));
  failures.push(...verifyPatientServiceWorker(serviceWorker));

  failures.push(...(await verifySurfaceBuildMetadata(name, outDir)));

  if (failures.length > 0) {
    record(`local:${name}`, 'fail', `Invalid patient output: ${failures.join(', ')}`);
    return;
  }

  record(`local:${name}`, 'pass', `client/dist/${name} has patient PWA shell assets`);
}

async function verifyClinicianOutput() {
  const outDir = path.join(clientDist, 'clinician');
  const indexPath = path.join(outDir, 'index.html');
  const indexHtml = await readText(indexPath);
  const failures = [];

  if (!(await exists(indexPath))) failures.push('missing index.html');
  if (!indexHtml?.includes('<title>Remote Check</title>')) failures.push('clinician title');
  if (indexHtml?.includes('patient.webmanifest')) failures.push('patient manifest leak');
  if (indexHtml?.includes('apple-mobile-web-app-capable')) failures.push('patient iOS metadata leak');
  failures.push(...(await verifySurfaceBuildMetadata('clinician', outDir)));

  for (const filename of patientPwaFiles) {
    if (await exists(path.join(outDir, filename))) failures.push(`unexpected ${filename}`);
  }

  if (failures.length > 0) {
    record('local:clinician', 'fail', `Invalid clinician output: ${failures.join(', ')}`);
    return;
  }

  record('local:clinician', 'pass', 'client/dist/clinician excludes patient PWA assets');
}

async function recordExternalGates() {
  const patientStagingUrl = process.env.PATIENT_STAGING_URL;
  const clinicianStagingUrl = process.env.CLINICIAN_STAGING_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const realDeviceEvidence = process.env.PATIENT_PWA_REAL_DEVICE_EVIDENCE;
  const realDeviceEvidenceFile = process.env.PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE;

  record(
    'external:hosted-staging',
    patientStagingUrl && clinicianStagingUrl ? 'manual' : 'blocked',
    patientStagingUrl && clinicianStagingUrl
      ? `Staging URLs provided; verify HTTPS, route fallback, manifest, service worker, and clinician-route redirect manually: ${patientStagingUrl} / ${clinicianStagingUrl}`
      : 'Set PATIENT_STAGING_URL and CLINICIAN_STAGING_URL after deployment, then run hosted smoke checks from docs/PATIENT_PWA_PILOT_READINESS.md',
  );

  record(
    'external:licensed-stimuli',
    supabaseUrl && serviceKey ? 'manual' : 'blocked',
    supabaseUrl && serviceKey
      ? 'Supabase credentials are present; run node scripts/verify-stimuli.mjs --all-versions against the intended project'
      : 'Requires SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY after licensed assets are uploaded',
  );

  if (realDeviceEvidenceFile) {
    const { errors } = await readRealDeviceEvidence(realDeviceEvidenceFile);
    record(
      'external:real-device',
      errors.length === 0 ? 'manual' : 'fail',
      errors.length === 0
        ? `Real-device evidence file covers required iPad installed-PWA, tablet browser, and phone fallback checks: ${realDeviceEvidenceFile}`
        : `Invalid real-device evidence file ${realDeviceEvidenceFile}: ${errors.join('; ')}`,
    );
    return;
  }

  record(
    'external:real-device',
    realDeviceEvidence ? 'manual' : 'blocked',
    realDeviceEvidence
      ? `Real-device evidence note provided: ${realDeviceEvidence}`
      : 'Requires PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE with installed-PWA iPad/tablet QA plus phone fallback checks',
  );
}

function printReport() {
  if (jsonOutput) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }

  console.log('Patient PWA readiness report');
  for (const result of results) {
    console.log(`- [${result.status}] ${result.gate}: ${result.detail}`);
  }
}

function parseHttpsUrl(value, label) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? null : `${label} must use https://`;
  } catch {
    return `${label} must be a valid URL`;
  }
}

function validateRealDeviceEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['Evidence file must contain a JSON object'];
  }
  if (!Array.isArray(evidence.runs)) {
    return ['Evidence file must contain a runs array'];
  }

  for (const requiredMode of realDeviceModes) {
    const run = evidence.runs.find((candidate) => candidate?.mode === requiredMode.mode);
    if (!run) {
      errors.push(`Missing ${requiredMode.label} run (${requiredMode.mode})`);
      continue;
    }

    for (const field of ['device', 'osBrowserVersion', 'stagingUrl', 'mocaVersion', 'verifiedAt']) {
      if (typeof run[field] !== 'string' || run[field].trim() === '') {
        errors.push(`${requiredMode.mode} must include ${field}`);
      }
    }

    const urlError = parseHttpsUrl(run.stagingUrl, `${requiredMode.mode}.stagingUrl`);
    if (urlError) errors.push(urlError);
    if (run.result !== 'pass') {
      errors.push(`${requiredMode.mode} result must be pass`);
    }
    if (!Array.isArray(run.checks)) {
      errors.push(`${requiredMode.mode} checks must be an array`);
      continue;
    }

    for (const check of requiredMode.checks) {
      if (!run.checks.includes(check)) {
        errors.push(`${requiredMode.mode} missing check ${check}`);
      }
    }
  }

  return errors;
}

async function readRealDeviceEvidence(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const content = await readText(resolvedPath);
  if (content == null) {
    return { errors: [`Real-device evidence file not found: ${filePath}`] };
  }

  try {
    const evidence = JSON.parse(content);
    return { errors: validateRealDeviceEvidence(evidence), evidence };
  } catch {
    return { errors: [`Real-device evidence file is not valid JSON: ${filePath}`] };
  }
}

await verifyPatientOutput('patient');
await verifyPatientOutput('patient-staging');
await verifyClinicianOutput();
await recordExternalGates();
printReport();

const hasFailure = results.some((result) => result.status === 'fail');
const hasBlocked = results.some((result) => result.status === 'blocked');
if (hasFailure || (failOnBlocked && hasBlocked)) {
  process.exitCode = 1;
}
