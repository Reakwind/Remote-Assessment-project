import { handleStartSession } from "./handler.ts";
import type {
  StartAttemptFingerprint,
  StartRateLimitDecision,
} from "../_shared/start-rate-limit.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("handleStartSession returns 429 without recording another failed attempt when already rate limited", async () => {
  const recordCalls: unknown[] = [];
  const fingerprint: StartAttemptFingerprint = {
    source: "203.0.113.10",
    ipHash: "ip-hash",
    accessCodeHash: "code-hash",
  };
  const rateLimit: StartRateLimitDecision = {
    allowed: false,
    reason: "ip_rate_limited",
    retryAfterSeconds: 900,
    ipFailures: 60,
    codeFailures: 0,
  };

  const response = await handleStartSession(
    new Request("https://example.test/functions/v1/start-session", {
      method: "POST",
      body: JSON.stringify({ token: "12345678" }),
      headers: { "content-type": "application/json" },
    }),
    {
      createSupabaseClient: () => ({} as never),
      buildStartAttemptFingerprint: async () => fingerprint,
      checkStartRateLimit: async () => rateLimit,
      recordStartAttempt: async (...args) => {
        recordCalls.push(args);
      },
      writeAuditEvent: async () => undefined,
      now: () => "2026-04-26T00:00:00.000Z",
    },
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "900");
  assertEquals(
    recordCalls.length,
    0,
    "blocked retries should not record another failed attempt",
  );
  assertEquals(
    await response.text(),
    JSON.stringify({
      error: "Too many start attempts. Please try again later.",
    }),
  );
});

Deno.test("handleStartSession records invalid-format attempts after rate-limit check passes", async () => {
  const recordCalls: Array<{ failureReason?: string; success: boolean }> = [];
  const fingerprint: StartAttemptFingerprint = {
    source: "203.0.113.10",
    ipHash: "ip-hash",
    accessCodeHash: "code-hash",
  };

  const response = await handleStartSession(
    new Request("https://example.test/functions/v1/start-session", {
      method: "POST",
      body: JSON.stringify({ token: "12-34" }),
      headers: { "content-type": "application/json" },
    }),
    {
      createSupabaseClient: () => ({} as never),
      buildStartAttemptFingerprint: async () => fingerprint,
      checkStartRateLimit: async () => ({
        allowed: true,
        ipFailures: 0,
        codeFailures: 0,
      }),
      recordStartAttempt: async (_supabase, input) => {
        recordCalls.push({
          failureReason: input.failureReason,
          success: input.success,
        });
      },
      writeAuditEvent: async () => undefined,
      now: () => "2026-04-26T00:00:00.000Z",
    },
  );

  assertEquals(response.status, 404);
  assertEquals(recordCalls.length, 1);
  assert(recordCalls[0], "expected one recorded attempt");
  assertEquals(recordCalls[0].success, false);
  assertEquals(recordCalls[0].failureReason, "invalid_format");
});

Deno.test("handleStartSession stores normalized patient device context on start", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const attempts: Array<Record<string, unknown>> = [];
  const fingerprint: StartAttemptFingerprint = {
    source: "203.0.113.10",
    ipHash: "ip-hash",
    accessCodeHash: "code-hash",
  };
  const session = {
    id: "session-1",
    link_token: "link-token",
    status: "pending",
    link_used_at: null,
    age_band: "70-74",
    education_years: 12,
    patient_age_years: 73,
    moca_version: "8.3",
    assessment_language: "he",
  };
  const supabase = {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        is: () => query,
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return query;
        },
        single: async () => ({ data: session, error: null }),
        maybeSingle: async () => ({ data: { id: session.id }, error: null }),
      };
      return query;
    },
  };

  const response = await handleStartSession(
    new Request("https://example.test/functions/v1/start-session", {
      method: "POST",
      body: JSON.stringify({
        token: "12345678",
        deviceContext: {
          userAgent: " Mobile Safari ".repeat(40),
          platform: "iPad",
          language: "he-IL",
          languages: ["he-IL", "en-US", 123, "fr-FR", "es-ES", "de-DE"],
          screenWidth: 820,
          screenHeight: 1180,
          viewportWidth: 768.4,
          viewportHeight: 1024.4,
          devicePixelRatio: 2.222,
          touchPoints: 5,
          standalone: true,
          pointer: "coarse",
          hover: "none",
          formFactor: "tablet",
          orientation: "portrait",
          ignored: "not stored",
        },
      }),
      headers: { "content-type": "application/json" },
    }),
    {
      createSupabaseClient: () => supabase,
      buildStartAttemptFingerprint: async () => fingerprint,
      checkStartRateLimit: async () => ({
        allowed: true,
        ipFailures: 0,
        codeFailures: 0,
      }),
      recordStartAttempt: async (_supabase, input) => {
        attempts.push(input);
      },
      writeAuditEvent: async (_supabase, input) => {
        auditEvents.push(input);
      },
      now: () => "2026-04-26T00:00:00.000Z",
    },
  );

  assertEquals(response.status, 200);
  assertEquals(updates.length, 1);
  const deviceContext = updates[0]?.device_context as Record<string, unknown>;
  assertEquals(deviceContext.platform, "iPad");
  assertEquals(deviceContext.viewportWidth, 768);
  assertEquals(deviceContext.devicePixelRatio, 2.22);
  assertEquals(deviceContext.standalone, true);
  assertEquals(deviceContext.formFactor, "tablet");
  assertEquals(deviceContext.orientation, "portrait");
  assertEquals(Array.isArray(deviceContext.languages), true);
  assertEquals((deviceContext.languages as string[]).length, 5);
  assertEquals(typeof deviceContext.ignored, "undefined");
  assertEquals((deviceContext.userAgent as string).length, 300);
  assertEquals(auditEvents.length, 1);
  assertEquals(attempts.length, 1);
  assertEquals((auditEvents[0]?.metadata as Record<string, unknown>).deviceContext, deviceContext);
  assertEquals(
    typeof (attempts[0]?.metadata as Record<string, unknown>).deviceContext,
    "undefined",
  );
});
