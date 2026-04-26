import {
  buildStartAttemptFingerprint,
  evaluateStartRateLimit,
  type StartAttemptRow,
} from './start-rate-limit.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
}

Deno.test('buildStartAttemptFingerprint does not expose raw IP or test number', async () => {
  const req = new Request('https://example.test', {
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
  });

  const first = await buildStartAttemptFingerprint(req, '12345678', (name) =>
    name === 'START_SESSION_RATE_LIMIT_SECRET' ? 'test-secret' : undefined
  );
  const second = await buildStartAttemptFingerprint(req, '12345678', (name) =>
    name === 'START_SESSION_RATE_LIMIT_SECRET' ? 'test-secret' : undefined
  );

  assertEquals(first.source, '203.0.113.10');
  assertEquals(first.ipHash, second.ipHash);
  assertEquals(first.accessCodeHash, second.accessCodeHash);
  assert(first.ipHash !== '203.0.113.10', 'raw IP should not be stored as hash');
  assert(first.accessCodeHash !== '12345678', 'raw access code should not be stored as hash');
});

Deno.test('evaluateStartRateLimit blocks repeated failures from one IP', () => {
  const fingerprint = {
    source: 'unknown',
    ipHash: 'ip-a',
    accessCodeHash: 'code-a',
  };
  const rows: StartAttemptRow[] = Array.from({ length: 3 }, () => ({
    ip_hash: 'ip-a',
    access_code_hash: 'other-code',
  }));

  const decision = evaluateStartRateLimit(rows, fingerprint, {
    maxIpFailures: 3,
    maxCodeFailures: 10,
  });

  assertEquals(decision.allowed, false);
  assertEquals(decision.reason, 'ip_rate_limited');
  assertEquals(decision.ipFailures, 3);
});

Deno.test('evaluateStartRateLimit blocks repeated failures for one code', () => {
  const fingerprint = {
    source: 'unknown',
    ipHash: 'ip-a',
    accessCodeHash: 'code-a',
  };
  const rows: StartAttemptRow[] = Array.from({ length: 2 }, (_, index) => ({
    ip_hash: `ip-${index}`,
    access_code_hash: 'code-a',
  }));

  const decision = evaluateStartRateLimit(rows, fingerprint, {
    maxIpFailures: 10,
    maxCodeFailures: 2,
  });

  assertEquals(decision.allowed, false);
  assertEquals(decision.reason, 'code_rate_limited');
  assertEquals(decision.codeFailures, 2);
});
