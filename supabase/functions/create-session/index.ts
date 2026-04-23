import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSms } from '../_shared/notifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function generateAccessCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => (byte % 10).toString()).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { caseId: string; ageBand: string; educationYears?: number; patientPhone: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { caseId, ageBand, educationYears, patientPhone } = body;
  if (!caseId || !ageBand || !patientPhone) {
    return json({ error: 'Missing required fields' }, 400);
  }
  const accessCode = generateAccessCode();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Authenticate clinician from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return json({ error: 'Unauthorized clinician' }, 401);
  }

  // Create session
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      case_id: caseId,
      clinician_id: user.id,
      age_band: ageBand,
      status: 'pending',
      education_years: educationYears ?? null,
      patient_phone: patientPhone,
      access_code: accessCode,
      assessment_type: 'moca',
    })
    .select('id, link_token, access_code')
    .single();

  if (error || !session) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, 500);
  }

  // For testing, mock a base url or use env
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
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
