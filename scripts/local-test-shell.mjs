#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(repoRoot, 'client');
const options = parseArgs(process.argv.slice(2));
const children = [];

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
process.on('exit', () => stopChildren());

if (options.help) {
  printUsage();
  process.exit(0);
}

if (repoRoot.includes('/Library/CloudStorage/') || repoRoot.includes('/OneDrive-')) {
  fail(`Refusing to run from a synced checkout: ${repoRoot}`);
}

console.log('Local-only regression shell');
console.log(`Repo: ${repoRoot}`);
console.log('Hosted Supabase and Netlify env vars are disabled for child commands.');
console.log('');

const localRuntime = options.unitOnly
  ? localPlaceholderRuntime()
  : await ensureLocalRuntime();
const testEnv = localTestEnv(localRuntime);

const checks = [];
if (options.install) checks.push(['client dependency install', 'npm', ['ci', '--legacy-peer-deps'], clientDir]);
checks.push(['client unit tests', 'npm', ['test'], clientDir]);
checks.push(['client scoring coverage', 'npm', ['run', 'test:coverage'], clientDir]);
checks.push(['client app coverage baseline', 'npm', ['run', 'test:coverage:app'], clientDir]);
checks.push(['client lint', 'npm', ['run', 'lint'], clientDir]);
checks.push(['client production build', 'npm', ['run', 'build'], clientDir]);
checks.push(['client surface builds', 'npm', ['run', 'build:surfaces'], clientDir]);
checks.push(['client surface build verification', 'npm', ['run', 'verify:surface-builds'], clientDir]);
checks.push(['Edge Function type check', 'deno', ['check', '--frozen', ...edgeFunctionArgs('deno-check-args')], repoRoot]);
checks.push([
  'Edge Function unit tests',
  'deno',
  [
    'test',
    '--allow-env',
    '--allow-net',
    '--allow-read=client/src/lib/scoring/__fixtures__',
    ...edgeFunctionTestFiles(),
  ],
  repoRoot,
]);

if (!options.unitOnly && !options.skipLocalE2e) {
  const localE2eArgs = ['scripts/local-e2e.mjs', '--all-versions'];
  if (options.skipLicensedPdfCheck) localE2eArgs.push('--skip-licensed-pdf-check');
  checks.push(['scripted local Supabase E2E', 'node', localE2eArgs, repoRoot]);
}

if (!options.unitOnly && !options.skipBrowser) {
  checks.push(['Playwright browser E2E', 'npm', ['run', 'e2e:browser'], clientDir]);
}

for (const [label, command, args, cwd] of checks) {
  run(label, command, args, cwd, testEnv);
}

console.log('');
console.log('Local-only regression shell completed.');

