import { handleUpdateDrawingReview } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleUpdateDrawingReview hides reviews owned by another clinician', async () => {
  let updateCalls = 0;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'clinician-1' } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'drawing_reviews') throw new Error(`Unexpected table: ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        update: () => {
          updateCalls += 1;
          return query;
        },
        single: async () => ({
          data: {
            id: 'review-1',
            session_id: 'session-1',
            task_id: 'moca-clock',
            sessions: { clinician_id: 'clinician-2' },
          },
          error: null,
        }),
      };
      return query;
    },
  };

  const response = await handleUpdateDrawingReview(
    new Request('https://example.test/functions/v1/update-drawing-review', {
      method: 'POST',
      body: JSON.stringify({ reviewId: 'review-1', clinicianScore: 2 }),
      headers: { 'content-type': 'application/json', Authorization: 'Bearer clinician-token' },
    }),
    {
      createSupabaseClient: () => supabase,
      recalculateReviewedReport: async () => {
        throw new Error('recalculateReviewedReport should not run');
      },
      writeAuditEvent: async () => undefined,
    },
  );

  assertEquals(response.status, 404);
  assertEquals(await response.text(), JSON.stringify({ error: 'Drawing review not found' }));
  assertEquals(updateCalls, 0);
});
