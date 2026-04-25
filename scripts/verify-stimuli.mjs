#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONFIG_PATH = resolve(ROOT, 'supabase/functions/_shared/stimulus-manifest-data.json');
const DEFAULT_URL = 'http://127.0.0.1:54321';

const options = parseArgs(process.argv.slice(2));
const config = readManifestConfig();
const versions = options.allVersions ? config.versions : [options.version || '8.3'];
const manifests = Object.fromEntries(versions.map((version) => [version, buildManifest(config, version, options)]));

if (options.printManifest) {
  console.log(JSON.stringify(manifests, null, 2));
  process.exit(0);
}

const env = readClientEnv();
const supabaseUrl = normalizeUrl(process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_URL);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!serviceKey) {
  fail('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY. Use the local "Secret" value from supabase status, or the hosted project service role key.');
}

const results = [];
for (const [version, manifest] of Object.entries(manifests)) {
  console.log(`\n[${version}] Checking ${manifest.length} required stimulus assets in private bucket "stimuli"`);
  for (const asset of manifest) {
    const result = await verifyAsset(supabaseUrl, serviceKey, asset);
    results.push({ version, ...asset, ...result });
    const marker = result.exists ? 'PASS' : asset.required ? 'FAIL' : 'WARN';
    console.log(`${marker} ${asset.storagePath}${result.exists ? '' : ` (${result.reason})`}`);
  }
}

const missingRequired = results.filter((result) => result.required && !result.exists);
if (options.json) {
  console.log(JSON.stringify({ ok: missingRequired.length === 0, missingRequired, results }, null, 2));
}

if (missingRequired.length > 0) {
  fail(`Missing ${missingRequired.length} required stimulus asset(s). Upload licensed assets to the listed private Storage paths before clinical use.`);
}

console.log('\nStimulus asset verification passed.');

function buildManifest(manifestConfig, version, options) {
  if (!manifestConfig.versions.includes(version)) {
    fail(`Unsupported MoCA version "${version}". Use one of: ${manifestConfig.versions.join(', ')}`);
  }

  return manifestConfig.assets
    .filter((asset) => !options.visualOnly || asset.kind === 'image')
    .map((asset) => ({
      ...asset,
      storagePath: `${version}/${asset.taskType}/${asset.assetId}.${extensionFor(asset.contentType)}`,
    }));
}

async function verifyAsset(supabaseUrl, key, asset) {
  const lastSlash = asset.storagePath.lastIndexOf('/');
  const directory = asset.storagePath.slice(0, lastSlash);
  const fileName = asset.storagePath.slice(lastSlash + 1);

  const response = await fetch(`${supabaseUrl}/storage/v1/object/list/stimuli`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: directory,
      limit: 100,
      offset: 0,
      search: fileName,
    }),
  });

  if (!response.ok) {
    return { exists: false, reason: `storage_list_failed_${response.status}` };
  }

  const files = await response.json();
  const match = Array.isArray(files) ? files.find((file) => file?.name === fileName) : null;
  if (!match) return { exists: false, reason: 'missing_private_asset' };

  const size = match.metadata?.size ?? null;
  const mimetype = match.metadata?.mimetype ?? null;
  if (size === 0) return { exists: false, reason: 'empty_private_asset' };
  if (mimetype && mimetype !== asset.contentType) {
    return { exists: false, reason: `content_type_mismatch_expected_${asset.contentType}_got_${mimetype}` };
  }

  return {
    exists: true,
    reason: null,
    size,
    mimetype,
  };
}

function extensionFor(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'application/pdf') return 'pdf';
  fail(`Unsupported stimulus content type: ${contentType}`);
}

function readManifestConfig() {
  if (!existsSync(CONFIG_PATH)) fail(`Missing manifest config: ${CONFIG_PATH}`);
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function readClientEnv() {
  const envPath = resolve(ROOT, 'client/.env.local');
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function normalizeUrl(url) {
  return url.replace(/\/$/, '');
}

function parseArgs(args) {
  const parsed = { allVersions: false, version: null, json: false, printManifest: false, visualOnly: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--all-versions') parsed.allVersions = true;
    else if (args[i] === '--version') parsed.version = args[++i];
    else if (args[i] === '--json') parsed.json = true;
    else if (args[i] === '--print-manifest') parsed.printManifest = true;
    else if (args[i] === '--visual-only') parsed.visualOnly = true;
    else if (args[i] === '--help') {
      console.log('Usage: node scripts/verify-stimuli.mjs [--version 8.1|8.2|8.3] [--all-versions] [--visual-only] [--json] [--print-manifest]');
      process.exit(0);
    } else {
      fail(`Unknown argument: ${args[i]}`);
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
