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
