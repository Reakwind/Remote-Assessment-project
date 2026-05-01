#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildReviewServerUrls,
  edgeFunctionNames,
  findLanIp,
  isEdgeFunctionReachable,
  spawnCommand,
  supabaseStatus,
  waitForOutput,
} from './review-server-runtime.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manualCheckKeys = [
  'ipadInstalledPwa',
  'microphonePermission',
  'audioPlayback',
  'drawingSave',
  'refreshResume',
  'offlineRetry',
  'patientCompletion',
  'clinicianFinalization',
  'exports',
];
export function createPendingHealth() {
  return {
    supabase: 'pending',
    edgeFunctions: 'pending',
    patientHttps: 'pending',
    clinicianHttps: 'pending',
    supabaseProxy: 'pending',
  };
}

export function mergeHealthResult(health, key, value) {
  return { ...health, [key]: value };
}

export function parseLocalRehearsalArgs(args) {
  const parsed = {
    mode: 'debug',
    patientPort: '5176',
    clinicianPort: '5177',
    host: '0.0.0.0',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inlineValue] = arg.split('=', 2);
    const nextValue = () => inlineValue ?? args[++index];

    if (name === '--mode') parsed.mode = nextValue();
    else if (name === '--confirm-reset') parsed.confirmReset = true;
    else if (name === '--lan-ip') parsed.lanIp = nextValue();
    else if (name === '--patient-port') parsed.patientPort = nextValue();
    else if (name === '--clinician-port') parsed.clinicianPort = nextValue();
    else if (name === '--host') parsed.host = nextValue();
    else if (name === '--https-cert') parsed.httpsCert = nextValue();
    else if (name === '--https-key') parsed.httpsKey = nextValue();
    else if (name === '--skip-automated-checks') parsed.skipAutomatedChecks = true;
    else if (name === '--skip-licensed-pdf-check') parsed.skipLicensedPdfCheck = true;
    else if (name === '--help') parsed.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!['debug', 'readiness'].includes(parsed.mode)) {
    throw new Error('Invalid --mode. Use debug or readiness.');
  }

  return parsed;
}

export function requireReadinessResetConfirmation(options) {
  if (options.mode === 'readiness' && !options.confirmReset) {
    throw new Error('Readiness mode resets local Supabase and requires --confirm-reset.');
  }
}

export function buildAllowedOrigins({ scheme, publicHost, patientPort, clinicianPort }) {
  return [
    `${scheme}://127.0.0.1:${patientPort}`,
    `${scheme}://${publicHost}:${patientPort}`,
    `${scheme}://127.0.0.1:${clinicianPort}`,
    `${scheme}://${publicHost}:${clinicianPort}`,
  ].join(',');
}

export function buildEvidence({
  mode,
  sha,
  publicHost,
  patientUrl,
  clinicianUrl,
  health = createPendingHealth(),
}) {
  return {
    schemaVersion: 1,
    mode,
    commitSha: sha,
    createdAt: new Date().toISOString(),
    macNetworkAddress: publicHost,
    urls: {
      patient: patientUrl,
      clinician: clinicianUrl,
    },
    health,
    automatedChecks: [],
    manualChecks: Object.fromEntries(
      manualCheckKeys.map((key) => [key, { result: 'pending', notes: '' }]),
    ),
    failures: [],
  };
}

function printUsage() {
  console.log([
    'Usage: node scripts/local-rehearsal.mjs --https-cert <path> --https-key <path> [options]',
    '',
    'Options:',
    '  --mode <debug|readiness>       Rehearsal mode. Defaults to debug.',
    '  --confirm-reset                Required with --mode readiness because it resets local Supabase.',
    '  --lan-ip <address>             LAN IP reachable from the iPad. Auto-detected by default.',
    '  --patient-port <port>          Patient HTTPS port. Defaults to 5176.',
    '  --clinician-port <port>        Clinician HTTPS port. Defaults to 5177.',
    '  --host <host>                  Vite host binding. Defaults to 0.0.0.0.',
    '  --https-cert <path>            mkcert certificate file for local HTTPS.',
    '  --https-key <path>             mkcert key file for local HTTPS.',
    '  --skip-automated-checks        Reserved for later automated check-runner tasks.',
    '  --skip-licensed-pdf-check      Reserved for later licensed-stimulus check tasks.',
    '  --help                         Print this usage and exit.',
  ].join('\n'));
}

