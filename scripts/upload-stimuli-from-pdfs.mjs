#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_URL = 'http://127.0.0.1:54321';
const DEFAULT_OUT_DIR = '/tmp/moca-stimuli';

const VERSION_CONFIG = {
  '8.1': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8-3/MOCA 8.1-Hebrew Test .pdf',
    crops: {
      'moca-visuospatial/trail-template.png': [185, 175, 365, 78],
      'moca-cube/cube-stimulus.png': [90, 95, 252, 72],
      'moca-naming/item-1.png': [150, 95, 400, 294],
      'moca-naming/item-2.png': [155, 95, 230, 294],
      'moca-naming/item-3.png': [145, 105, 42, 286],
    },
  },
  '8.2': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8-2/MOCA 8.2-Hebrew Test .pdf',
    crops: {
      'moca-visuospatial/trail-template.png': [185, 175, 370, 78],
      'moca-cube/cube-stimulus.png': [80, 110, 268, 74],
      'moca-naming/item-1.png': [115, 95, 430, 294],
      'moca-naming/item-2.png': [155, 100, 235, 290],
      'moca-naming/item-3.png': [175, 95, 45, 300],
    },
  },
  '8.3': {
    testPdf: '/Users/etaycohen/Downloads/Hebrew-8/MOCA 8.3-Hebrew.pdf',
    crops: {
      'moca-visuospatial/trail-template.png': [185, 175, 365, 78],
      'moca-cube/cube-stimulus.png': [130, 110, 230, 75],
      'moca-naming/item-1.png': [135, 100, 410, 294],
      'moca-naming/item-2.png': [170, 95, 220, 294],
      'moca-naming/item-3.png': [140, 105, 70, 286],
    },
  },
};

const options = parseArgs(process.argv.slice(2));
const versions = options.allVersions ? Object.keys(VERSION_CONFIG) : [options.version || '8.3'];
for (const version of versions) {
  if (!VERSION_CONFIG[version]) fail(`Unsupported MoCA version "${version}". Use one of: ${Object.keys(VERSION_CONFIG).join(', ')}`);
}

const env = readClientEnv();
const supabaseUrl = normalizeUrl(process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_URL);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (options.upload && !serviceKey) {
  fail('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY for --upload.');
}

console.log(`Preparing visual MoCA stimuli under ${options.outDir}`);

for (const version of versions) {
  const config = VERSION_CONFIG[version];
  if (!existsSync(config.testPdf)) fail(`Missing licensed test PDF for ${version}: ${config.testPdf}`);

  const renderedPage = resolve(options.outDir, `.rendered-${version}.jpg`);
  mkdirSync(options.outDir, { recursive: true });
  run('sips', ['-s', 'format', 'jpeg', config.testPdf, '--out', renderedPage]);

  for (const [relativePath, crop] of Object.entries(config.crops)) {
    const [width, height, x, y] = crop;
    const outputPath = resolve(options.outDir, version, relativePath);
    mkdirSync(resolve(outputPath, '..'), { recursive: true });
    run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      renderedPage,
      '-vf',
      `crop=${width}:${height}:${x}:${y}`,
      '-frames:v',
      '1',
      '-update',
      '1',
      outputPath,
    ]);

    const storagePath = `${version}/${relativePath}`;
    console.log(`WROTE ${storagePath}`);
    if (options.upload) {
      await uploadStimulus(supabaseUrl, serviceKey, storagePath, outputPath);
      console.log(`UPLOADED ${storagePath}`);
    }
  }
}

console.log(options.upload ? 'Stimulus image upload complete.' : 'Stimulus image extraction complete. Re-run with --upload to store them in Supabase.');

async function uploadStimulus(supabaseUrl, key, storagePath, filePath) {
  const file = readFileSync(filePath);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/stimuli/${encodePath(storagePath)}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    fail(`Upload failed for ${storagePath}: ${response.status} ${text}`);
  }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    fail(`${command} failed: ${stderr || `exit ${result.status}`}`);
  }
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
  const parsed = {
    allVersions: false,
    version: null,
    upload: false,
    outDir: DEFAULT_OUT_DIR,
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--all-versions') parsed.allVersions = true;
    else if (args[i] === '--version') parsed.version = args[++i];
    else if (args[i] === '--upload') parsed.upload = true;
    else if (args[i] === '--out') parsed.outDir = resolve(args[++i]);
    else if (args[i] === '--help') {
      console.log('Usage: node scripts/upload-stimuli-from-pdfs.mjs [--version 8.1|8.2|8.3] [--all-versions] [--out /tmp/moca-stimuli] [--upload]');
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
