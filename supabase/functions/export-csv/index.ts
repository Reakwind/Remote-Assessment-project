import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import {
  escapeCsvField,
  formatDomainSummary,
  formatMaybeDate,
  formatScore,
  normalizeExportReport,
} from '../_shared/export-report.ts';
import { corsHeaders, corsResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req);
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(req) });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders(req) });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders(req) });

  const url = new URL(req.url);
  let requestedSessionId = url.searchParams.get('sessionId');
  if (req.method === 'POST') {
    try {
      const body = await req.clone().json();
      if (typeof body?.sessionId === 'string' && body.sessionId.trim()) {
        requestedSessionId = body.sessionId.trim();
      }
    } catch {
      // POST without a JSON body exports all clinician sessions.
    }
  }

  let query = supabase
    .from('sessions')
    .select(`
      id,
      case_id,
      age_band,
      education_years,
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
        domains,
        finalized_at,
        total_score,
        percentile,
        needs_review
      )
    `)
    .eq('clinician_id', user.id)
    .order('created_at', { ascending: false });

  if (requestedSessionId) {
    query = query.eq('id', requestedSessionId);
  }

  const { data: sessions, error: dbError } = await query;

  if (dbError) return new Response('Database error', { status: 500, headers: corsHeaders(req) });
  if (requestedSessionId && (!sessions || sessions.length === 0)) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const header = [
    'Case ID',
    'MoCA Version',
    'Age Band',
    'Education Years',
    'Created Date',
    'Completed Date',
    'Finalized Date',
    'Status',
    'Total Raw',
    'Total Adjusted',
    'Norm Percentile',
    'Norm SD',
    'Pending Review Count',
    'Domain Scores',
    'Finalized',
  ].join(',');
  const rows = (sessions || []).map(s => {
    const report = Array.isArray(s.scoring_reports) ? s.scoring_reports[0] : s.scoring_reports;
    const normalized = normalizeExportReport(report);
    return [
      s.case_id,
      s.moca_version ?? s.assessment_type ?? 'moca',
      s.age_band,
      s.education_years ?? '',
      formatMaybeDate(s.created_at),
      s.completed_at ? formatMaybeDate(s.completed_at) : '',
      normalized?.finalizedAt ? formatMaybeDate(normalized.finalizedAt) : '',
      s.status,
      formatScore(normalized?.totalRaw),
      formatScore(normalized?.totalAdjusted),
      normalized?.normPercentile ?? 'N/A',
      normalized?.normSd ?? 'N/A',
      normalized?.pendingReviewCount ?? 'N/A',
      normalized ? formatDomainSummary(normalized.domains) : 'N/A',
      normalized?.isFinal ? 'Yes' : 'No',
    ].map(escapeCsvField).join(',');
  });

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moca_export.csv"',
    },
  });
});