async function main() {
  const options = parseLocalRehearsalArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  requireReadinessResetConfirmation(options);
  if (!options.httpsCert || !options.httpsKey) {
    throw new Error('Local iPad rehearsal requires --https-cert and --https-key. Generate them with mkcert before running.');
  }
  if (!fs.existsSync(options.httpsCert) || !fs.existsSync(options.httpsKey)) {
    throw new Error('HTTPS certificate or key file does not exist.');
  }

  const publicHost = options.lanIp ?? findLanIp();
  if (!publicHost) throw new Error('Could not detect a LAN IP. Pass --lan-ip.');

  checkRequiredTools();
  const supabaseEnv = ensureLocalSupabase(options);
  const apiUrl = supabaseEnv.API_URL;
  const anonKey = supabaseEnv.ANON_KEY;
  if (!apiUrl || !anonKey) {
    throw new Error('Could not read local Supabase API_URL and ANON_KEY. Run `supabase status -o env` to inspect the local stack.');
  }

  const scheme = 'https';
  const patientUrls = buildReviewServerUrls({ scheme, publicHost, port: options.patientPort });
  const clinicianUrls = buildReviewServerUrls({ scheme, publicHost, port: options.clinicianPort });
  const allowedOrigins = buildAllowedOrigins({
    scheme,
    publicHost,
    patientPort: options.patientPort,
    clinicianPort: options.clinicianPort,
  });
  const children = [];
  let shuttingDown = false;

  const shutdown = () => {
    shuttingDown = true;
    for (const child of children) child.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    for (const child of children) child.kill('SIGTERM');
  });

  if (!(await areEdgeFunctionsReachable(apiUrl, allowedOrigins))) {
    const functions = spawnCommand(
      'supabase',
      ['functions', 'serve', ...edgeFunctionNames({ cwd: repoRoot }), '--env-file', '/dev/null'],
      {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ALLOWED_ORIGINS: allowedOrigins,
        },
      },
    );
    children.push(functions);
    await waitForOutput(functions, /Serving functions on/, 'Supabase Edge Functions');
  }

  const commonReviewArgs = [
    '--lan-ip',
    publicHost,
    '--public-scheme',
    scheme,
    '--https-cert',
    options.httpsCert,
    '--https-key',
    options.httpsKey,
    '--supabase-url',
    apiUrl,
    '--anon-key',
    anonKey,
    '--skip-functions',
  ];
  const patient = spawnReviewServer([
    '--surface',
    'patient',
    '--port',
    options.patientPort,
    '--host',
    options.host,
    ...commonReviewArgs,
  ]);
  const clinician = spawnReviewServer([
    '--surface',
    'clinician',
    '--port',
    options.clinicianPort,
    '--host',
    options.host,
    ...commonReviewArgs,
  ]);
  children.push(patient, clinician);

  for (const child of [patient, clinician]) {
    child.on('exit', (code) => {
      if (!shuttingDown) process.exit(code ?? 1);
    });
  }

  const health = await runHealthChecks({
    apiUrl,
    patientUrl: patientUrls.publicUrl,
    clinicianUrl: clinicianUrls.localUrl,
  });
  const evidencePath = writeEvidenceFile({
    mode: options.mode,
    publicHost,
    patientUrl: patientUrls.publicUrl,
    clinicianUrl: clinicianUrls.localUrl,
    health,
  });

  console.log('');
  console.log('Local rehearsal');
  console.log(`- Patient iPad URL: ${patientUrls.publicUrl}`);
  console.log(`- Clinician Mac URL: ${clinicianUrls.localUrl}`);
  console.log(`- Evidence path: ${evidencePath}`);
  console.log('');
  console.log('Keep this terminal open while testing. Press Ctrl+C to stop.');
  console.log('');
}

function checkRequiredTools() {
  const checks = [
    ['node', ['--version']],
    ['npm', ['--version']],
    ['deno', ['--version']],
    ['supabase', ['--version']],
    ['mkcert', ['--version']],
  ];

  for (const [command, args] of checks) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Required tool is missing or failed: ${command}`);
  }
}

async function areEdgeFunctionsReachable(apiUrl, allowedOrigins) {
  const origins = allowedOrigins.split(',').filter(Boolean);
  const results = await Promise.all(
    origins.map((origin) => isEdgeFunctionReachable(apiUrl, origin)),
  );
  return results.every(Boolean);
}

async function checkUrl(url, init = {}) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500) return true;
    } catch {
      // Keep polling until the local server finishes starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function runHealthChecks({ apiUrl, patientUrl, clinicianUrl }) {
  let health = createPendingHealth();
  health = mergeHealthResult(
    health,
    'supabase',
    await checkUrl(new URL('/auth/v1/settings', apiUrl)) ? 'pass' : 'fail',
  );
  health = mergeHealthResult(
    health,
    'edgeFunctions',
    await checkUrl(new URL('/functions/v1/start-session', apiUrl), {
      method: 'OPTIONS',
      headers: { Origin: patientUrl },
    }) ? 'pass' : 'fail',
  );
  health = mergeHealthResult(health, 'patientHttps', await checkUrl(patientUrl) ? 'pass' : 'fail');
  health = mergeHealthResult(health, 'clinicianHttps', await checkUrl(clinicianUrl) ? 'pass' : 'fail');
  health = mergeHealthResult(
    health,
    'supabaseProxy',
    await checkUrl(`${patientUrl}/supabase/auth/v1/settings`) ? 'pass' : 'fail',
  );
  return health;
}

function ensureLocalSupabase(options) {
  let status = supabaseStatus({ cwd: repoRoot });
  if (!status.ok) {
    const started = spawnSync('supabase', ['start'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    if (started.status !== 0) throw new Error('Failed to start local Supabase.');
    status = supabaseStatus({ cwd: repoRoot });
  }
  if (!status.ok) throw new Error(status.error || 'Local Supabase did not report status after start.');

  if (options.mode === 'readiness') {
    const reset = spawnSync('supabase', ['db', 'reset'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    if (reset.status !== 0) throw new Error('Failed to reset local Supabase.');
    status = supabaseStatus({ cwd: repoRoot });
    if (!status.ok) throw new Error(status.error || 'Local Supabase did not report status after reset.');
  }

  return status.env;
}

function spawnReviewServer(args) {
  return spawnCommand('node', ['scripts/review-server.mjs', ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

function writeEvidenceFile({ mode, publicHost, patientUrl, clinicianUrl, health }) {
  const sha = readCommitSha();
  const evidence = buildEvidence({ mode, sha, publicHost, patientUrl, clinicianUrl, health });
  const evidenceDir = path.join(repoRoot, 'local-rehearsal-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const timestamp = evidence.createdAt.replace(/[:.]/g, '-');
  const evidencePath = path.join(evidenceDir, `${timestamp}-${mode}.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  return evidencePath;
}

function readCommitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