function run(label, command, args, cwd, env) {
  console.log('');
  console.log(`==> ${label}`);
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.error) fail(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}.`);
}

async function ensureLocalRuntime() {
  const supabaseEnv = ensureLocalSupabase();
  const runtime = {
    apiUrl: requireKey(supabaseEnv, 'API_URL'),
    anonKey: requireKey(supabaseEnv, 'ANON_KEY'),
    serviceRoleKey: supabaseEnv.SERVICE_ROLE_KEY ?? '',
    secretKey: supabaseEnv.SECRET_KEY ?? supabaseEnv.SERVICE_ROLE_KEY ?? '',
  };

  writeClientLocalEnv(runtime);

  if (await isEdgeFunctionReachable(runtime.apiUrl)) {
    console.log('Local Edge Functions are already reachable. Reusing them.');
    return runtime;
  }

  console.log('Starting local Edge Functions...');
  const functions = spawn('supabase', ['functions', 'serve', ...edgeFunctionArgs('serve-args'), '--env-file', '/dev/null'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...localTestEnv(runtime),
      ALLOWED_ORIGINS: 'http://127.0.0.1:5173,http://127.0.0.1:5175',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(functions);
  await waitForEdgeFunctions(functions, runtime.apiUrl);
  return runtime;
}

function ensureLocalSupabase() {
  const status = supabaseStatus();
  if (status.ok) return status.env;

  console.log('Local Supabase is not running. Starting it now...');
  let started = spawnSync('supabase', ['start'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (started.status !== 0) {
    console.log('Default Supabase start failed. Retrying without vector/logflare.');
    started = spawnSync('supabase', ['start', '-x', 'vector,logflare'], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    });
  }

  if (started.status !== 0) fail('Could not start local Supabase.');

  const afterStart = supabaseStatus();
  if (!afterStart.ok) fail(afterStart.error || 'Local Supabase did not report status after start.');
  return afterStart.env;
}

function supabaseStatus() {
  const result = spawnSync('supabase', ['status', '-o', 'env'], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }
  return { ok: true, env: parseEnvOutput(result.stdout) };
}

function edgeFunctionArgs(mode) {
  const result = spawnSync('node', ['scripts/edge-functions.mjs', mode], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) fail(result.stderr || `Failed to read Edge Function ${mode}.`);
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}

function edgeFunctionTestFiles() {
  const files = [];
  const sharedDir = join(repoRoot, 'supabase/functions/_shared');
  for (const entry of readdirSync(sharedDir)) {
    if (entry.endsWith('_test.ts')) files.push(relative(repoRoot, join(sharedDir, entry)));
  }

  const functionsDir = join(repoRoot, 'supabase/functions');
  for (const entry of readdirSync(functionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_shared') continue;
    const testPath = join(functionsDir, entry.name, 'index_test.ts');
    if (existsSync(testPath)) files.push(relative(repoRoot, testPath));
  }

  files.sort();
  if (files.length === 0) fail('No Edge Function test files were found.');
  return files;
}

async function waitForEdgeFunctions(child, apiUrl) {
  let output = '';
  let exited = false;

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });
  child.on('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isEdgeFunctionReachable(apiUrl)) {
      console.log('Local Edge Functions are reachable.');
      return;
    }
    if (exited) {
      if (await isEdgeFunctionReachable(apiUrl)) return;
      fail(`Supabase Edge Functions exited before becoming ready.\n${output}`);
    }
    await sleep(2_000);
  }

  fail(`Supabase Edge Functions did not become ready.\n${output}`);
}

async function isEdgeFunctionReachable(apiUrl) {
  try {
    const response = await fetch(new URL('/functions/v1/start-session', apiUrl), {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173' },
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

function writeClientLocalEnv(runtime) {
  const envPath = join(clientDir, '.env.local');
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const next = existing.filter((line) => !/^VITE_SUPABASE_(URL|ANON_KEY)=/.test(line) && line.trim() !== '');
  next.push(`VITE_SUPABASE_URL=${runtime.apiUrl}`);
  next.push(`VITE_SUPABASE_ANON_KEY=${runtime.anonKey}`);
  writeFileSync(envPath, `${next.join('\n')}\n`, { mode: 0o600 });
  console.log(`Wrote local client env: ${relative(repoRoot, envPath)}`);
}

function localTestEnv(runtime) {
  return {
    ...process.env,
    VITE_SUPABASE_URL: runtime.apiUrl,
    VITE_SUPABASE_ANON_KEY: runtime.anonKey,
    SUPABASE_URL: runtime.apiUrl,
    SUPABASE_ANON_KEY: runtime.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: runtime.serviceRoleKey,
    SUPABASE_SECRET_KEY: runtime.secretKey,
    E2E_ORIGIN: 'http://127.0.0.1:5173',
    PATIENT_STAGING_URL: '',
    CLINICIAN_STAGING_URL: '',
    HOSTED_SUPABASE_URL: '',
    HOSTED_SUPABASE_ANON_KEY: '',
    HOSTED_SUPABASE_SERVICE_ROLE_KEY: '',
    NETLIFY_AUTH_TOKEN: '',
    NETLIFY_SITE_ID: '',
  };
}

function localPlaceholderRuntime() {
  return {
    apiUrl: 'http://127.0.0.1:54321',
    anonKey: 'local-unit-only-anon-key',
    serviceRoleKey: '',
    secretKey: '',
  };
}

function parseEnvOutput(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function requireKey(env, key) {
  if (!env[key]) fail(`supabase status did not return ${key}.`);
  return env[key];
}

function parseArgs(args) {
  const parsed = {
    help: false,
    install: false,
    skipBrowser: false,
    skipLicensedPdfCheck: false,
    skipLocalE2e: false,
    unitOnly: false,
  };

  for (const arg of args) {
    if (arg === '--help') parsed.help = true;
    else if (arg === '--install') parsed.install = true;
    else if (arg === '--skip-browser') parsed.skipBrowser = true;
    else if (arg === '--skip-licensed-pdf-check') parsed.skipLicensedPdfCheck = true;
    else if (arg === '--skip-local-e2e') parsed.skipLocalE2e = true;
    else if (arg === '--unit-only') parsed.unitOnly = true;
    else fail(`Unknown option: ${arg}`);
  }

  if (parsed.unitOnly) {
    parsed.skipBrowser = true;
    parsed.skipLocalE2e = true;
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage: node scripts/local-test-shell.mjs [options]

Runs the repo's local-only regression path. It disables hosted Supabase and
Netlify env vars for child commands. The full default path still uses local
Supabase because that is the MVP backend runtime.

Options:
  --install                  run npm ci --legacy-peer-deps first
  --unit-only                run checks that do not require local Supabase
  --skip-browser             skip Playwright browser E2E
  --skip-local-e2e           skip scripts/local-e2e.mjs
  --skip-licensed-pdf-check  pass through to scripts/local-e2e.mjs
  --help                     show this message
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shutdown(code) {
  stopChildren();
  process.exit(code);
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

function fail(message) {
  console.error('');
  console.error(message);
  shutdown(1);
}
