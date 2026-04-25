import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed, requireClinician } from '../_shared/http.ts';
import { recalculateReviewedReport } from '../_shared/reviews.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'PATCH' && req.method !== 'POST') return methodNotAllowed(req);

  let body: {
    reviewId: string;
    clinicianScore: number;
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
    .from('scoring_item_reviews')
    .select('id, session_id, item_id, max_score, sessions!inner(clinician_id)')
    .eq('id', body.reviewId)
    .single();

  const linkedSession = Array.isArray(review?.sessions) ? review.sessions[0] : review?.sessions;
  if (reviewError || !review || linkedSession?.clinician_id !== user.id) {
    return json({ error: 'Scoring review not found' }, 404, req);
  }

  if (body.clinicianScore < 0 || body.clinicianScore > review.max_score) {
    return json({ error: `clinicianScore must be an integer from 0 to ${review.max_score}` }, 400, req);
  }

  const { error: updateError } = await supabase
    .from('scoring_item_reviews')
    .update({
      clinician_score: body.clinicianScore,
      clinician_notes: body.clinicianNotes ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', body.reviewId);

  if (updateError) {
    console.error('Scoring review update failed:', updateError);
    return json({ error: 'Failed to update scoring review' }, 500, req);
  }

  try {
    const scoringReport = await recalculateReviewedReport(supabase, review.session_id, user.id);
    await writeAuditEvent(supabase, {
      eventType: 'scoring_review_updated',
      sessionId: review.session_id,
      actorType: 'clinician',
      actorUserId: user.id,
      metadata: { reviewId: review.id, itemId: review.item_id, clinicianScore: body.clinicianScore },
    });
    return json({ ok: true, scoringReport }, 200, req);
  } catch (error) {
    console.error('Scoring report recalculation failed:', error);
    return json({ error: error instanceof Error ? error.message : 'Failed to recalculate scoring report' }, 500, req);
  }
});
