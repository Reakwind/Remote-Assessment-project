import {
  notifyClinicianSessionCompleted,
  recordNotificationOutcome,
} from "./notifications.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

Deno.test(
  "notifyClinicianSessionCompleted skips when Resend is not configured",
  async () => {
    const result = await notifyClinicianSessionCompleted(
      {} as never,
      {
        id: "session-1",
        clinician_id: "clinician-1",
        status: "awaiting_review",
      },
      { env: () => undefined },
    );

    assertEquals(result.status, "skipped");
    assertEquals(result.reason, "RESEND_API_KEY not configured");
  },
);

Deno.test(
  "notifyClinicianSessionCompleted returns sent with provider message id",
  async () => {
    const calls: Array<{ url: string; body: unknown }> = [];

    const fakeFetch = ((
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return Promise.resolve(
        new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
      );
    }) as typeof fetch;

    const result = await notifyClinicianSessionCompleted(
      {
        auth: {
          admin: {
            getUserById: () =>
              Promise.resolve({
                data: { user: { email: "clinician@example.test" } },
              }),
          },
        },
      } as never,
      {
        id: "session-1",
        clinician_id: "clinician-1",
        status: "awaiting_review",
      },
      {
        env: (name: string) =>
          ({
            RESEND_API_KEY: "test-key",
            RESEND_API_BASE: "https://resend.test/",
          })[name],
        fetch: fakeFetch,
      },
    );

    assertEquals(result.status, "sent");
    assertEquals(result.providerMessageId, "email_123");
    assertEquals(calls[0].url, "https://resend.test/emails");
    assertEquals(
      (calls[0].body as { to: string }).to,
      "clinician@example.test",
    );
  },
);

Deno.test("recordNotificationOutcome creates retry-ready row for failed sends", async () => {
  let tableName = "";
  let payload: Record<string, unknown> | null = null;
  let conflict = "";

  await recordNotificationOutcome({
    from: (name: string) => {
      tableName = name;
      return {
        upsert: (
          row: Record<string, unknown>,
          options: { onConflict: string },
        ) => {
          payload = row;
          conflict = options.onConflict;
          return Promise.resolve({ error: null });
        },
      };
    },
  } as never, {
    sessionId: "session-1",
    notificationType: "clinician_completion_email",
    result: {
      channel: "email",
      provider: "resend",
      status: "failed",
      reason: "Resend returned 500",
      recipientEmail: "clinician@example.test",
    },
  });

  assertEquals(tableName, "notification_events");
  assertEquals(conflict, "session_id,notification_type,channel");
  assert(payload, "expected notification event payload");
  const row = payload as Record<string, unknown>;
  assertEquals(row.session_id, "session-1");
  assertEquals(row.status, "failed");
  assertEquals(row.error_message, "Resend returned 500");
  assert(
    typeof row.next_retry_at === "string",
    "expected failed notification to include next_retry_at",
  );
});
