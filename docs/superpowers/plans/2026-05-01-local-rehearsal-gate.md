# Local Rehearsal Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trusted local HTTPS rehearsal gate that proves the clinician website and patient PWA work locally on Mac plus iPad before deployment is discussed.

**Architecture:** Extend the existing local review-server path instead of creating a second serving stack. Shared script helpers handle local Supabase, Edge Functions, LAN IPs, HTTPS cert paths, health checks, and evidence files. A new `scripts/local-rehearsal.mjs` orchestrates readiness and debug modes, while `scripts/review-server.mjs` remains the per-surface server.

**Tech Stack:** Node ESM scripts, Node `node:test`, Supabase CLI, local Supabase/Edge Functions, Vite dev server, React/Vite client, mkcert-generated local certificates.

---

## File Structure

- Create `scripts/review-server-runtime.mjs`: shared helpers for local Supabase status, Edge Function args, LAN IP detection, URL construction, health checks, and child-process cleanup.
- Create `scripts/review-server-runtime.test.mjs`: unit tests for pure runtime helpers.
- Modify `scripts/review-server.mjs`: use shared helpers and add HTTPS options: `--https-cert`, `--https-key`, `--public-scheme`.
- Modify `client/vite.config.ts`: support HTTPS dev server options from `VITE_LOCAL_HTTPS_CERT` and `VITE_LOCAL_HTTPS_KEY`, while keeping the existing `/supabase` proxy.
- Create `scripts/local-rehearsal.mjs`: orchestrator with `--mode debug|readiness`, clean reset guard, cert checks, health checks, server startup, automated check commands, and evidence file creation.
- Create `scripts/local-rehearsal.test.mjs`: unit tests for mode parsing, reset guard, origin building, and evidence payload creation.
- Create `docs/LOCAL_REHEARSAL_GATE.md`: human runbook for Mac plus iPad rehearsal.
- Create `docs/LOCAL_REHEARSAL_EVIDENCE.example.json`: physical-device evidence template.
- Modify `.gitignore`: ignore generated local rehearsal evidence.
- Modify `README.md`, `AGENTS.md`, `docs/LOCAL_E2E_VERIFICATION.md`, and `docs/PATIENT_PWA_DEPLOYMENT.md`: link the gate and update local iPad guidance.

## Task 1: Extract Shared Review-Server Runtime Helpers

**Files:**
- Create: `scripts/review-server-runtime.mjs`
- Create: `scripts/review-server-runtime.test.mjs`
- Modify: `scripts/review-server.mjs`

- [ ] **Step 1: Write failing runtime helper tests**

Create `scripts/review-server-runtime.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewServerUrls,
  parseEnvOutput,
  parseReviewServerArgs,
  reviewServerScriptName,
} from './review-server-runtime.mjs';

test('buildReviewServerUrls returns local, public, and Supabase proxy URLs', () => {
  assert.deepEqual(
    buildReviewServerUrls({
      scheme: 'https',
      publicHost: '192.168.1.230',
      port: '5176',
    }),
    {
      localUrl: 'https://127.0.0.1:5176',
      publicUrl: 'https://192.168.1.230:5176',
      supabaseProxyUrl: 'https://192.168.1.230:5176/supabase',
    },
  );
});

test('parseEnvOutput accepts quoted Supabase status output', () => {
  assert.equal(parseEnvOutput('API_URL="http://127.0.0.1:54321"\\nANON_KEY="abc"\\n').API_URL, 'http://127.0.0.1:54321');
  assert.equal(parseEnvOutput('API_URL="http://127.0.0.1:54321"\\nANON_KEY="abc"\\n').ANON_KEY, 'abc');
});

test('parseReviewServerArgs parses HTTPS options', () => {
  assert.deepEqual(
    parseReviewServerArgs([
      '--surface',
      'patient',
      '--port',
      '5176',
      '--lan-ip',
      '192.168.1.230',
      '--https-cert',
      '.certs/local.pem',
      '--https-key',
      '.certs/local-key.pem',
    ]),
    {
      surface: 'patient',
      port: '5176',
      lanIp: '192.168.1.230',
      httpsCert: '.certs/local.pem',
      httpsKey: '.certs/local-key.pem',
    },
  );
});

test('reviewServerScriptName maps surface to npm script', () => {
  assert.equal(reviewServerScriptName('patient'), 'dev:patient');
  assert.equal(reviewServerScriptName('clinician'), 'dev:clinician');
  assert.equal(reviewServerScriptName('combined'), 'dev');
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
node --test scripts/review-server-runtime.test.mjs
```

