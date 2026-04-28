import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const clientDist = path.join(repoRoot, 'client', 'dist');

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

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`surface build verification failed: ${message}`);
  process.exitCode = 1;
}

async function requireFile(filePath) {
  if (!(await exists(filePath))) {
    fail(`missing ${path.relative(repoRoot, filePath)}`);
  }
}

async function requireAbsent(filePath) {
  if (await exists(filePath)) {
    fail(`unexpected ${path.relative(repoRoot, filePath)}`);
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    fail(`${path.relative(repoRoot, filePath)} must contain valid JSON`);
    return {};
  }
}

function verifyPatientManifest(name, manifest) {
  if (!Array.isArray(manifest.icons)) {
    fail(`${name} patient.webmanifest must include icons`);
    return;
  }

  for (const expectedIcon of expectedManifestIcons) {
    const icon = manifest.icons.find((candidate) => candidate?.src === expectedIcon.src);
    if (!icon) {
      fail(`${name} patient.webmanifest missing icon ${expectedIcon.src}`);
      continue;
    }

    for (const field of ['sizes', 'type', 'purpose']) {
      if (icon[field] !== expectedIcon[field]) {
        fail(`${name} patient.webmanifest icon ${expectedIcon.src} must set ${field}=${expectedIcon[field]}`);
      }
    }
  }
}

async function verifyOfflineFallback(name, outDir) {
  const offlineHtml = await readFile(path.join(outDir, 'offline.html'), 'utf8');
  if (!offlineHtml.includes('<title>אין חיבור לאינטרנט</title>')) {
    fail(`${name} offline.html must include the Hebrew offline title`);
  }
  if (!offlineHtml.includes('כדי להתחיל או להמשיך את המבדק יש להתחבר לאינטרנט')) {
    fail(`${name} offline.html must include the Hebrew offline recovery copy`);
  }
}

async function verifyPatientServiceWorker(name, outDir) {
  const serviceWorker = await readFile(path.join(outDir, 'patient-sw.js'), 'utf8');
  if (!serviceWorker.includes('const OFFLINE_URL = "/offline.html"')) {
    fail(`${name} patient-sw.js must wire offline.html as the offline fallback`);
  }
  if (!serviceWorker.includes('caches.match(OFFLINE_URL)')) {
    fail(`${name} patient-sw.js must serve offline.html for failed navigation requests`);
  }
  for (const prefix of forbiddenCachePrefixes) {
    if (!serviceWorker.includes(prefix)) {
      fail(`${name} patient-sw.js must keep ${prefix} out of service-worker caches`);
    }
  }
}

async function verifySurfaceBuildMetadata(name, outDir) {
  const metadataPath = path.join(outDir, 'surface-build.json');
  await requireFile(metadataPath);
  const metadata = await readJson(metadataPath);
  const expectedSurface = name === 'clinician' ? 'clinician' : 'patient';
  const expectedEnvironment = name === 'patient-staging' ? 'staging' : 'production';

  if (metadata.surface !== expectedSurface) {
    fail(`${name} build must set VITE_APP_SURFACE=${expectedSurface}`);
  }
  if (metadata.deployEnvironment !== expectedEnvironment) {
    fail(`${name} build must set VITE_DEPLOY_ENV=${expectedEnvironment}`);
  }
}

async function verifyPatientBuild(name) {
  const outDir = path.join(clientDist, name);
  const indexPath = path.join(outDir, 'index.html');
  const manifestPath = path.join(outDir, 'patient.webmanifest');
  await requireFile(indexPath);
  const indexHtml = await readFile(indexPath, 'utf8');

  if (!indexHtml.includes('<title>Remote Assessment</title>')) {
    fail(`${name} index.html must use the patient PWA title`);
  }
  if (!indexHtml.includes('rel="manifest" href="/patient.webmanifest"')) {
    fail(`${name} index.html must link patient.webmanifest`);
  }
  if (!indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"')) {
    fail(`${name} index.html must include iOS PWA metadata`);
  }

  await Promise.all(patientPwaFiles.map((filename) => requireFile(path.join(outDir, filename))));
  verifyPatientManifest(name, await readJson(manifestPath));
  await verifyOfflineFallback(name, outDir);
  await verifyPatientServiceWorker(name, outDir);
  await verifySurfaceBuildMetadata(name, outDir);
}

async function verifyClinicianBuild() {
  const outDir = path.join(clientDist, 'clinician');
  const indexPath = path.join(outDir, 'index.html');
  await requireFile(indexPath);
  const indexHtml = await readFile(indexPath, 'utf8');

  if (!indexHtml.includes('<title>Remote Check</title>')) {
    fail('clinician index.html must keep the website title');
  }
  if (indexHtml.includes('patient.webmanifest')) {
    fail('clinician index.html must not link patient.webmanifest');
  }
  if (indexHtml.includes('apple-mobile-web-app-capable')) {
    fail('clinician index.html must not include patient PWA metadata');
  }
  await verifySurfaceBuildMetadata('clinician', outDir);

  await Promise.all(patientPwaFiles.map((filename) => requireAbsent(path.join(outDir, filename))));
}

await verifyPatientBuild('patient');
await verifyPatientBuild('patient-staging');
await verifyClinicianBuild();

if (!process.exitCode) {
  console.log('surface build verification passed');
}
