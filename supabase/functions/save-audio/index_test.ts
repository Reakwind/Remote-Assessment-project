import { handleSaveAudio } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleSaveAudio rejects non-progress sessions before upload', async () => {
  let uploadCalls = 0;
  const supabase = {
    from: (table: string) => {
      if (table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { id: 'session-1', status: 'pending' }, error: null }),
      };
      return query;
    },
    storage: {
      from: () => ({
        upload: async () => {
          uploadCalls += 1;
          return { error: null };
        },
      }),
    },
  };

  const response = await handleSaveAudio(
    new Request('https://example.test/functions/v1/save-audio', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        linkToken: 'link-token',
        taskType: 'moca-digit-span',
        audioBase64: `data:audio/webm;base64,${btoa('audio')}`,
        contentType: 'audio/webm',
      }),
      headers: { 'content-type': 'application/json' },
    }),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async () => undefined,
    },
  );

  assertEquals(response.status, 409);
  assertEquals(await response.text(), JSON.stringify({ error: 'Session not in progress' }));
  assertEquals(uploadCalls, 0);
});