Expected: fail with `Cannot find module` for `scripts/review-server-runtime.mjs`.

- [ ] **Step 3: Create the shared runtime helper module**

Create `scripts/review-server-runtime.mjs`:

```js
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';

export function parseEnvOutput(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export function parseReviewServerArgs(args) {
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
    else if (arg === '--https-cert') parsed.httpsCert = args[++index];
    else if (arg === '--https-key') parsed.httpsKey = args[++index];
    else if (arg === '--public-scheme') parsed.publicScheme = args[++index];
    else if (arg === '--help') parsed.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

export function buildReviewServerUrls({ scheme, publicHost, port }) {
  const publicUrl = `${scheme}://${publicHost}:${port}`;
  return {
    localUrl: `${scheme}://127.0.0.1:${port}`,
    publicUrl,
    supabaseProxyUrl: `${publicUrl}/supabase`,
  };
}

export function reviewServerScriptName(surface) {
  return surface === 'combined' ? 'dev' : `dev:${surface}`;
}

export function findLanIp() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

export function filePath(url) {
  return decodeURIComponent(url.pathname);
}

export function supabaseStatus({ cwd, env = process.env } = {}) {
  const result = spawnSync('supabase', ['status', '-o', 'env'], {
    cwd,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }
  return { ok: true, env: parseEnvOutput(result.stdout) };
}

export function edgeFunctionNames({ cwd, env = process.env }) {
  const result = spawnSync('node', ['scripts/edge-functions.mjs', 'serve-args'], {
    cwd,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) throw new Error(result.stderr || 'Failed to read Edge Function list.');
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}

export async function isEdgeFunctionReachable(baseUrl, origin) {
  try {
    const response = await fetch(new URL('/functions/v1/start-session', baseUrl), {
      method: 'OPTIONS',
      headers: { Origin: origin },
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

export async function waitForOutput(child, pattern, label) {
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

export function spawnCommand(command, args, options) {
  return spawn(command, args, options);
}
```

- [ ] **Step 4: Refactor `scripts/review-server.mjs` to use shared helpers**

Replace the duplicated helpers in `scripts/review-server.mjs` with imports:

```js
import { spawnSync } from 'node:child_process';
import {
  buildReviewServerUrls,
  edgeFunctionNames,
  filePath,
  findLanIp,
  isEdgeFunctionReachable,
  parseReviewServerArgs,
  reviewServerScriptName,
  spawnCommand,
  supabaseStatus,
  waitForOutput,
} from './review-server-runtime.mjs';
```

Then update option initialization:

```js
const options = parseReviewServerArgs(process.argv.slice(2));
const surface = options.surface ?? 'patient';
const port = options.port ?? '5173';
const host = options.host ?? '0.0.0.0';
const lanIp = options.lanIp ?? findLanIp();
const publicHost = lanIp ?? '127.0.0.1';
const scheme = options.publicScheme ?? (options.httpsCert && options.httpsKey ? 'https' : 'http');
const { localUrl, publicUrl, supabaseProxyUrl } = buildReviewServerUrls({ scheme, publicHost, port });
```

Keep the existing `ensureLocalSupabase` logic, but call `supabaseStatus({ cwd: filePath(repoRoot) })` inside it. Replace `spawn(...)` calls with `spawnCommand(...)`. Replace `edgeFunctionNames()` with `edgeFunctionNames({ cwd: filePath(repoRoot) })`. Remove local copies of `parseEnvOutput`, `findLanIp`, `filePath`, `waitForOutput`, and `parseArgs`.

- [ ] **Step 5: Run helper tests**

Run:

```bash
node --test scripts/review-server-runtime.test.mjs
```

Expected: all tests pass.

- [ ] **Step 6: Smoke the existing HTTP review server still starts**

Run:

```bash
node scripts/review-server.mjs --surface patient --port 5176 --skip-functions
```

Expected: terminal prints `Review server`, `Surface: patient`, and an iPad URL. Stop it with `Ctrl+C`.

- [ ] **Step 7: Commit**

```bash
git add scripts/review-server-runtime.mjs scripts/review-server-runtime.test.mjs scripts/review-server.mjs
git commit -m "Extract local review server runtime helpers"
```

## Task 2: Add HTTPS Support To Local Review Server

**Files:**
- Modify: `client/vite.config.ts`
- Modify: `scripts/review-server.mjs`
- Modify: `scripts/review-server-runtime.test.mjs`

- [ ] **Step 1: Add failing HTTPS URL test**

Append to `scripts/review-server-runtime.test.mjs`:

```js
test('parseReviewServerArgs rejects partial HTTPS cert configuration in callers', () => {
  const parsed = parseReviewServerArgs(['--https-cert', '.certs/local.pem']);
  assert.equal(parsed.httpsCert, '.certs/local.pem');
  assert.equal(parsed.httpsKey, undefined);
});
```

Run:

```bash
node --test scripts/review-server-runtime.test.mjs
```

Expected: pass. This locks parser behavior before adding caller validation.

- [ ] **Step 2: Add Vite HTTPS config support**

Modify `client/vite.config.ts`:

```ts
import { readFileSync } from 'fs';
```

Inside `defineConfig`, after local Supabase proxy values:

```ts
  const localHttpsCert = env.VITE_LOCAL_HTTPS_CERT;
  const localHttpsKey = env.VITE_LOCAL_HTTPS_KEY;
  const https =
    localHttpsCert && localHttpsKey
      ? {
          cert: readFileSync(localHttpsCert),
          key: readFileSync(localHttpsKey),
        }
      : undefined;
  const proxy = localSupabaseProxy
    ? {
        '/supabase': {
          target: localSupabaseProxyTarget,
          changeOrigin: true,
          rewrite: (requestPath: string) => requestPath.replace(/^\/supabase/, ''),
        },
      }
    : undefined;
```

Replace the existing `server` block with:

```ts
    server: https || proxy ? { https, proxy } : undefined,
```

- [ ] **Step 3: Pass HTTPS env from review server to Vite**

In `scripts/review-server.mjs`, before spawning Vite, validate cert options:

```js
if ((options.httpsCert && !options.httpsKey) || (!options.httpsCert && options.httpsKey)) {
  fail('Both --https-cert and --https-key are required for HTTPS review server mode.');
}
```

Add these environment values to the Vite spawn:

```js
    VITE_LOCAL_HTTPS_CERT: options.httpsCert ?? '',
    VITE_LOCAL_HTTPS_KEY: options.httpsKey ?? '',
```

Ensure the printed URLs use `https` when both cert and key are supplied.

- [ ] **Step 4: Run type and build checks**

Run:

```bash
cd client
npm run build
cd ..
node --test scripts/review-server-runtime.test.mjs
```

Expected: client build passes and Node helper tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/vite.config.ts scripts/review-server.mjs scripts/review-server-runtime.test.mjs
git commit -m "Support HTTPS local review servers"
```

## Task 3: Add Local Rehearsal CLI And Evidence Helpers

**Files:**
- Create: `scripts/local-rehearsal.mjs`
- Create: `scripts/local-rehearsal.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing CLI helper tests**

Create `scripts/local-rehearsal.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllowedOrigins,
  buildEvidence,
  parseLocalRehearsalArgs,
  requireReadinessResetConfirmation,
} from './local-rehearsal.mjs';

test('parseLocalRehearsalArgs defaults to debug mode', () => {
  assert.deepEqual(parseLocalRehearsalArgs([]), {
    mode: 'debug',
    patientPort: '5176',
    clinicianPort: '5177',
    host: '0.0.0.0',
  });
});

test('readiness mode requires reset confirmation', () => {
  assert.throws(
    () => requireReadinessResetConfirmation({ mode: 'readiness' }),
    /requires --confirm-reset/,
  );
  assert.doesNotThrow(() => requireReadinessResetConfirmation({ mode: 'readiness', confirmReset: true }));
});

test('buildAllowedOrigins includes local and public HTTPS origins', () => {
  assert.equal(
    buildAllowedOrigins({
      scheme: 'https',
      publicHost: '192.168.1.230',
      patientPort: '5176',
      clinicianPort: '5177',
    }),
    'https://127.0.0.1:5176,https://192.168.1.230:5176,https://127.0.0.1:5177,https://192.168.1.230:5177',
  );
});

test('buildEvidence creates a stable evidence object', () => {
  const evidence = buildEvidence({
    mode: 'debug',
    sha: 'abc123',
    publicHost: '192.168.1.230',
    patientUrl: 'https://192.168.1.230:5176',
    clinicianUrl: 'https://192.168.1.230:5177',
  });
  assert.equal(evidence.mode, 'debug');
  assert.equal(evidence.commitSha, 'abc123');
  assert.equal(evidence.urls.patient, 'https://192.168.1.230:5176');
  assert.equal(evidence.manualChecks.ipadInstalledPwa.result, 'pending');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: fail because `scripts/local-rehearsal.mjs` does not exist.

- [ ] **Step 3: Create `scripts/local-rehearsal.mjs` with exported helpers**

Create the CLI with this structure:

```js
#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import {
  buildReviewServerUrls,
  edgeFunctionNames,
  findLanIp,
  isEdgeFunctionReachable,
  spawnCommand,
  supabaseStatus,
  waitForOutput,
} from './review-server-runtime.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const isMain = import.meta.url === `file://${process.argv[1]}`;

export function parseLocalRehearsalArgs(args) {
  const parsed = {
    mode: 'debug',
    patientPort: '5176',
    clinicianPort: '5177',
    host: '0.0.0.0',
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--mode') parsed.mode = args[++index];
    else if (arg === '--confirm-reset') parsed.confirmReset = true;
    else if (arg === '--lan-ip') parsed.lanIp = args[++index];
    else if (arg === '--patient-port') parsed.patientPort = args[++index];
    else if (arg === '--clinician-port') parsed.clinicianPort = args[++index];
    else if (arg === '--host') parsed.host = args[++index];
    else if (arg === '--https-cert') parsed.httpsCert = args[++index];
    else if (arg === '--https-key') parsed.httpsKey = args[++index];
    else if (arg === '--skip-automated-checks') parsed.skipAutomatedChecks = true;
    else if (arg === '--skip-licensed-pdf-check') parsed.skipLicensedPdfCheck = true;
    else if (arg === '--help') parsed.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!['debug', 'readiness'].includes(parsed.mode)) throw new Error('--mode must be debug or readiness');
  return parsed;
}

export function requireReadinessResetConfirmation(options) {
  if (options.mode === 'readiness' && options.confirmReset !== true) {
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

export function buildEvidence({ mode, sha, publicHost, patientUrl, clinicianUrl }) {
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
    health: {
      supabase: 'pending',
      edgeFunctions: 'pending',
      patientHttps: 'pending',
      clinicianHttps: 'pending',
      supabaseProxy: 'pending',
    },
    automatedChecks: [],
    manualChecks: {
      ipadInstalledPwa: { result: 'pending', notes: '' },
      microphonePermission: { result: 'pending', notes: '' },
      audioPlayback: { result: 'pending', notes: '' },
      drawingSave: { result: 'pending', notes: '' },
      refreshResume: { result: 'pending', notes: '' },
      offlineRetry: { result: 'pending', notes: '' },
      patientCompletion: { result: 'pending', notes: '' },
      clinicianFinalization: { result: 'pending', notes: '' },
      exports: { result: 'pending', notes: '' },
    },
    failures: [],
  };
}
```

Add the CLI body below the helpers:

```js
if (isMain) {
  const options = parseLocalRehearsalArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }
  run(options).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
```

Implement `run(options)` with these concrete actions:

```js
async function run(options) {
  requireReadinessResetConfirmation(options);
  if (!options.httpsCert || !options.httpsKey) {
    throw new Error('Local iPad rehearsal requires --https-cert and --https-key. Generate them with mkcert before running.');
  }
  if (!existsSync(options.httpsCert) || !existsSync(options.httpsKey)) {
    throw new Error('HTTPS certificate or key file does not exist.');
  }

  const publicHost = options.lanIp ?? findLanIp();
  if (!publicHost) throw new Error('Could not detect a LAN IP. Pass --lan-ip.');

  ensureTool('node', ['--version']);
  ensureTool('npm', ['--version']);
  ensureTool('deno', ['--version']);
  ensureTool('supabase', ['--version']);
  ensureTool('mkcert', ['-version']);

  ensureSupabase(options);
  const status = supabaseStatus({ cwd: repoRoot });
  if (!status.ok) throw new Error(status.error || 'Local Supabase is not reachable.');

  const apiUrl = status.env.API_URL;
  const anonKey = status.env.ANON_KEY;
  const allowedOrigins = buildAllowedOrigins({
    scheme: 'https',
    publicHost,
    patientPort: options.patientPort,
    clinicianPort: options.clinicianPort,
  });

  const functionChild = await startFunctions({ apiUrl, allowedOrigins });
  const children = [functionChild];

  const patientUrls = buildReviewServerUrls({ scheme: 'https', publicHost, port: options.patientPort });
  const clinicianUrls = buildReviewServerUrls({ scheme: 'https', publicHost, port: options.clinicianPort });

  children.push(startReviewServer('patient', options.patientPort, publicHost, options, apiUrl, anonKey));
  children.push(startReviewServer('clinician', options.clinicianPort, publicHost, options, apiUrl, anonKey));

  const sha = gitSha();
  const evidence = buildEvidence({
    mode: options.mode,
    sha,
    publicHost,
    patientUrl: patientUrls.publicUrl,
    clinicianUrl: clinicianUrls.publicUrl,
  });
  const evidencePath = writeEvidence(evidence);

  console.log('');
  console.log('Local rehearsal is running.');
  console.log(`Patient iPad URL: ${patientUrls.publicUrl}`);
  console.log(`Clinician Mac URL: ${clinicianUrls.localUrl}`);
  console.log(`Evidence file: ${evidencePath}`);
  console.log('');
  console.log('Keep this terminal open while testing. Press Ctrl+C to stop.');

  process.on('SIGINT', () => {
    for (const child of children) child.kill('SIGTERM');
    process.exit(0);
  });
}
```

Implement the called helpers:

```js
function ensureTool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Required tool is missing or failed: ${command}`);
}

function ensureSupabase(options) {
  const status = supabaseStatus({ cwd: repoRoot });
  if (!status.ok) {
    const started = spawnSync('supabase', ['start'], { cwd: repoRoot, stdio: 'inherit' });
    if (started.status !== 0) throw new Error('Failed to start local Supabase.');
  }
  if (options.mode === 'readiness') {
    const reset = spawnSync('supabase', ['db', 'reset'], { cwd: repoRoot, stdio: 'inherit' });
    if (reset.status !== 0) throw new Error('Failed to reset local Supabase.');
  }
}

async function startFunctions({ apiUrl, allowedOrigins }) {
  if (await isEdgeFunctionReachable(apiUrl, allowedOrigins.split(',')[0])) {
    console.log('Local Edge Functions are already reachable. Reusing them.');
    return { kill() {} };
  }
  const child = spawnCommand('supabase', ['functions', 'serve', ...edgeFunctionNames({ cwd: repoRoot }), '--env-file', '/dev/null'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ALLOWED_ORIGINS: allowedOrigins },
  });
  await waitForOutput(child, /Serving functions on/, 'Supabase Edge Functions');
  return child;
}

function startReviewServer(surface, port, publicHost, options, apiUrl, anonKey) {
  return spawn('node', [
    'scripts/review-server.mjs',
    '--surface',
    surface,
    '--port',
    port,
    '--lan-ip',
    publicHost,
    '--public-scheme',
    'https',
    '--https-cert',
    options.httpsCert,
    '--https-key',
    options.httpsKey,
    '--supabase-url',
    apiUrl,
    '--anon-key',
    anonKey,
    '--skip-functions',
  ], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function writeEvidence(evidence) {
  const dir = join(repoRoot, 'local-rehearsal-evidence');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${evidence.createdAt.replace(/[:.]/g, '-')}-${evidence.mode}.json`);
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  return path;
}

function printUsage() {
  console.log(`Usage: node scripts/local-rehearsal.mjs --mode debug|readiness --https-cert <cert> --https-key <key> [options]

Options:
  --mode debug|readiness     debug preserves local data; readiness requires --confirm-reset
  --confirm-reset            required for readiness mode
  --lan-ip <ip>              override detected LAN IP
  --patient-port <port>      default 5176
  --clinician-port <port>    default 5177
  --https-cert <path>        mkcert certificate path
  --https-key <path>         mkcert private key path
  --help                     show this message`);
}
```

- [ ] **Step 4: Ignore generated local evidence**

Add to `.gitignore`:

```gitignore
local-rehearsal-evidence/
```

- [ ] **Step 5: Run local rehearsal unit tests**

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: all tests pass.

- [ ] **Step 6: Run help smoke**

Run:

```bash
node scripts/local-rehearsal.mjs --help
```

Expected: usage prints without starting Supabase.

- [ ] **Step 7: Commit**

```bash
git add .gitignore scripts/local-rehearsal.mjs scripts/local-rehearsal.test.mjs
git commit -m "Add local rehearsal gate CLI"
```

## Task 4: Add Local Health Checks To Rehearsal CLI

**Files:**
- Modify: `scripts/local-rehearsal.mjs`
- Modify: `scripts/local-rehearsal.test.mjs`

- [ ] **Step 1: Add failing health helper test**

Update the existing `scripts/local-rehearsal.test.mjs` import from `./local-rehearsal.mjs` to include `createPendingHealth` and `mergeHealthResult`, then append:

```js
test('createPendingHealth lists required local rehearsal checks', () => {
  assert.deepEqual(createPendingHealth(), {
    supabase: 'pending',
    edgeFunctions: 'pending',
    patientHttps: 'pending',
    clinicianHttps: 'pending',
    supabaseProxy: 'pending',
  });
});

test('mergeHealthResult updates one health field immutably', () => {
  assert.deepEqual(mergeHealthResult(createPendingHealth(), 'patientHttps', 'pass'), {
    supabase: 'pending',
    edgeFunctions: 'pending',
    patientHttps: 'pass',
    clinicianHttps: 'pending',
    supabaseProxy: 'pending',
  });
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: fail because `createPendingHealth` is not exported.

- [ ] **Step 3: Add health helpers**

Add to `scripts/local-rehearsal.mjs`:

```js
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
  health = mergeHealthResult(health, 'supabase', await checkUrl(new URL('/auth/v1/settings', apiUrl)) ? 'pass' : 'fail');
  health = mergeHealthResult(
    health,
    'edgeFunctions',
    await checkUrl(new URL('/functions/v1/start-session', apiUrl), { method: 'OPTIONS', headers: { Origin: patientUrl } }) ? 'pass' : 'fail',
  );
  health = mergeHealthResult(health, 'patientHttps', await checkUrl(patientUrl) ? 'pass' : 'fail');
  health = mergeHealthResult(health, 'clinicianHttps', await checkUrl(clinicianUrl) ? 'pass' : 'fail');
  health = mergeHealthResult(health, 'supabaseProxy', await checkUrl(`${patientUrl}/supabase/auth/v1/settings`) ? 'pass' : 'fail');
  return health;
}
```

In `buildEvidence`, replace the hard-coded health object with:

```js
    health: createPendingHealth(),
```

After both review servers start and before writing evidence, run:

```js
  evidence.health = await runHealthChecks({
    apiUrl,
    patientUrl: patientUrls.publicUrl,
    clinicianUrl: clinicianUrls.publicUrl,
  });
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/local-rehearsal.mjs scripts/local-rehearsal.test.mjs
git commit -m "Add local rehearsal health checks"
```

## Task 5: Add Automated Check Runner Hook To Rehearsal CLI

**Files:**
- Modify: `scripts/local-rehearsal.mjs`
- Modify: `scripts/local-rehearsal.test.mjs`

- [ ] **Step 1: Add failing automated check command test**

Update the existing import in `scripts/local-rehearsal.test.mjs` to include `automatedCheckCommands`, then append the test:

```js
test('automatedCheckCommands includes frontend and backend local checks', () => {
  assert.deepEqual(automatedCheckCommands({ skipLicensedPdfCheck: true }).map((check) => check.label), [
    'client unit tests',
    'client lint',
    'client build',
    'client surface builds',
    'client surface verification',
    'local regression shell',
    'Playwright browser E2E',
    'scripted local Supabase E2E',
  ]);
});
```

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: fail because `automatedCheckCommands` is not exported.

- [ ] **Step 2: Add command list and runner**

Add to `scripts/local-rehearsal.mjs`:

```js
export function automatedCheckCommands({ skipLicensedPdfCheck = false } = {}) {
  const localE2eArgs = ['scripts/local-e2e.mjs', '--all-versions'];
  if (skipLicensedPdfCheck) localE2eArgs.push('--skip-licensed-pdf-check');
  return [
    { label: 'client unit tests', command: 'npm', args: ['test'], cwd: join(repoRoot, 'client') },
    { label: 'client lint', command: 'npm', args: ['run', 'lint'], cwd: join(repoRoot, 'client') },
    { label: 'client build', command: 'npm', args: ['run', 'build'], cwd: join(repoRoot, 'client') },
    { label: 'client surface builds', command: 'npm', args: ['run', 'build:surfaces'], cwd: join(repoRoot, 'client') },
    { label: 'client surface verification', command: 'npm', args: ['run', 'verify:surface-builds'], cwd: join(repoRoot, 'client') },
    { label: 'local regression shell', command: 'node', args: ['scripts/local-test-shell.mjs', '--skip-browser'], cwd: repoRoot },
    { label: 'Playwright browser E2E', command: 'npm', args: ['run', 'e2e:browser'], cwd: join(repoRoot, 'client') },
    { label: 'scripted local Supabase E2E', command: 'node', args: localE2eArgs, cwd: repoRoot },
  ];
}

function runAutomatedChecks(options) {
  if (options.skipAutomatedChecks) return [];
  const results = [];
  for (const check of automatedCheckCommands({ skipLicensedPdfCheck: options.skipLicensedPdfCheck })) {
    console.log(`\n==> ${check.label}`);
    const startedAt = new Date().toISOString();
    const result = spawnSync(check.command, check.args, { cwd: check.cwd, stdio: 'inherit', env: process.env });
    const passed = result.status === 0;
    results.push({ label: check.label, passed, startedAt, finishedAt: new Date().toISOString() });
    if (!passed) throw new Error(`${check.label} failed with exit code ${result.status}.`);
  }
  return results;
}
```

Call it inside `run(options)` before starting long-running HTTPS servers:

```js
  const automatedResults = runAutomatedChecks(options);
  const evidence = buildEvidence({
    mode: options.mode,
    sha: gitSha(),
    publicHost,
    patientUrl: buildReviewServerUrls({
      scheme: 'https',
      publicHost,
      port: options.patientPort,
    }).publicUrl,
    clinicianUrl: buildReviewServerUrls({
      scheme: 'https',
      publicHost,
      port: options.clinicianPort,
    }).publicUrl,
  });
  evidence.automatedChecks = automatedResults;
```

- [ ] **Step 3: Run unit tests**

Run:

```bash
node --test scripts/local-rehearsal.test.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/local-rehearsal.mjs scripts/local-rehearsal.test.mjs
git commit -m "Add automated checks to local rehearsal"
```

## Task 6: Document Certificate Setup And Evidence Workflow

**Files:**
- Create: `docs/LOCAL_REHEARSAL_GATE.md`
- Create: `docs/LOCAL_REHEARSAL_EVIDENCE.example.json`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/LOCAL_E2E_VERIFICATION.md`
- Modify: `docs/PATIENT_PWA_DEPLOYMENT.md`

- [ ] **Step 1: Create evidence example**

Create `docs/LOCAL_REHEARSAL_EVIDENCE.example.json`:

```json
{
  "schemaVersion": 1,
  "mode": "readiness",
  "commitSha": "example",
  "createdAt": "2026-05-01T00:00:00.000Z",
  "macNetworkAddress": "192.168.1.230",
  "urls": {
    "patient": "https://192.168.1.230:5176",
    "clinician": "https://192.168.1.230:5177"
  },
  "health": {
    "supabase": "pass",
    "edgeFunctions": "pass",
    "patientHttps": "pass",
    "clinicianHttps": "pass",
    "supabaseProxy": "pass"
  },
  "automatedChecks": [],
  "manualChecks": {
    "ipadInstalledPwa": { "result": "pending", "notes": "" },
    "microphonePermission": { "result": "pending", "notes": "" },
    "audioPlayback": { "result": "pending", "notes": "" },
    "drawingSave": { "result": "pending", "notes": "" },
    "refreshResume": { "result": "pending", "notes": "" },
    "offlineRetry": { "result": "pending", "notes": "" },
    "patientCompletion": { "result": "pending", "notes": "" },
    "clinicianFinalization": { "result": "pending", "notes": "" },
    "exports": { "result": "pending", "notes": "" }
  },
  "failures": []
}
```

- [ ] **Step 2: Create runbook**

Create `docs/LOCAL_REHEARSAL_GATE.md`:

```md
# Local Rehearsal Gate

This gate proves the clinician website and patient PWA work locally on Mac plus iPad before hosted deployment is discussed.

## Modes

- Debug mode preserves local data and is used to reproduce failures.
- Readiness mode resets local Supabase and is the only mode that can certify deployment readiness.

## Certificate Setup

Install `mkcert`, then create a certificate for the Mac LAN IP:

```bash
mkdir -p .certs
mkcert -install
mkcert -cert-file .certs/remote-assessment-local.pem -key-file .certs/remote-assessment-local-key.pem 127.0.0.1 localhost <mac-lan-ip>
```

Install and trust the mkcert root certificate on the iPad before installed-PWA testing.

## Debug Mode

```bash
node scripts/local-rehearsal.mjs --mode debug --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem
```

## Readiness Mode

Readiness mode resets local Supabase:

```bash
node scripts/local-rehearsal.mjs --mode readiness --confirm-reset --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem
```

## Manual iPad Evidence

Use the printed patient URL on the iPad. Complete the installed-PWA flow, microphone/audio checks, drawing save, refresh/resume, offline/retry, completion, clinician finalization, and export checks. Update the generated JSON evidence file under `local-rehearsal-evidence/`.
```

- [ ] **Step 3: Link the runbook from existing docs**

Add a short link in `README.md` under local checks:

```md
Use [docs/LOCAL_REHEARSAL_GATE.md](docs/LOCAL_REHEARSAL_GATE.md) for Mac plus iPad HTTPS rehearsal before deployment readiness.
```

Add a focused row in `AGENTS.md` focused docs table:

```md
| Local Mac plus iPad HTTPS rehearsal | [docs/LOCAL_REHEARSAL_GATE.md](docs/LOCAL_REHEARSAL_GATE.md) |
```

Add a short note in `docs/LOCAL_E2E_VERIFICATION.md` after the backend runner section:

```md
For physical-device readiness, use `docs/LOCAL_REHEARSAL_GATE.md`. Local browser E2E is required but does not replace installed iPad PWA evidence.
```

Replace the local iPad paragraph in `docs/PATIENT_PWA_DEPLOYMENT.md` with a link to the new runbook and keep the HTTP caveat for `scripts/review-server.mjs`.

- [ ] **Step 4: Run doc link checks by search**

Run:

```bash
rg -n "LOCAL_REHEARSAL_GATE|LOCAL_REHEARSAL_EVIDENCE" README.md AGENTS.md docs
```

Expected: all new doc links are discoverable.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md docs/LOCAL_E2E_VERIFICATION.md docs/PATIENT_PWA_DEPLOYMENT.md docs/LOCAL_REHEARSAL_GATE.md docs/LOCAL_REHEARSAL_EVIDENCE.example.json
git commit -m "Document local rehearsal gate"
```

## Task 7: Verify The Local Rehearsal Path

**Files:**
- No source edits unless verification exposes a bug.

- [ ] **Step 1: Run unit tests for new scripts**

Run:

```bash
node --test scripts/review-server-runtime.test.mjs scripts/local-rehearsal.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run client baseline**

Run:

```bash
cd client
npm test
npm run lint
npm run build
npm run build:surfaces
npm run verify:surface-builds
cd ..
```

Expected: all checks pass.

- [ ] **Step 3: Run debug help and reset guard checks**

Run:

```bash
node scripts/local-rehearsal.mjs --help
node scripts/local-rehearsal.mjs --mode readiness --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem
```

Expected: help prints; readiness command fails before reset with `requires --confirm-reset`.

- [ ] **Step 4: Run debug server startup when certs exist**

Run:

```bash
node scripts/local-rehearsal.mjs --mode debug --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem --skip-automated-checks
```

Expected: patient and clinician HTTPS URLs print. Open both from the Mac and confirm they load. Stop with `Ctrl+C`.

- [ ] **Step 5: Commit verification doc note if needed**

If verification reveals an environment-specific caveat, update `docs/LOCAL_REHEARSAL_GATE.md` with the exact caveat and commit:

```bash
git add docs/LOCAL_REHEARSAL_GATE.md
git commit -m "Clarify local rehearsal verification"
```
