import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { escapeCsvField, formatScore, normalizeExportReport } from '../_shared/export-report.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { data: sessions, error: dbError } = await supabase
    .from('sessions')
    .select(`
      case_id,
      age_band,
      assessment_type,
      moca_version,
      status,
      created_at,
      completed_at,
      scoring_reports (
        total_raw,
        total_adjusted,
        total_provisional,
        norm_percentile,
        norm_sd,
        pending_review_count,
        total_score,
        percentile,
        needs_review
      )
    `)
    .eq('clinician_id', user.id)
    .eq('status', 'completed');

  if (dbError) return new Response('Database error', { status: 500, headers: corsHeaders });

  const header = [
    'Case ID',
    'MoCA Version',
    'Age Band',
    'Created Date',
    'Completed Date',
    'Status',
    'Total Raw',
    'Total Adjusted',
    'Norm Percentile',
    'Norm SD',
    'Pending Review Count',
    'Finalized',
  ].join(',');
  const rows = (sessions || []).map(s => {
    const report = Array.isArray(s.scoring_reports) ? s.scoring_reports[0] : s.scoring_reports;
    const normalized = normalizeExportReport(report);
    return [
      s.case_id,
      s.moca_version ?? s.assessment_type ?? 'moca',
      s.age_band,
      new Date(s.created_at).toISOString().split('T')[0],
      s.completed_at ? new Date(s.completed_at).toISOString().split('T')[0] : '',
      s.status,
      formatScore(normalized?.totalRaw),
      formatScore(normalized?.totalAdjusted),
      normalized?.normPercentile ?? 'N/A',
      normalized?.normSd ?? 'N/A',
      normalized?.pendingReviewCount ?? 'N/A',
      normalized?.isFinal ? 'Yes' : 'No',
    ].map(escapeCsvField).join(',');
  });

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moca_export.csv"',
    },
  });
});
