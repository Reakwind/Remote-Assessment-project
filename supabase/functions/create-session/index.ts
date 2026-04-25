import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { getMocaVersionConfig } from '../_shared/moca-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SUPPORTED_ASSESSMENTS = new Set(['moca']);

function generateTestNumber(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 10).toString()).join('');
}

function generateCaseId(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `CASE-${date}-${suffix}`;
}

function sessionBaseUrl(req: Request): string {
  const configured = Deno.env.get('PUBLIC_URL')?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const origin = req.headers.get('Origin')?.trim();
  if (origin) return origin.replace(/\/$/, '');

  return 'https://app.remotecheck.com';
}

interface CreateSessionBody {
  patientId?: string;
  caseId?: string;
  ageBand: string;
  educationYears?: number;
  assessmentType?: string;
  mocaVersion?: string;
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
    mocaVersion,
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
  let caseId = caseIdInput?.trim() || '';

  if (patientId) {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, clinician_id')
      .eq('id', patientId)
      .eq('clinician_id', user.id)
      .maybeSingle();

    if (patientError || !patient) {
      return json({ error: 'Patient not found for this clinician' }, 404);
    }

    patientRecordId = patient.id;
    if (!caseId) {
      caseId = generateCaseId();
    }
  }

  if (!caseId) {
    return json({ error: 'Missing required field: caseId or patientId' }, 400);
  }

  let accessCode: string;
  try {
    accessCode = await generateUniqueTestNumber(supabase);
  } catch (error) {
    console.error('Test number generation failed:', error);
    return json({ error: 'Failed to generate test number' }, 500);
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      case_id: caseId,
      clinician_id: user.id,
      age_band: ageBand,
      status: 'pending',
      education_years: educationYears ?? 12,
      patient_id: patientRecordId,
      access_code: accessCode,
      assessment_type: assessmentType,
      moca_version: resolvedMocaVersion,
    })
    .select('id, link_token, access_code, moca_version')
    .single();

  if (error || !session) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, 500);
  }

  const baseUrl = sessionBaseUrl(req);
  const sessionUrl = `${baseUrl}/#/session/${session.access_code ?? accessCode}`;

  await writeAuditEvent(supabase, {
    eventType: 'session_created',
    sessionId: session.id,
    actorType: 'clinician',
    actorUserId: user.id,
    metadata: { assessmentType, mocaVersion: session.moca_version, testNumberGenerated: true },
  });

  return json({
    sessionId: session.id,
    linkToken: session.link_token,
    sessionUrl,
    accessCode: session.access_code ?? accessCode,
    testNumber: session.access_code ?? accessCode,
    assessmentType,
    mocaVersion: session.moca_version,
    patientId: patientRecordId,
  });
});

async function generateUniqueTestNumber(supabase: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateTestNumber();
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('access_code', code)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle();

    if (error) throw new Error('Failed to generate test number');
    if (!data) return code;
  }

  throw new Error('Failed to generate unique test number');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
