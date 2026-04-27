import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
import {
  formatDeviceContextScreen,
  formatDeviceContextSummary,
  formatDeviceContextUserAgent,
  formatDeviceContextViewport,
  formatDomainSummary,
  formatMaybeDate,
  formatScore,
  getFinalizedExportBlockReason,
  normalizeExportReport,
} from '../_shared/export-report.ts';
import { corsHeaders, corsResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req);
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders(req) });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders(req) });

  let body: { sessionId: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders(req) });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders(req) });

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      scoring_reports(*),
      drawing_reviews(task_id, clinician_score, clinician_notes, reviewed_at),
      scoring_item_reviews(item_id, task_type, max_score, clinician_score, clinician_notes, reviewed_at)
    `)
    .eq('id', body.sessionId)
    .eq('clinician_id', user.id)
    .single();

  if (!session) return new Response('Session not found', { status: 404, headers: corsHeaders(req) });

  const report = Array.isArray(session.scoring_reports) ? session.scoring_reports[0] : session.scoring_reports;
  const blockReason = getFinalizedExportBlockReason(session, report);
  if (blockReason) {
    return new Response(JSON.stringify({ error: blockReason }), {
      status: blockReason === 'Session not found' || blockReason === 'Scoring report not found' ? 404 : 409,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  const normalizedReport = normalizeExportReport(report);
  const mocaVersion = session.moca_version ?? session.assessment_type ?? 'moca';
  const reportDate = session.completed_at ?? report?.finalized_at ?? report?.completed_at ?? session.created_at;
  const reviewRows = [
    ...(session.drawing_reviews ?? []).map((review: any) => ({
      kind: 'Drawing',
      item: review.task_id,
      score: review.clinician_score,
      notes: review.clinician_notes,
      reviewedAt: review.reviewed_at,
    })),
    ...(session.scoring_item_reviews ?? [])
      .filter((review: any) => Number(review.max_score ?? 0) > 0)
      .map((review: any) => ({
        kind: 'Manual item',
        item: review.item_id ?? review.task_type,
        score: review.clinician_score,
        notes: review.clinician_notes,
        reviewedAt: review.reviewed_at,
      })),
  ];

  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text('Remote Check - Clinical Report', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Case ID: ${session.case_id}`, 20, 40);
  doc.text(`MoCA Version: ${mocaVersion}`, 20, 50);
  doc.text(`Age Band: ${session.age_band}`, 20, 60);
  doc.text(`Education Years: ${session.education_years ?? 'N/A'}`, 20, 70);
  doc.text(`Completed Date: ${formatMaybeDate(reportDate)}`, 20, 80);
  doc.text(`Finalized Date: ${formatMaybeDate(normalizedReport?.finalizedAt)}`, 20, 90);
  doc.text(`Patient Device: ${formatDeviceContextSummary(session.device_context)}`, 20, 100);
  doc.text(`Viewport: ${formatDeviceContextViewport(session.device_context)} | Screen: ${formatDeviceContextScreen(session.device_context)}`, 20, 110);
  doc.text(`User Agent: ${formatDeviceContextUserAgent(session.device_context).slice(0, 120)}`, 20, 120);

  doc.text(`Total Raw: ${formatScore(normalizedReport?.totalRaw)}/30`, 20, 140);
  doc.text(`Total Adjusted: ${formatScore(normalizedReport?.totalAdjusted)}/30`, 20, 150);
  doc.text(`Norm Percentile: ${normalizedReport?.normPercentile ?? 'N/A'}%`, 20, 160);
  doc.text(`Norm SD: ${normalizedReport?.normSd ?? 'N/A'}`, 20, 170);
  doc.text(`Pending Review Count: ${normalizedReport?.pendingReviewCount ?? 'N/A'}`, 20, 180);
  doc.text('Review Status: Finalized by clinician', 20, 190);

  let y = 210;
  doc.setFontSize(16);
  doc.text('Domain Scores', 20, y);
  y += 10;
  doc.setFontSize(11);
  const domainSummary = formatDomainSummary(normalizedReport?.domains ?? []);
  y = writeWrapped(doc, domainSummary, 20, y, 170);

  y += 10;
  doc.setFontSize(16);
  doc.text('Clinician Review Evidence', 20, y);
  y += 10;
  doc.setFontSize(10);
  if (reviewRows.length === 0) {
    doc.text('No manual review rows recorded.', 20, y);
  } else {
    for (const row of reviewRows) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const notes = row.notes ? ` Notes: ${row.notes}` : '';
      y = writeWrapped(
        doc,
        `${row.kind}: ${row.item} | Score: ${formatScore(row.score)} | Reviewed: ${formatMaybeDate(row.reviewedAt)}${notes}`,
        20,
        y,
        170,
      );
      y += 3;
    }
  }

  const pdfOutput = doc.output('arraybuffer');

  return new Response(pdfOutput, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report_${sanitizeFilename(session.case_id)}.pdf"`,
    },
  });
});

function sanitizeFilename(value: unknown): string {
  const cleaned = String(value ?? 'session').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'session';
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 6;
}
