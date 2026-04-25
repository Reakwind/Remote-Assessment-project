import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import { notifyClinicianSessionCompleted } from '../_shared/notifications.ts';
import { ageFromBand, scoreSession } from '../_shared/scoring.ts';

const DRAWING_TASKS = ['moca-visuospatial', 'moca-cube', 'moca-clock'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: { sessionId: string; linkToken: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  if (!body.sessionId || !body.linkToken) {
    return json({ error: 'Missing required fields: sessionId, linkToken' }, 400, req);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, clinician_id, status, age_band, education_years, location_place, location_city, started_at, created_at')
    .eq('id', body.sessionId)
    .eq('link_token', body.linkToken)
    .single();

  if (sessionError || !session) return json({ error: 'Session not found' }, 404, req);
  if (session.status === 'completed' || session.status === 'awaiting_review') {
    return json({ error: 'Session already completed' }, 409, req);
  }
  if (session.status !== 'in_progress') return json({ error: 'Session not in progress' }, 409, req);

  const { data: taskResults, error: resultsError } = await supabase
    .from('task_results')
    .select('task_type, raw_data')
    .eq('session_id', body.sessionId);
  if (resultsError) return json({ error: 'Failed to load task results' }, 500, req);

  const results = Object.fromEntries((taskResults ?? []).map(result => [result.task_type, result.raw_data]));
  const { error: drawingReviewError } = await supabase
    .from('drawing_reviews')
    .upsert(
      DRAWING_TASKS.map(taskId => ({ session_id: session.id, task_id: taskId, strokes_data: [] })),
      { onConflict: 'session_id,task_id', ignoreDuplicates: true },
    );

  if (drawingReviewError) {
    console.error('Drawing review placeholder upsert failed:', drawingReviewError);
    return json({ error: 'Failed to prepare drawing reviews' }, 500, req);
  }

  const report = scoreSession(results, {
    sessionId: session.id,
    sessionDate: new Date(session.started_at ?? session.created_at),
    educationYears: session.education_years,
    patientAge: ageFromBand(session.age_band),
    sessionLocation: { place: session.location_place, city: session.location_city },
  });

  const scoringReviewRows = report.domains
    .flatMap(domain => domain.items)
    .filter(item => item.needsReview && item.reviewReason !== 'drawing')
    .map(item => ({
      session_id: session.id,
      item_id: item.taskId,
      task_type: item.taskId,
      max_score: item.max,
      raw_data: item.rawData ?? null,
    }));

  if (scoringReviewRows.length > 0) {
    const { error: scoringReviewError } = await supabase
      .from('scoring_item_reviews')
      .upsert(scoringReviewRows, { onConflict: 'session_id,item_id', ignoreDuplicates: true });

    if (scoringReviewError) {
      console.error('Scoring item review placeholder upsert failed:', scoringReviewError);
      return json({ error: 'Failed to prepare scoring reviews' }, 500, req);
    }
  }

  const { error: reportError } = await supabase
    .from('scoring_reports')
    .upsert({
      session_id: session.id,
      total_raw: report.totalRaw,
      total_adjusted: report.totalAdjusted,
      total_provisional: report.totalProvisional,
      norm_percentile: report.normPercentile,
      norm_sd: report.normSd,
      pending_review_count: report.pendingReviewCount,
      domains: report.domains,
      completed_at: report.completedAt,
    }, { onConflict: 'session_id' });

  if (reportError) {
    console.error('Scoring report upsert failed:', reportError);
    return json({ error: 'Failed to save scoring report' }, 500, req);
  }

  const { error: statusError } = await supabase
    .from('sessions')
    .update({
      status: report.totalProvisional ? 'awaiting_review' : 'completed',
      completed_at: report.completedAt,
    })
    .eq('id', session.id);

  if (statusError) return json({ error: 'Failed to complete session' }, 500, req);

  const finalStatus = report.totalProvisional ? 'awaiting_review' : 'completed';

  try {
    await writeAuditEvent(supabase, {
      eventType: 'session_completed',
      sessionId: session.id,
      actorType: 'patient',
      metadata: {
        totalRaw: report.totalRaw,
        totalAdjusted: report.totalAdjusted,
        pendingReviewCount: report.pendingReviewCount,
        totalProvisional: report.totalProvisional,
      },
    });
  } catch (auditError) {
    return json({ error: auditError instanceof Error ? auditError.message : 'Failed to write audit event' }, 500, req);
  }

  try {
    const notification = await notifyClinicianSessionCompleted(supabase, {
      id: session.id,
      clinician_id: session.clinician_id,
      status: finalStatus,
    });

    await writeAuditEvent(supabase, {
      eventType: `clinician_completion_email_${notification.status}`,
      sessionId: session.id,
      actorType: 'system',
      metadata: { ...notification },
    });
  } catch (notificationError) {
    console.error('Clinician completion email notification failed:', notificationError);
  }

  return json({ ok: true, scoringReport: report }, 200, req);
});
