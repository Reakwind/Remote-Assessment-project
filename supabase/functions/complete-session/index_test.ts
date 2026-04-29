import { handleCompleteSession } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleCompleteSession returns 409 before scoring when clinical context is missing', async () => {
  let taskResultReads = 0;
  const supabase = {
    from: (table: string) => {
      if (table === 'sessions') {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: {
              id: 'session-1',
              clinician_id: 'clinician-1',
              status: 'in_progress',
              education_years: null,
              patient_age_years: null,
            },
            error: null,
          }),
        };
        return query;
      }

      if (table === 'task_results') {
        taskResultReads += 1;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const response = await handleCompleteSession(
    new Request('https://example.test/functions/v1/complete-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1', linkToken: 'link-token' }),
      headers: { 'content-type': 'application/json' },
    }),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async () => undefined,
      notifyClinicianSessionCompleted: async () => ({ channel: 'email', provider: 'resend', status: 'skipped', reason: 'test' }),
      recordNotificationOutcome: async () => undefined,
      scoreSession: () => {
        throw new Error('scoreSession should not run');
      },
    },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.text(), JSON.stringify({ error: 'Session is missing required clinical scoring context' }));
  assertEquals(taskResultReads, 0);
});
