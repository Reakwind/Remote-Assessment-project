#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  buildReviewServerHttpsEnv,
  buildReviewServerUrls,
  edgeFunctionNames,
  filePath,
  findLanIp,
  isEdgeFunctionReachable,
  parseReviewServerArgs,
  resolveReviewServerScheme,
  reviewServerScriptName,
  spawnCommand,
  supabaseStatus,
  waitForOutput,
} from './review-server-runtime.mjs';

const options = parseReviewServerArgs(process.argv.slice(2));
if (options.help) {
  console.log([
    'Usage: node scripts/review-server.mjs [--surface patient|clinician|combined] [--port 5173]',
    '',
    'Options:',
    '  --https-cert <path>       Local HTTPS certificate file for Vite.',
    '  --https-key <path>        Local HTTPS key file for Vite.',
    '  --public-scheme <scheme>  Public URL scheme to print and allow, usually http or https.',
  ].join('\n'));
  process.exit(0);
}
const surface = options.surface ?? 'patient';
const port = options.port ?? '5173';
const host = options.host ?? '0.0.0.0';
const clientDir = new URL('../client/', import.meta.url);
const repoRoot = new URL('../', import.meta.url);
const lanIp = options.lanIp ?? findLanIp();
const publicHost = lanIp ?? '127.0.0.1';
let scheme;
try {
  scheme = resolveReviewServerScheme(options);
} catch (error) {
  fail(error.message);
}
const { localUrl, publicUrl, supabaseProxyUrl } = buildReviewServerUrls({ scheme, publicHost, port });
const httpsEnv = buildReviewServerHttpsEnv(options);

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
  if (await isEdgeFunctionReachable(apiUrl, localUrl)) {
    console.log('Local Supabase Edge Functions are already reachable. Reusing them.');
  } else {
    const functionNames = edgeFunctionNames({ cwd: filePath(repoRoot) });
    const functions = spawnCommand('supabase', ['functions', 'serve', ...functionNames, '--env-file', '/dev/null'], {
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

const scriptName = reviewServerScriptName(surface);

console.log('');
console.log('Review server');
console.log(`- Mac URL: ${localUrl}`);
console.log(`- iPad URL: ${publicUrl}`);
console.log(`- Surface: ${surface}`);
console.log(`- Supabase proxy: ${supabaseProxyUrl} -> ${apiUrl}`);
console.log('');
console.log('Keep this terminal open while testing. Press Ctrl+C to stop.');
console.log('');

const vite = spawnCommand('npm', ['run', scriptName, '--', '--host', host, '--port', port, '--strictPort'], {
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
    ...httpsEnv,
  },
});
children.push(vite);

vite.on('exit', (code) => {
  if (!shuttingDown) process.exit(code ?? 1);
});

function ensureLocalSupabase() {
  const status = supabaseStatus({ cwd: filePath(repoRoot) });
  if (status.ok) return status.env;

  console.log('Local Supabase is not reachable. Starting it now...');
  const started = spawnSync('supabase', ['start'], {
    cwd: filePath(repoRoot),
    stdio: 'inherit',
    env: process.env,
  });
  if (started.status !== 0) fail('Failed to start local Supabase.');

  const afterStart = supabaseStatus({ cwd: filePath(repoRoot) });
  if (!afterStart.ok) fail(afterStart.error || 'Local Supabase did not report status after start.');
  return afterStart.env;
}

function shutdown() {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
