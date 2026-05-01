import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automatedCheckCommands,
  automatedCheckFailures,
  buildAllowedOrigins,
  buildEvidence,
  checkUrl,
  createPendingHealth,
  mergeHealthResult,
  parseLocalRehearsalArgs,
  requireReadinessResetConfirmation,
  runAutomatedChecks,
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
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(typeof evidence.createdAt, 'string');
  assert.ok(!Number.isNaN(Date.parse(evidence.createdAt)));
  assert.equal(evidence.macNetworkAddress, '192.168.1.230');
  assert.equal(evidence.urls.patient, 'https://192.168.1.230:5176');
  assert.equal(evidence.urls.clinician, 'https://192.168.1.230:5177');
  assert.deepEqual(evidence.health, {
    supabase: 'pending',
    edgeFunctions: 'pending',
    patientHttps: 'pending',
    clinicianHttps: 'pending',
    supabaseProxy: 'pending',
  });
  assert.deepEqual(evidence.automatedChecks, []);
  assert.deepEqual(evidence.manualChecks, {
    ipadInstalledPwa: { result: 'pending', notes: '' },
    microphonePermission: { result: 'pending', notes: '' },
    audioPlayback: { result: 'pending', notes: '' },
    drawingSave: { result: 'pending', notes: '' },
    refreshResume: { result: 'pending', notes: '' },
    offlineRetry: { result: 'pending', notes: '' },
    patientCompletion: { result: 'pending', notes: '' },
    clinicianFinalization: { result: 'pending', notes: '' },
    exports: { result: 'pending', notes: '' },
  });
  assert.deepEqual(evidence.failures, []);
});

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

test('checkUrl returns false when a fetch attempt hangs past the deadline', async () => {
  const startedAt = Date.now();
  const result = await checkUrl(
    'https://127.0.0.1:5176',
    {},
    {
      timeoutMs: 20,
      intervalMs: 1,
      fetchImpl: () => new Promise(() => {}),
    },
  );

  assert.equal(result, false);
  assert.ok(Date.now() - startedAt < 1_000);
});

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

test('automatedCheckCommands forwards licensed PDF skip flag to local E2E commands', () => {
  const checks = automatedCheckCommands({ skipLicensedPdfCheck: true });
  assert.deepEqual(
    checks.find((check) => check.label === 'local regression shell').args,
    ['scripts/local-test-shell.mjs', '--skip-browser', '--skip-licensed-pdf-check'],
  );
  assert.deepEqual(
    checks.find((check) => check.label === 'scripted local Supabase E2E').args,
    ['scripts/local-e2e.mjs', '--all-versions', '--skip-licensed-pdf-check'],
  );
});

test('automatedCheckCommands omits licensed PDF skip flag by default', () => {
  const checks = automatedCheckCommands();
  assert.deepEqual(
    checks.find((check) => check.label === 'local regression shell').args,
    ['scripts/local-test-shell.mjs', '--skip-browser'],
  );
  assert.deepEqual(
    checks.find((check) => check.label === 'scripted local Supabase E2E').args,
    ['scripts/local-e2e.mjs', '--all-versions'],
  );
});

test('runAutomatedChecks returns partial results on failure', () => {
  const calls = [];
  let attempts = 0;
  const times = [
    '2026-05-01T10:00:00.000Z',
    '2026-05-01T10:00:01.000Z',
    '2026-05-01T10:00:02.000Z',
    '2026-05-01T10:00:03.000Z',
  ];
  let timeIndex = 0;

  assert.throws(
    () => runAutomatedChecks(
      {},
      {
        spawnSyncImpl(command, args, options) {
          attempts += 1;
          calls.push({ command, args, cwd: options.cwd, stdio: options.stdio });
          return { status: attempts === 2 ? 2 : 0 };
        },
        now: () => times[timeIndex++],
        log: () => {},
      },
    ),
    (error) => {
      assert.equal(error.message, 'client lint failed with exit code 2.');
      assert.deepEqual(error.results.map((result) => result.label), [
        'client unit tests',
        'client lint',
      ]);
      assert.deepEqual(error.results[1], {
        label: 'client lint',
        passed: false,
        startedAt: '2026-05-01T10:00:02.000Z',
        finishedAt: '2026-05-01T10:00:03.000Z',
        exitCode: 2,
        signal: null,
      });
      assert.deepEqual(automatedCheckFailures(error.results), [
        {
          type: 'automatedCheck',
          label: 'client lint',
          message: 'client lint failed with exit code 2.',
          exitCode: 2,
          signal: null,
          startedAt: '2026-05-01T10:00:02.000Z',
          finishedAt: '2026-05-01T10:00:03.000Z',
        },
      ]);
      return true;
    },
  );
  assert.equal(calls.length, 2);
});

test('runAutomatedChecks skips commands when requested', () => {
  assert.deepEqual(
    runAutomatedChecks(
      { skipAutomatedChecks: true },
      {
        spawnSyncImpl() {
          throw new Error('unexpected command');
        },
      },
    ),
    [],
  );
});
