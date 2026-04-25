import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
import {
  formatScore,
  getFinalizedExportBlockReason,
  normalizeExportReport,
} from '../_shared/export-report.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  let body: { sessionId: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { data: session } = await supabase
    .from('sessions')
    .select('*, scoring_reports(*)')
    .eq('id', body.sessionId)
    .eq('clinician_id', user.id)
    .single();

  if (!session) return new Response('Session not found', { status: 404, headers: corsHeaders });

  const report = Array.isArray(session.scoring_reports) ? session.scoring_reports[0] : session.scoring_reports;
  const blockReason = getFinalizedExportBlockReason(session, report);
  if (blockReason) {
    return new Response(JSON.stringify({ error: blockReason }), {
      status: blockReason === 'Session not found' || blockReason === 'Scoring report not found' ? 404 : 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const normalizedReport = normalizeExportReport(report);
  const mocaVersion = session.moca_version ?? session.assessment_type ?? 'moca';
  const reportDate = session.completed_at ?? report?.finalized_at ?? report?.completed_at ?? session.created_at;

  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text('Remote Check - Clinical Report', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Case ID: ${session.case_id}`, 20, 40);
  doc.text(`MoCA Version: ${mocaVersion}`, 20, 50);
  doc.text(`Age Band: ${session.age_band}`, 20, 60);
  doc.text(`Education Years: ${session.education_years ?? 'N/A'}`, 20, 70);
  doc.text(`Date: ${new Date(reportDate).toLocaleDateString()}`, 20, 80);

  doc.text(`Total Raw: ${formatScore(normalizedReport?.totalRaw)}/30`, 20, 100);
  doc.text(`Total Adjusted: ${formatScore(normalizedReport?.totalAdjusted)}/30`, 20, 110);
  doc.text(`Norm Percentile: ${normalizedReport?.normPercentile ?? 'N/A'}%`, 20, 120);
  doc.text(`Norm SD: ${normalizedReport?.normSd ?? 'N/A'}`, 20, 130);
  doc.text('Review Status: Finalized by clinician', 20, 150);

  const pdfOutput = doc.output('arraybuffer');

  return new Response(pdfOutput, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report_${sanitizeFilename(session.case_id)}.pdf"`,
    },
  });
});

function sanitizeFilename(value: unknown): string {
  const cleaned = String(value ?? 'session').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'session';
}
