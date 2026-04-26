import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartSessionBody {
  token: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: StartSessionBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const token = body.token?.trim();
  if (!token) return json({ error: 'Missing test number' }, 400);
  if (!/^\d{8}$/.test(token)) return json({ error: 'Invalid test number' }, 404);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, link_token, status, link_used_at, age_band, education_years, patient_age_years, created_at, access_code, moca_version, assessment_language')
    .eq('access_code', token)
    .in('status', ['pending', 'in_progress'])
    .single();

  if (error || !session) {
    return json({ error: 'Invalid test number' }, 404);
  }

  // Enforce single-use
  if (session.link_used_at) {
    return json({ error: 'Test number already used' }, 410);
  }

  if (session.status === 'pending') {
    const { data: startedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        started_at: new Date().toISOString(),
        link_used_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', session.id)
      .eq('status', 'pending')
      .is('link_used_at', null)
      .select('id')
      .maybeSingle();

    if (updateError) {
      return json({ error: 'Failed to start session' }, 500);
    }
    if (!startedSession) {
      return json({ error: 'Test number already used' }, 410);
    }

    await writeAuditEvent(supabase, {
      eventType: 'session_started',
      sessionId: session.id,
      actorType: 'patient',
      metadata: { mocaVersion: session.moca_version },
    });
  }

  return json({
    status:         'ready',
    sessionId:      session.id,
    linkToken:      session.link_token,
	    ageBand:        session.age_band,
	    educationYears: session.education_years,
	    patientAge:     session.patient_age_years,
	    mocaVersion:    session.moca_version,
	    language:       session.assessment_language,
	    sessionDate:    new Date().toISOString(),
	  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
