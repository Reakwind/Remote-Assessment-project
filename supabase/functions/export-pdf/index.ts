import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

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

  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text('Remote Check - Clinical Report', 20, 20);
  
  doc.setFontSize(14);
  doc.text(`Case ID: ${session.case_id}`, 20, 40);
  doc.text(`Age Band: ${session.age_band}`, 20, 50);
  doc.text(`Date: ${new Date(session.created_at).toLocaleDateString()}`, 20, 60);

  doc.text(`Total Score: ${report?.total_score ?? 'Pending'}/30`, 20, 80);
  doc.text(`Percentile: ${report?.percentile ?? 'N/A'}%`, 20, 90);
  
  if (report?.needs_review) {
    doc.setTextColor(200, 0, 0);
    doc.text('WARNING: PROVISIONAL SCORE (NEEDS MANUAL REVIEW)', 20, 110);
  }

  const pdfOutput = doc.output('arraybuffer');

  return new Response(pdfOutput, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report_${session.case_id}.pdf"`,
    },
  });
});
