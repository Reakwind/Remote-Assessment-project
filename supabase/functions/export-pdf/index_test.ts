import { handleExportPdf } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleExportPdf blocks provisional reports before rendering PDF bytes', async () => {
  let renderCalls = 0;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'clinician-1' } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'sessions') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({
          data: {
            id: 'session-1',
            clinician_id: 'clinician-1',
            case_id: 'CASE-1',
            status: 'awaiting_review',
            scoring_reports: {
              total_provisional: true,
              pending_review_count: 1,
            },
            drawing_reviews: [],
            scoring_item_reviews: [],
          },
          error: null,
        }),
      };
      return query;
    },
  };

  const response = await handleExportPdf(
    new Request('https://example.test/functions/v1/export-pdf', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
      headers: { 'content-type': 'application/json', Authorization: 'Bearer clinician-token' },
    }),
    {
      createSupabaseClient: () => supabase,
      renderPdf: () => {
        renderCalls += 1;
        return new ArrayBuffer(0);
      },
    },
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error, 'Session must be completed before export');
  assertEquals(renderCalls, 0);
});
