type SupabaseClient = any;

export interface DrawingReviewPayload extends Record<string, unknown> {
  session_id: string;
  task_name: string;
  task_id: string;
  strokes_data: unknown[];
}

export async function saveDrawingReview(
  supabase: SupabaseClient,
    payload: DrawingReviewPayload,
): Promise<{ error: unknown | null }> {
  const { error: upsertError } = await supabase
    .from('drawing_reviews')
    .upsert(payload, { onConflict: 'session_id,task_id' });

  if (!upsertError) return { error: null };
  if (!isMissingConflictConstraint(upsertError)) return { error: upsertError };

  console.warn(
    'Drawing review upsert constraint missing; falling back to update/insert.',
    upsertError,
  );
  return updateOrInsertDrawingReview(supabase, payload);
}

export async function insertMissingDrawingReviews(
  supabase: SupabaseClient,
  payloads: DrawingReviewPayload[],
): Promise<{ error: unknown | null }> {
  const { error: upsertError } = await supabase
    .from('drawing_reviews')
    .upsert(payloads, {
      onConflict: 'session_id,task_id',
      ignoreDuplicates: true,
    });

  if (!upsertError) return { error: null };
  if (!isMissingConflictConstraint(upsertError)) return { error: upsertError };

  console.warn(
    'Drawing review placeholder upsert constraint missing; falling back to insert-if-missing.',
    upsertError,
  );
  for (const payload of payloads) {
    const { error } = await insertDrawingReviewIfMissing(supabase, payload);
    if (error) return { error };
  }

  return { error: null };
}

function isMissingConflictConstraint(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const fields = ['code', 'message', 'details', 'hint']
    .map((key) =>
      String((error as Record<string, unknown>)[key] ?? '').toLowerCase()
    )
    .join(' ');

  return fields.includes('42p10') ||
    fields.includes('no unique or exclusion constraint') ||
    fields.includes('on conflict specification');
}

async function updateOrInsertDrawingReview(
  supabase: SupabaseClient,
  payload: DrawingReviewPayload,
): Promise<{ error: unknown | null }> {
  const { data: updatedRows, error: updateError } = await supabase
    .from('drawing_reviews')
    .update(payload)
    .eq('session_id', payload.session_id)
    .eq('task_id', payload.task_id)
    .select('id');

  if (updateError) return { error: updateError };
  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase
    .from('drawing_reviews')
    .insert(payload);

  return { error: insertError ?? null };
}

async function insertDrawingReviewIfMissing(
  supabase: SupabaseClient,
  payload: DrawingReviewPayload,
): Promise<{ error: unknown | null }> {
  const { data: existingRow, error: selectError } = await supabase
    .from('drawing_reviews')
    .select('id')
    .eq('session_id', payload.session_id)
    .eq('task_id', payload.task_id)
    .maybeSingle();

  if (selectError) return { error: selectError };
  if (existingRow) return { error: null };

  const { error: insertError } = await supabase
    .from('drawing_reviews')
    .insert(payload);

  return { error: insertError ?? null };
}
