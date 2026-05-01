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

export function buildReviewServerHttpsEnv({ httpsCert, httpsKey } = {}) {
  if (!httpsCert || !httpsKey) return {};
  return {
    VITE_LOCAL_HTTPS_CERT: httpsCert,
    VITE_LOCAL_HTTPS_KEY: httpsKey,
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
