import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const clientDist = path.join(repoRoot, 'client', 'dist');

const patientPwaFiles = [
  'patient.webmanifest',
  'patient-sw.js',
  'patient-icon.svg',
  'patient-icon-192.png',
  'patient-icon-512.png',
];

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

async function verifyPatientBuild(name) {
  const outDir = path.join(clientDist, name);
  const indexPath = path.join(outDir, 'index.html');
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

  await Promise.all(patientPwaFiles.map((filename) => requireAbsent(path.join(outDir, filename))));
}

await verifyPatientBuild('patient');
await verifyPatientBuild('patient-staging');
await verifyClinicianBuild();

if (!process.exitCode) {
  console.log('surface build verification passed');
}
