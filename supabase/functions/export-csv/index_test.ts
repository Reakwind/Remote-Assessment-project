import { handleExportCsv } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleExportCsv returns JSON 404 for a requested session outside the clinician tenant', async () => {
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'clinician-1' } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: undefined,
      };
      return {
        ...query,
        eq: () => ({
          ...query,
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  };

  const response = await handleExportCsv(
    new Request('https://example.test/functions/v1/export-csv?sessionId=session-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer clinician-token' },
    }),
    { createSupabaseClient: () => supabase },
  );

  assertEquals(response.status, 404);
  assertEquals(response.headers.get('Content-Type'), 'application/json');
  assertEquals(await response.text(), JSON.stringify({ error: 'Session not found' }));
});
