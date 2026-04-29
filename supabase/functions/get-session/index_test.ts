import { handleGetSession } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleGetSession returns 404 without signing storage for sessions outside the clinician tenant', async () => {
  let signedUrlCalls = 0;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'clinician-1' } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: null, error: new Error('not found') }),
      };
      return query;
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => {
          signedUrlCalls += 1;
          return { data: { signedUrl: 'https://example.test/signed' }, error: null };
        },
      }),
    },
  };

  const response = await handleGetSession(
    new Request('https://example.test/functions/v1/get-session?sessionId=session-1', {
      method: 'GET',
      headers: { Authorization: 'Bearer clinician-token' },
    }),
    { createSupabaseClient: () => supabase },
  );

  assertEquals(response.status, 404);
  assertEquals(await response.text(), JSON.stringify({ error: 'Session not found' }));
  assertEquals(signedUrlCalls, 0);
});
