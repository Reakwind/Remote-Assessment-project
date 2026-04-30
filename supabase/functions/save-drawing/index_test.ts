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

Deno.test('handleSaveDrawing falls back when the hosted drawing review conflict constraint is missing', async () => {
  let insertedTaskId = '';
  let auditCalls = 0;
  const supabase = {
    from: (table: string) => {
      if (table === 'sessions') {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: { id: 'session-1', status: 'in_progress' },
            error: null,
          }),
        };
        return query;
      }

      if (table === 'drawing_reviews') {
        return {
          upsert: async () => ({
            error: {
              code: '42P10',
              message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
            },
          }),
          update: () => {
            const query = {
              eq: () => query,
              select: async () => ({ data: [], error: null }),
            };
            return query;
          },
          insert: async (payload: { task_id: string }) => {
            insertedTaskId = payload.task_id;
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const response = await handleSaveDrawing(
    new Request('https://example.test/functions/v1/save-drawing', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'session-1',
        linkToken: 'link-token',
        taskId: 'moca-visuospatial',
        strokesData: [{ x: 1, y: 2 }],
      }),
      headers: { 'content-type': 'application/json' },
    }),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async () => {
        auditCalls += 1;
      },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), JSON.stringify({ ok: true, storagePath: null }));
  assertEquals(insertedTaskId, 'moca-visuospatial');
  assertEquals(auditCalls, 1);
});
