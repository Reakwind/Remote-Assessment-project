#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';

const options = parseArgs(process.argv.slice(2));
const surface = options.surface ?? 'patient';
const port = options.port ?? '5173';
const host = options.host ?? '0.0.0.0';
const clientDir = new URL('../client/', import.meta.url);
const repoRoot = new URL('../', import.meta.url);
const lanIp = options.lanIp ?? findLanIp();
const publicHost = lanIp ?? '127.0.0.1';
const publicUrl = `http://${publicHost}:${port}`;
const localUrl = `http://127.0.0.1:${port}`;

if (!['patient', 'clinician', 'combined'].includes(surface)) {
  fail(`Unsupported --surface ${surface}. Use patient, clinician, or combined.`);
}

const supabaseEnv = ensureLocalSupabase();
const apiUrl = options.supabaseUrl ?? supabaseEnv.API_URL;
const anonKey = options.anonKey ?? supabaseEnv.ANON_KEY;

if (!apiUrl || !anonKey) {
  fail('Could not read local Supabase API_URL and ANON_KEY. Run `supabase status -o env` to inspect the local stack.');
}

const children = [];
let shuttingDown = false;

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  for (const child of children) child.kill('SIGTERM');
});

if (!options.skipFunctions) {
  if (await isEdgeFunctionReachable(apiUrl)) {
    console.log('Local Supabase Edge Functions are already reachable. Reusing them.');
  } else {
    const functionNames = edgeFunctionNames();
    const functions = spawn('supabase', ['functions', 'serve', ...functionNames, '--env-file', '/dev/null'], {
      cwd: filePath(repoRoot),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ALLOWED_ORIGINS: [
          localUrl,
          publicUrl,
          process.env.ALLOWED_ORIGINS,
        ].filter(Boolean).join(','),
      },
    });
    children.push(functions);
    await waitForOutput(functions, /Serving functions on/, 'Supabase Edge Functions');
  }
}

const supabaseProxyUrl = `${publicUrl}/supabase`;
const scriptName = surface === 'combined' ? 'dev' : `dev:${surface}`;

console.log('');
console.log('Review server');
console.log(`- Mac URL: ${localUrl}`);
console.log(`- iPad URL: ${publicUrl}`);
console.log(`- Surface: ${surface}`);
console.log(`- Supabase proxy: ${supabaseProxyUrl} -> ${apiUrl}`);
console.log('');
console.log('Keep this terminal open while testing. Press Ctrl+C to stop.');
console.log('');

const vite = spawn('npm', ['run', scriptName, '--', '--host', host, '--port', port, '--strictPort'], {
  cwd: filePath(clientDir),
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_APP_SURFACE: surface === 'combined' ? 'combined' : surface,
    VITE_DEPLOY_ENV: 'local',
    VITE_LOCAL_SUPABASE_PROXY: '1',
    VITE_LOCAL_SUPABASE_PROXY_TARGET: apiUrl,
    VITE_SUPABASE_URL: supabaseProxyUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
  },
});
children.push(vite);

vite.on('exit', (code) => {
  if (!shuttingDown) process.exit(code ?? 1);
});

function ensureLocalSupabase() {
  const status = supabaseStatus();
  if (status.ok) return status.env;

  console.log('Local Supabase is not reachable. Starting it now...');
  const started = spawnSync('supabase', ['start'], {
    cwd: filePath(repoRoot),
    stdio: 'inherit',
    env: process.env,
  });
  if (started.status !== 0) fail('Failed to start local Supabase.');

  const afterStart = supabaseStatus();
  if (!afterStart.ok) fail(afterStart.error || 'Local Supabase did not report status after start.');
  return afterStart.env;
}

function supabaseStatus() {
  const result = spawnSync('supabase', ['status', '-o', 'env'], {
    cwd: filePath(repoRoot),
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }
  return { ok: true, env: parseEnvOutput(result.stdout) };
}

function edgeFunctionNames() {
  const result = spawnSync('node', ['scripts/edge-functions.mjs', 'serve-args'], {
    cwd: filePath(repoRoot),
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) fail(result.stderr || 'Failed to read Edge Function list.');
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}

async function isEdgeFunctionReachable(baseUrl) {
  try {
    const response = await fetch(new URL('/functions/v1/start-session', baseUrl), {
      method: 'OPTIONS',
      headers: { Origin: localUrl },
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

function parseEnvOutput(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

async function waitForOutput(child, pattern, label) {
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    buffer += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} did not become ready.\n${buffer}`));
    }, 120_000);
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`${label} exited before becoming ready with code ${code}.`));
    });
    child.stdout.on('data', () => {
      if (pattern.test(buffer)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

function shutdown() {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
}

function findLanIp() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--skip-functions') parsed.skipFunctions = true;
    else if (arg === '--surface') parsed.surface = args[++index];
    else if (arg === '--port') parsed.port = args[++index];
    else if (arg === '--host') parsed.host = args[++index];
    else if (arg === '--lan-ip') parsed.lanIp = args[++index];
    else if (arg === '--supabase-url') parsed.supabaseUrl = args[++index];
    else if (arg === '--anon-key') parsed.anonKey = args[++index];
    else if (arg === '--help') {
      console.log('Usage: node scripts/review-server.mjs [--surface patient|clinician|combined] [--port 5173]');
      process.exit(0);
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function filePath(url) {
  return decodeURIComponent(url.pathname);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
