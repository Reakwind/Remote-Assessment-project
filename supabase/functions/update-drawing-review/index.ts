import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed, requireClinician } from '../_shared/http.ts';
import { recalculateReviewedReport } from '../_shared/reviews.ts';

const DRAWING_TASK_MAX: Record<string, number> = {
  'moca-visuospatial': 1,
  'moca-cube': 1,
  'moca-clock': 3,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'PATCH' && req.method !== 'POST') return methodNotAllowed(req);

  let body: {
    reviewId: string;
    clinicianScore: number;
    rubricItems?: unknown;
    clinicianNotes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  if (!body.reviewId || !Number.isInteger(body.clinicianScore)) {
    return json({ error: 'Missing required fields: reviewId, clinicianScore' }, 400, req);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { user, response } = await requireClinician(req, supabase);
  if (response) return response;

  const { data: review, error: reviewError } = await supabase
    .from('drawing_reviews')
    .select('id, session_id, task_id, sessions!inner(clinician_id)')
    .eq('id', body.reviewId)
    .single();

  const linkedSession = Array.isArray(review?.sessions) ? review.sessions[0] : review?.sessions;
  if (reviewError || !review || linkedSession?.clinician_id !== user.id) {
    return json({ error: 'Drawing review not found' }, 404, req);
  }

  const maxScore = DRAWING_TASK_MAX[review.task_id] ?? 0;
  if (body.clinicianScore < 0 || body.clinicianScore > maxScore) {
    return json({ error: `clinicianScore must be an integer from 0 to ${maxScore}` }, 400, req);
  }

  const { error: updateError } = await supabase
    .from('drawing_reviews')
    .update({
      clinician_score: body.clinicianScore,
      rubric_items: body.rubricItems ?? null,
      clinician_notes: body.clinicianNotes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', body.reviewId);

  if (updateError) {
    console.error('Drawing review update failed:', updateError);
    return json({ error: 'Failed to update drawing review' }, 500, req);
  }

  try {
    const scoringReport = await recalculateReviewedReport(supabase, review.session_id, user.id);
    await writeAuditEvent(supabase, {
      eventType: 'drawing_review_updated',
      sessionId: review.session_id,
      actorType: 'clinician',
      actorUserId: user.id,
      metadata: { reviewId: review.id, taskId: review.task_id, clinicianScore: body.clinicianScore },
    });
    return json({ ok: true, scoringReport }, 200, req);
  } catch (error) {
    console.error('Scoring report recalculation failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Failed to recalculate scoring report' }, 500, req);
  }
});
