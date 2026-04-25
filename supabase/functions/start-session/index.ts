import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: { token: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return json({ error: 'Missing token' }, 400, req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status, link_used_at, moca_version, age_band, education_years, location_place, location_city, created_at')
    .eq('link_token', token)
    .single();

  if (error || !session) return json({ error: 'Invalid link' }, 404, req);
  if (session.link_used_at || session.status !== 'pending') return json({ error: 'Link already used' }, 410, req);

  const now = new Date().toISOString();
  const { data: startedSession, error: updateError } = await supabase
    .from('sessions')
    .update({ link_used_at: now, started_at: now, status: 'in_progress' })
    .eq('id', session.id)
    .is('link_used_at', null)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('Failed to start session:', updateError);
    return json({ error: 'Failed to start session' }, 500, req);
  }
  if (!startedSession) return json({ error: 'Link already used' }, 410, req);

  try {
    await writeAuditEvent(supabase, {
      eventType: 'session_started',
      sessionId: session.id,
      actorType: 'patient',
      metadata: { mocaVersion: session.moca_version, ageBand: session.age_band },
    });
  } catch (auditError) {
    return json({ error: auditError instanceof Error ? auditError.message : 'Failed to write audit event' }, 500, req);
  }

  return json({
    sessionId: session.id,
    mocaVersion: session.moca_version,
    ageBand: session.age_band,
    educationYears: session.education_years,
    locationPlace: session.location_place,
    locationCity: session.location_city,
    sessionDate: now,
  }, 200, req);
});
