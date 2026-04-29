import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import {
  notifyClinicianSessionCompleted,
  recordNotificationOutcome,
  type ClinicianCompletionNotificationResult,
} from '../_shared/notifications.ts';
import { scoreSession } from '../_shared/scoring.ts';

const DRAWING_TASKS = ['moca-visuospatial', 'moca-cube', 'moca-clock'];
const TASK_ID_TO_TASK_NAME: Record<string, string> = {
  'moca-visuospatial': 'trailMaking',
  'moca-cube': 'cube',
  'moca-clock': 'clock',
};

type SupabaseClient = any;

export interface CompleteSessionDeps {
  createSupabaseClient: () => SupabaseClient;
  writeAuditEvent: typeof writeAuditEvent;
  notifyClinicianSessionCompleted: typeof notifyClinicianSessionCompleted;
  recordNotificationOutcome: typeof recordNotificationOutcome;
  scoreSession: typeof scoreSession;
}

export async function handleCompleteSession(req: Request, deps: CompleteSessionDeps): Promise<Response> {
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

  const supabase = deps.createSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, clinician_id, status, age_band, education_years, patient_age_years, location_place, location_city, started_at, created_at, moca_version')
    .eq('id', body.sessionId)
    .eq('link_token', body.linkToken)
    .single();

  if (sessionError || !session) return json({ error: 'Session not found' }, 404, req);
  if (session.status === 'completed' || session.status === 'awaiting_review') {
    const { data: existingReport } = await supabase
      .from('scoring_reports')
      .select('*')
      .eq('session_id', session.id)
      .maybeSingle();

    return json({
      ok: true,
      alreadyCompleted: true,
      scoringReport: existingReport ?? null,
    }, 200, req);
  }
  if (session.status !== 'in_progress') return json({ error: 'Session not in progress' }, 409, req);
  if (!Number.isInteger(session.education_years) || !Number.isInteger(session.patient_age_years)) {
    return json({ error: 'Session is missing required clinical scoring context' }, 409, req);
  }

  const { data: taskResults, error: resultsError } = await supabase
    .from('task_results')
    .select('task_type, raw_data')
    .eq('session_id', body.sessionId);
  if (resultsError) return json({ error: 'Failed to load task results' }, 500, req);

  const results = Object.fromEntries((taskResults ?? []).map((result: any) => [result.task_type, result.raw_data]));
  const { error: drawingReviewError } = await supabase
    .from('drawing_reviews')
    .upsert(
      DRAWING_TASKS.map(taskId => ({
        session_id: session.id,
        task_name: TASK_ID_TO_TASK_NAME[taskId],
        task_id: taskId,
        strokes_data: [],
      })),
      { onConflict: 'session_id,task_id', ignoreDuplicates: true },
    );

  if (drawingReviewError) {
    console.error('Drawing review placeholder upsert failed:', drawingReviewError);
    return json({ error: 'Failed to prepare drawing reviews' }, 500, req);
  }

  let report;
  try {
    report = deps.scoreSession(results, {
      sessionId: session.id,
      sessionDate: new Date(session.started_at ?? session.created_at),
      educationYears: session.education_years,
      patientAge: session.patient_age_years,
      mocaVersion: session.moca_version,
      sessionLocation: session.location_place || session.location_city
        ? { place: session.location_place, city: session.location_city }
        : undefined,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to score session' }, 400, req);
  }

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
      total_score: Math.round(report.totalAdjusted),
      needs_review: report.totalProvisional,
      percentile: report.normPercentile,
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
    await deps.writeAuditEvent(supabase, {
      eventType: 'session_completed',
      sessionId: session.id,
      actorType: 'patient',
      metadata: {
        totalRaw: report.totalRaw,
        totalAdjusted: report.totalAdjusted,
        pendingReviewCount: report.pendingReviewCount,
        totalProvisional: report.totalProvisional,
        mocaVersion: report.mocaVersion,
      },
    });
  } catch (auditError) {
    return json({ error: auditError instanceof Error ? auditError.message : 'Failed to write audit event' }, 500, req);
  }

  try {
    const notification = await deps.notifyClinicianSessionCompleted(supabase, {
      id: session.id,
      clinician_id: session.clinician_id,
      status: finalStatus,
    });

    try {
      await deps.recordNotificationOutcome(supabase, {
        sessionId: session.id,
        notificationType: 'clinician_completion_email',
        result: notification,
      });
    } catch (recordError) {
      console.error('Clinician completion notification record failed:', recordError);
    }

    await deps.writeAuditEvent(supabase, {
      eventType: `clinician_completion_email_${notification.status}`,
      sessionId: session.id,
      actorType: 'system',
      metadata: { ...notification },
    });
  } catch (notificationError) {
    const failedNotification: ClinicianCompletionNotificationResult = {
      channel: 'email',
      provider: 'resend',
      status: 'failed',
      reason: notificationError instanceof Error ? notificationError.message : 'Unknown notification error',
    };
    console.error('Clinician completion email notification failed:', notificationError);

    try {
      await deps.recordNotificationOutcome(supabase, {
        sessionId: session.id,
        notificationType: 'clinician_completion_email',
        result: failedNotification,
      });
    } catch (recordError) {
      console.error('Clinician completion notification failure record failed:', recordError);
    }

    try {
      await deps.writeAuditEvent(supabase, {
        eventType: 'clinician_completion_email_failed',
        sessionId: session.id,
        actorType: 'system',
        metadata: { ...failedNotification },
      });
    } catch (auditError) {
      console.error('Clinician completion notification failure audit failed:', auditError);
    }
  }

  return json({ ok: true, scoringReport: report }, 200, req);
}
