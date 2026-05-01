import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewServerHttpsEnv,
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

test('reviewServerScriptName maps surface to npm script', () => {
  assert.equal(reviewServerScriptName('patient'), 'dev:patient');
  assert.equal(reviewServerScriptName('clinician'), 'dev:clinician');
  assert.equal(reviewServerScriptName('combined'), 'dev');
});
