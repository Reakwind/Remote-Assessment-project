import { handleGetStimuli } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('handleGetStimuli reports missing private assets without failing the manifest request', async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { id: 'session-1', status: 'in_progress', moca_version: '8.3' }, error: null }),
      };
      return query;
    },
    storage: {
      from: (bucket: string) => {
        assertEquals(bucket, 'stimuli');
        return {
          list: async () => ({ data: [], error: null }),
          createSignedUrl: async () => {
            throw new Error('createSignedUrl should not run for missing assets');
          },
        };
      },
    },
  };

  const response = await handleGetStimuli(
    new Request('https://example.test/functions/v1/get-stimuli', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1', linkToken: 'link-token' }),
      headers: { 'content-type': 'application/json' },
    }),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async (_supabase, input) => {
        auditEvents.push(input);
      },
    },
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.clinicalReady, false);
  assert(body.missingRequiredCount > 0, 'expected missing required assets');
  assertEquals(body.assets.every((asset: any) => asset.available === false), true);
  assertEquals(auditEvents.length, 1);
  assertEquals((auditEvents[0]?.metadata as Record<string, unknown>).missingRequiredCount, body.missingRequiredCount);
});
