import { handleUpdateScoringReview } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

Deno.test('handleUpdateScoringReview hides reviews owned by another clinician', async () => {
  let updateCalls = 0;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'clinician-1' } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'scoring_item_reviews') throw new Error(`Unexpected table: ${table}`);
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
            item_id: 'moca-language',
            max_score: 3,
            sessions: { clinician_id: 'clinician-2' },
          },
          error: null,
        }),
      };
      return query;
    },
  };

  const response = await handleUpdateScoringReview(
    new Request('https://example.test/functions/v1/update-scoring-review', {
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
  assertEquals(await response.text(), JSON.stringify({ error: 'Scoring review not found' }));
  assertEquals(updateCalls, 0);
});
