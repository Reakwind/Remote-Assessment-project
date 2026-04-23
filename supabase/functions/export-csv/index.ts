import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      created_at,
      scoring_reports ( total_score, percentile, needs_review )
    `)
    .eq('clinician_id', user.id)
    .eq('status', 'completed');

  if (dbError) return new Response('Database error', { status: 500, headers: corsHeaders });

  const escapeCsvField = (field: any) => {
    if (field === null || field === undefined) return '';
    let str = String(field);
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const header = ['Case ID', 'Age Band', 'Date', 'Total Score', 'Percentile', 'Needs Review'].join(',');
  const rows = (sessions || []).map(s => {
    const report = Array.isArray(s.scoring_reports) ? s.scoring_reports[0] : s.scoring_reports;
    return [
      s.case_id,
      s.age_band,
      new Date(s.created_at).toISOString().split('T')[0],
      report?.total_score ?? 'N/A',
      report?.percentile ?? 'N/A',
      report?.needs_review ? 'Yes' : 'No'
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
