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

  const { token, accessCode } = body;
  if (!token) return json({ error: 'Missing token' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Look up session by token
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status, link_used_at, age_band, education_years, created_at, access_code, moca_version')
    .eq('link_token', token)
    .single();

  if (error || !session) {
    return json({ error: 'Invalid link' }, 404);
  }

  // Enforce single-use
  if (session.link_used_at) {
    return json({ error: 'Link already used' }, 410);
  }

  if (session.status !== 'pending' && session.status !== 'in_progress') {
    return json({ error: 'Session not available' }, 409);
  }

  const normalizedCode = accessCode?.trim();
  const hasConfiguredCode = Boolean(session.access_code);

  if (!normalizedCode && hasConfiguredCode) {
    return json({
      status: 'code_required',
      sessionId: session.id,
      ageBand: session.age_band,
      educationYears: session.education_years,
      mocaVersion: session.moca_version,
      sessionDate: new Date().toISOString(),
      requiresAccessCode: true,
    });
  }

  if (hasConfiguredCode && normalizedCode !== session.access_code) {
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
      return json({ error: 'Link already used' }, 410);
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
