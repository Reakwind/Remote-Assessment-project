import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSms } from '../_shared/notifications.ts';

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

  const { patientId, caseId: caseIdInput, ageBand, educationYears, patientPhone: patientPhoneInput } = body;
  const assessmentType = (body.assessmentType ?? 'moca').toLowerCase();

  if (!ageBand) {
    return json({ error: 'Missing required field: ageBand' }, 400);
  }
  if (!SUPPORTED_ASSESSMENTS.has(assessmentType)) {
    return json({ error: `Unsupported assessmentType: ${assessmentType}` }, 400);
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
  if (!patientPhone) {
    return json({ error: 'Missing patient phone number' }, 400);
  }

  const accessCode = generateAccessCode();

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
    })
    .select('id, link_token, access_code')
    .single();

  if (error || !session) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, 500);
  }

  const baseUrl = Deno.env.get('PUBLIC_URL') || 'https://app.remotecheck.com';
  const sessionUrl = `${baseUrl}/#/session/${session.link_token}`;
  const smsMessage = `Remote Check: כדי להתחיל את המבדק, פתחו את הקישור ${sessionUrl}. קוד חד-פעמי: ${session.access_code ?? accessCode}`;
  const smsResult = await sendSms({ to: patientPhone, message: smsMessage });

  const { error: smsLogError } = await supabase
    .from('sessions')
    .update({
      sms_sent_at: smsResult.ok ? new Date().toISOString() : null,
      sms_delivery_error: smsResult.error ?? null,
    })
    .eq('id', session.id);

  if (smsLogError) {
    console.error('Failed to persist SMS status', smsLogError);
  }

  return json({
    sessionId: session.id,
    linkToken: session.link_token,
    sessionUrl,
    accessCode: session.access_code ?? accessCode,
    smsSent: smsResult.ok,
    smsError: smsResult.error ?? null,
    assessmentType,
    patientId: patientRecordId,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
