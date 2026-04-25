import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface StartSessionBody {
  token: string;
  accessCode?: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  const accessCode = body.accessCode?.trim();
  if (!token) return json({ error: 'Missing test number' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const tokenColumn = isUuid(token) ? 'link_token' : 'access_code';
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, link_token, status, link_used_at, age_band, education_years, created_at, access_code, moca_version')
    .eq(tokenColumn, token)
    .single();

  if (error || !session) {
    return json({ error: 'Invalid test number' }, 404);
  }

  // Enforce single-use
  if (session.link_used_at) {
    return json({ error: 'Test number already used' }, 410);
  }

  if (session.status !== 'pending' && session.status !== 'in_progress') {
    return json({ error: 'Session not available' }, 409);
  }

  if (tokenColumn === 'link_token' && session.access_code && accessCode && accessCode !== session.access_code) {
    return json({ error: 'Invalid access code' }, 401);
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
    mocaVersion:    session.moca_version,
    sessionDate:    new Date().toISOString(),
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
