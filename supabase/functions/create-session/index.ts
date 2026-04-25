import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { getMocaVersionConfig } from '../_shared/moca-config.ts';
import { recordNotificationOutcome, sendSms } from '../_shared/notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPPORTED_ASSESSMENTS = new Set(['moca']);

function generateAccessCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => (byte % 10).toString()).join('');
}

interface CreateSessionBody {
  patientId?: string;
  caseId?: string;
  ageBand: string;
  educationYears?: number;
  patientPhone?: string;
  assessmentType?: string;
  mocaVersion?: string;
  locationPlace?: string;
  locationCity?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: CreateSessionBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const {
    patientId,
    caseId: caseIdInput,
    ageBand,
    educationYears,
    patientPhone: patientPhoneInput,
    mocaVersion,
    locationPlace,
    locationCity,
  } = body;
  const assessmentType = (body.assessmentType ?? 'moca').toLowerCase();

  if (!ageBand) {
    return json({ error: 'Missing required field: ageBand' }, 400);
  }
  if (!SUPPORTED_ASSESSMENTS.has(assessmentType)) {
    return json({ error: `Unsupported assessmentType: ${assessmentType}` }, 400);
  }
  let resolvedMocaVersion: string;
  try {
    resolvedMocaVersion = getMocaVersionConfig(mocaVersion).version;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unsupported MoCA version' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return json({ error: 'Unauthorized clinician' }, 401);
  }

  await supabase
    .from('clinicians')
    .upsert({
      id: user.id,
      email: user.email ?? `${user.id}@local.invalid`,
      full_name: user.user_metadata?.full_name ?? user.email ?? 'Clinician',
      clinic_name: user.user_metadata?.clinic_name ?? 'Remote Check',
    }, { onConflict: 'id' });

  // Resolve patient: prefer patientId (modern flow), fall back to caseId/phone (legacy inline flow)
  let patientRecordId: string | null = null;
  let patientPhone: string | null = patientPhoneInput?.trim() || null;
  let caseId = caseIdInput?.trim() || '';

  if (patientId) {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, clinician_id, full_name, phone')
      .eq('id', patientId)
      .eq('clinician_id', user.id)
      .maybeSingle();

    if (patientError || !patient) {
      return json({ error: 'Patient not found for this clinician' }, 404);
    }

    patientRecordId = patient.id;
    patientPhone = patient.phone;
    if (!caseId) {
      caseId = `${patient.full_name.slice(0, 24)} · ${new Date().toISOString().slice(0, 10)}`;
    }
  }

  if (!caseId) {
    return json({ error: 'Missing required field: caseId or patientId' }, 400);
  }
  const shouldSendSms = Boolean(patientPhone);

  const accessCode = shouldSendSms ? generateAccessCode() : null;

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      case_id: caseId,
      clinician_id: user.id,
      age_band: ageBand,
      status: 'pending',
      education_years: educationYears ?? null,
      patient_phone: patientPhone,
      patient_id: patientRecordId,
      access_code: accessCode,
      assessment_type: assessmentType,
      moca_version: resolvedMocaVersion,
      location_place: locationPlace ?? null,
      location_city: locationCity ?? null,
    })
    .select('id, link_token, access_code, moca_version')
    .single();

  if (error || !session) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, 500);
  }

  const baseUrl = Deno.env.get('PUBLIC_URL') || 'https://app.remotecheck.com';
  const sessionUrl = `${baseUrl}/#/session/${session.link_token}`;
  const smsResult = shouldSendSms
    ? await sendSms({
        to: patientPhone!,
        message: `Remote Check: כדי להתחיל את המבדק, פתחו את הקישור ${sessionUrl}. קוד חד-פעמי: ${session.access_code ?? accessCode}`,
      })
    : {
        channel: 'sms' as const,
        provider: 'twilio' as const,
        status: 'skipped' as const,
        reason: 'No patient phone number supplied',
      };
  const smsSent = smsResult.status === 'sent';

  const { error: smsLogError } = await supabase
    .from('sessions')
    .update({
      sms_sent_at: smsSent ? new Date().toISOString() : null,
      sms_delivery_error: smsResult.reason ?? null,
    })
    .eq('id', session.id);

  if (smsLogError) {
    console.error('Failed to persist SMS status', smsLogError);
  }

  try {
    await recordNotificationOutcome(supabase, {
      sessionId: session.id,
      notificationType: 'patient_session_sms',
      result: smsResult,
    });
  } catch (notificationError) {
    console.error('Failed to persist SMS notification outcome', notificationError);
  }

  await writeAuditEvent(supabase, {
    eventType: 'session_created',
    sessionId: session.id,
    actorType: 'clinician',
    actorUserId: user.id,
    metadata: { assessmentType, mocaVersion: session.moca_version, smsSent },
  });

  return json({
    sessionId: session.id,
    linkToken: session.link_token,
    sessionUrl,
    accessCode: session.access_code ?? accessCode,
    smsSent,
    smsError: smsResult.reason ?? null,
    assessmentType,
    mocaVersion: session.moca_version,
    patientId: patientRecordId,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
