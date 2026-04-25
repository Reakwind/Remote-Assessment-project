import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed, requireClinician } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: {
    caseId: string;
    mocaVersion?: '8.1' | '8.2' | '8.3';
    ageBand: '60-69' | '70-79' | '80+';
    educationYears: number;
    locationPlace: string;
    locationCity: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : '';
  const mocaVersion = body.mocaVersion ?? '8.3';
  const ageBand = body.ageBand;
  const educationYears = body.educationYears;
  const locationPlace = typeof body.locationPlace === 'string' ? body.locationPlace.trim() : '';
  const locationCity = typeof body.locationCity === 'string' ? body.locationCity.trim() : '';
  if (!caseId || !ageBand || educationYears === undefined || !locationPlace || !locationCity) {
    return json({ error: 'Missing required fields' }, 400, req);
  }
  if (!['60-69', '70-79', '80+'].includes(ageBand)) {
    return json({ error: 'Invalid ageBand' }, 400, req);
  }
  if (!['8.1', '8.2', '8.3'].includes(mocaVersion)) {
    return json({ error: 'Invalid mocaVersion' }, 400, req);
  }
  if (!Number.isInteger(educationYears) || educationYears < 0 || educationYears > 40) {
    return json({ error: 'educationYears must be an integer from 0 to 40' }, 400, req);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { user, response } = await requireClinician(req, supabase);
  if (response) return response;

  const { error: clinicianError } = await supabase
    .from('clinicians')
    .upsert({ id: user.id, clinic_name: user.email ?? 'Remote Check Clinic' }, { onConflict: 'id' });

  if (clinicianError) {
    console.error('Clinician upsert failed:', clinicianError);
    return json({ error: 'Failed to prepare clinician profile' }, 500, req);
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      clinician_id: user.id,
      case_id: caseId,
      moca_version: mocaVersion,
      age_band: ageBand,
      education_years: educationYears,
      location_place: locationPlace,
      location_city: locationCity,
      status: 'pending',
    })
    .select('id, link_token, moca_version, created_at')
    .single();

  if (error || !session) {
    console.error('Session creation failed:', error);
    return json({ error: error?.code === '23505' ? 'Case ID already exists' : 'Failed to create session' }, error?.code === '23505' ? 409 : 500, req);
  }

  try {
    await writeAuditEvent(supabase, {
      eventType: 'session_created',
      sessionId: session.id,
      actorType: 'clinician',
      actorUserId: user.id,
      metadata: { caseId, mocaVersion, ageBand, educationYears, locationPlace, locationCity },
    });
  } catch (auditError) {
    await supabase.from('sessions').delete().eq('id', session.id);
    return json({ error: auditError instanceof Error ? auditError.message : 'Failed to write audit event' }, 500, req);
  }

  const baseUrl = Deno.env.get('PUBLIC_URL') || 'http://localhost:5173';
  return json({
    sessionId: session.id,
    linkToken: session.link_token,
    mocaVersion: session.moca_version,
    sessionUrl: `${baseUrl}/#/session/${session.link_token}`,
    createdAt: session.created_at,
  }, 200, req);
});
