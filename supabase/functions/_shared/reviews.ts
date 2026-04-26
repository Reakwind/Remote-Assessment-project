import { applyManualScores, type ScoringReport } from './scoring.ts';

type SupabaseClient = any;

export async function recalculateReviewedReport(supabase: SupabaseClient, sessionId: string, finalizedBy: string | null) {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, age_band, education_years, patient_age_years, location_place, location_city, started_at, created_at, moca_version')
    .eq('id', sessionId)
    .single();
  if (sessionError || !session) throw new Error('Session not found');
  if (!Number.isInteger(session.education_years) || !Number.isInteger(session.patient_age_years)) {
    throw new Error('Session is missing required clinical scoring context');
  }

  const { data: scoringReport, error: reportError } = await supabase
    .from('scoring_reports')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  if (reportError || !scoringReport) throw new Error('Scoring report not found');

  const [{ data: drawingReviews }, { data: scoringItemReviews }] = await Promise.all([
    supabase
      .from('drawing_reviews')
      .select('task_id, clinician_score')
      .eq('session_id', sessionId),
    supabase
      .from('scoring_item_reviews')
      .select('item_id, clinician_score')
      .eq('session_id', sessionId),
  ]);

  const manualScores = Object.fromEntries([
    ...(drawingReviews ?? [])
      .filter((row: any) => row.clinician_score !== null)
      .map((row: any) => [row.task_id, row.clinician_score]),
    ...(scoringItemReviews ?? [])
      .filter((row: any) => row.clinician_score !== null)
      .map((row: any) => [row.item_id, row.clinician_score]),
  ]);

  const updatedReport = applyManualScores(dbReportToScoringReport(scoringReport, session.education_years, session.moca_version), {
    sessionId: session.id,
    sessionDate: new Date(session.started_at ?? session.created_at),
    educationYears: session.education_years,
    patientAge: session.patient_age_years,
    mocaVersion: session.moca_version,
    sessionLocation: session.location_place || session.location_city
      ? { place: session.location_place, city: session.location_city }
      : undefined,
  }, manualScores);

  const final = !updatedReport.totalProvisional;
  const finalizedAt = final ? new Date().toISOString() : null;
  const { error: updateReportError } = await supabase
    .from('scoring_reports')
    .update({
      total_raw: updatedReport.totalRaw,
      total_adjusted: updatedReport.totalAdjusted,
      total_provisional: updatedReport.totalProvisional,
      total_score: Math.round(updatedReport.totalAdjusted),
      needs_review: updatedReport.totalProvisional,
      percentile: updatedReport.normPercentile,
      norm_percentile: updatedReport.normPercentile,
      norm_sd: updatedReport.normSd,
      pending_review_count: updatedReport.pendingReviewCount,
      domains: updatedReport.domains,
      finalized_at: finalizedAt,
      finalized_by: final ? finalizedBy : null,
    })
    .eq('session_id', session.id);
  if (updateReportError) throw new Error('Failed to update scoring report');

  const { error: updateSessionError } = await supabase
    .from('sessions')
    .update({ status: final ? 'completed' : 'awaiting_review' })
    .eq('id', session.id);
  if (updateSessionError) throw new Error('Failed to update session status');

  return updatedReport;
}

function dbReportToScoringReport(scoringReport: any, educationYears: number, mocaVersion: string | null | undefined): ScoringReport {
  return {
    sessionId: scoringReport.session_id,
    mocaVersion: mocaVersion ?? '8.3',
    totalRaw: scoringReport.total_raw,
    totalAdjusted: scoringReport.total_adjusted,
    totalProvisional: scoringReport.total_provisional,
    educationYears,
    normPercentile: scoringReport.norm_percentile,
    normSd: scoringReport.norm_sd,
    domains: scoringReport.domains,
    pendingReviewCount: scoringReport.pending_review_count,
    completedAt: scoringReport.completed_at,
  };
}
