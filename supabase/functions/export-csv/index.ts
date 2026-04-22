import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

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

  if (dbError) return new Response('Database error', { status: 500 });

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
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moca_export.csv"',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
