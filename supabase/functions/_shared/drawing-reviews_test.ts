import {
  type DrawingReviewPayload,
  insertMissingDrawingReviews,
  saveDrawingReview,
} from './drawing-reviews.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const missingConstraintError = {
  code: '42P10',
  message:
    'there is no unique or exclusion constraint matching the ON CONFLICT specification',
};

const basePayload: DrawingReviewPayload = {
  session_id: 'session-1',
  task_name: 'trailMaking',
  task_id: 'moca-visuospatial',
  strokes_data: [{ x: 10, y: 20 }],
};

Deno.test('saveDrawingReview falls back to update/insert when the hosted conflict constraint is missing', async () => {
  let updateAttempts = 0;
  let insertedTaskId = '';
  const supabase = {
    from: (table: string) => {
      if (table !== 'drawing_reviews') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        upsert: async () => ({ error: missingConstraintError }),
        update: () => {
          updateAttempts += 1;
          const query = {
            eq: () => query,
            select: async () => ({ data: [], error: null }),
          };
          return query;
        },
        insert: async (payload: DrawingReviewPayload) => {
          insertedTaskId = payload.task_id;
          return { error: null };
        },
      };
    },
  };

  const { error } = await saveDrawingReview(supabase, basePayload);

  assertEquals(error, null);
  assertEquals(updateAttempts, 1);
  assertEquals(insertedTaskId, 'moca-visuospatial');
});

Deno.test('insertMissingDrawingReviews does not overwrite existing drawing rows during constraint fallback', async () => {
  const insertedTaskIds: string[] = [];
  const supabase = {
    from: (table: string) => {
      if (table !== 'drawing_reviews') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        upsert: async () => ({ error: missingConstraintError }),
        select: () => {
          let taskId = '';
          const query = {
            eq: (column: string, value: string) => {
              if (column === 'task_id') taskId = value;
              return query;
            },
            maybeSingle: async () => ({
              data: taskId === 'moca-clock'
                ? { id: 'existing-clock-review' }
                : null,
              error: null,
            }),
          };
          return query;
        },
        insert: async (payload: DrawingReviewPayload) => {
          insertedTaskIds.push(payload.task_id);
          return { error: null };
        },
      };
    },
  };

  const { error } = await insertMissingDrawingReviews(supabase, [
    {
      ...basePayload,
      task_id: 'moca-clock',
      task_name: 'clock',
      strokes_data: [],
    },
    {
      ...basePayload,
      task_id: 'moca-cube',
      task_name: 'cube',
      strokes_data: [],
    },
  ]);

  assertEquals(error, null);
  assertEquals(insertedTaskIds.length, 1);
  assertEquals(insertedTaskIds[0], 'moca-cube');
});
