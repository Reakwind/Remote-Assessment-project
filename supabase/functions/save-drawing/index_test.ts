import { handleSaveDrawing } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleSaveDrawing rejects non-PNG payloads before creating a Supabase client', async () => {
  let createClientCalls = 0;

  const response = await handleSaveDrawing(
    new Request('https://example.test/functions/v1/save-drawing', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        linkToken: 'link-token',
        taskId: 'moca-clock',
        imageBase64: `data:image/jpeg;base64,${btoa('not a png')}`,
      }),
      headers: { 'content-type': 'application/json' },
    }),
    {
      createSupabaseClient: () => {
        createClientCalls += 1;
        return {};
      },
      writeAuditEvent: async () => undefined,
    },
  );

  assertEquals(response.status, 400);
  assertEquals(await response.text(), JSON.stringify({ error: 'imageBase64 must be a PNG data URL' }));
  assertEquals(createClientCalls, 0);
});
