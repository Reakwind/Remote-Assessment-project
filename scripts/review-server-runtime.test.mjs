import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewServerHttpsEnv,
  buildReviewServerUrls,
  isEdgeFunctionReachable,
  parseEnvOutput,
  parseReviewServerArgs,
  resolveReviewServerScheme,
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
  assert.equal(parseEnvOutput('API_URL="http://127.0.0.1:54321"\nANON_KEY="abc"\n').API_URL, 'http://127.0.0.1:54321');
  assert.equal(parseEnvOutput('API_URL="http://127.0.0.1:54321"\nANON_KEY="abc"\n').ANON_KEY, 'abc');
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

test('buildReviewServerHttpsEnv returns Vite HTTPS env when cert and key are present', () => {
  assert.deepEqual(
    buildReviewServerHttpsEnv({
      httpsCert: '.certs/local.pem',
      httpsKey: '.certs/local-key.pem',
    }),
    {
      VITE_LOCAL_HTTPS_CERT: '.certs/local.pem',
      VITE_LOCAL_HTTPS_KEY: '.certs/local-key.pem',
    },
  );
});

test('buildReviewServerHttpsEnv omits Vite HTTPS env when cert or key is missing', () => {
  assert.deepEqual(buildReviewServerHttpsEnv(), {});
  assert.deepEqual(buildReviewServerHttpsEnv({ httpsCert: '.certs/local.pem' }), {});
  assert.deepEqual(buildReviewServerHttpsEnv({ httpsKey: '.certs/local-key.pem' }), {});
});

test('resolveReviewServerScheme defaults to HTTP unless Vite HTTPS is configured', () => {
  assert.equal(resolveReviewServerScheme(), 'http');
  assert.equal(
    resolveReviewServerScheme({
      httpsCert: '.certs/local.pem',
      httpsKey: '.certs/local-key.pem',
    }),
    'https',
  );
});

test('resolveReviewServerScheme preserves explicit non-HTTPS public scheme', () => {
  assert.equal(resolveReviewServerScheme({ publicScheme: 'http' }), 'http');
});

test('resolveReviewServerScheme rejects partial HTTPS file options', () => {
  assert.throws(
    () => resolveReviewServerScheme({ httpsCert: '.certs/local.pem' }),
    /Use --https-cert and --https-key together/,
  );
  assert.throws(
    () => resolveReviewServerScheme({ httpsKey: '.certs/local-key.pem' }),
    /Use --https-cert and --https-key together/,
  );
});

test('resolveReviewServerScheme rejects forced HTTPS without Vite HTTPS files', () => {
  assert.throws(
    () => resolveReviewServerScheme({ publicScheme: 'https' }),
    /--public-scheme https requires both --https-cert and --https-key/,
  );
});

test('reviewServerScriptName maps surface to npm script', () => {
  assert.equal(reviewServerScriptName('patient'), 'dev:patient');
  assert.equal(reviewServerScriptName('clinician'), 'dev:clinician');
  assert.equal(reviewServerScriptName('combined'), 'dev');
});

test('isEdgeFunctionReachable requires successful preflight for the requested origin', async () => {
  const origin = 'https://192.168.1.230:5176';
  const ok = await isEdgeFunctionReachable('http://127.0.0.1:54321', origin, {
    fetchImpl: async (url, init) => {
      assert.equal(String(url), 'http://127.0.0.1:54321/functions/v1/start-session');
      assert.equal(init.method, 'OPTIONS');
      assert.equal(init.headers.Origin, origin);
      return new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': origin },
      });
    },
  });

  assert.equal(ok, true);
  assert.equal(
    await isEdgeFunctionReachable('http://127.0.0.1:54321', origin, {
      fetchImpl: async () => new Response(null, { status: 403, headers: { Vary: 'Origin' } }),
    }),
    false,
  );
  assert.equal(
    await isEdgeFunctionReachable('http://127.0.0.1:54321', origin, {
      fetchImpl: async () => new Response(null, { status: 204 }),
    }),
    false,
  );
  assert.equal(
    await isEdgeFunctionReachable('http://127.0.0.1:54321', origin, {
      fetchImpl: async () => new Response(null, {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': 'https://127.0.0.1:5176' },
      }),
    }),
    false,
  );
});
