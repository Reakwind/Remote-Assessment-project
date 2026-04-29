import { handleSubmitResult } from './submitResult.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleSubmitResult rejects completed sessions before upserting task results', async () => {
  let upsertCalls = 0;
  const supabase = {
    from: (table: string) => {
      if (table === 'sessions') {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: 'session-1', status: 'completed' }, error: null }),
        };
        return query;
      }

      if (table === 'task_results') {
        return {
          upsert: async () => {
            upsertCalls += 1;
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const response = await handleSubmitResult(
    new Request('https://example.test/functions/v1/submit-results', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        linkToken: 'link-token',
        taskType: 'moca-naming',
        rawData: { answers: { lion: 'אריה', rhino: 'קרנף', camel: 'גמל' } },
      }),
      headers: { 'content-type': 'application/json' },
    }),
    { createSupabaseClient: () => supabase, writeAuditEvent: async () => undefined },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.text(), JSON.stringify({ error: 'Session not in progress' }));
  assertEquals(upsertCalls, 0);
});
