import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json as jsonResponse } from '../_shared/http.ts';
import { getMocaVersionConfig } from '../_shared/moca-config.ts';

const SUPPORTED_ASSESSMENTS = new Set(['moca']);
const SUPPORTED_LANGUAGES = new Set(['he']);

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
  ageBand?: string;
  educationYears?: number;
  assessmentType?: string;
  language?: string;
  mocaVersion?: string;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => jsonResponse(body, status, req);
  if (req.method === 'OPTIONS') {
    return corsResponse(req);
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
    language,
    mocaVersion,
  } = body;
  const assessmentType = (body.assessmentType ?? 'moca').toLowerCase();

  if (!SUPPORTED_ASSESSMENTS.has(assessmentType)) {
    return json({ error: `Unsupported assessmentType: ${assessmentType}` }, 400);
  }
  const requestedLanguage = (language ?? 'he').toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(requestedLanguage)) {
    return json({ error: `Unsupported language: ${requestedLanguage}` }, 400);
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

  // Resolve case record: prefer patientId from the MVP case list, fall back to caseId for API compatibility.
  let patientRecordId: string | null = null;
  let caseId = caseIdInput?.trim() || '';
  let resolvedAgeBand = ageBand;
  let resolvedEducationYears = educationYears;
  let patientAgeYears: number | null = null;
  let patientDateOfBirth: string | null = null;
  let patientGender: string | null = null;
  let patientDominantHand: string | null = null;
  let assessmentLanguage = requestedLanguage;

  if (patientId) {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, clinician_id, case_id, full_name, date_of_birth, gender, language, dominant_hand, education_years')
      .eq('id', patientId)
      .eq('clinician_id', user.id)
      .maybeSingle();

    if (patientError || !patient) {
      return json({ error: 'Patient not found for this clinician' }, 404);
    }

    patientRecordId = patient.id;
    caseId = caseId || patient.case_id || patient.full_name;
    resolvedEducationYears = resolvedEducationYears ?? patient.education_years;
    assessmentLanguage = requestedLanguage || patient.language || 'he';
    patientDateOfBirth = patient.date_of_birth ?? null;
    patientGender = patient.gender ?? null;
    patientDominantHand = patient.dominant_hand ?? null;
    if (patient.date_of_birth) {
      try {
        patientAgeYears = calculateAgeYears(patient.date_of_birth);
        resolvedAgeBand = ageBandFromAge(patientAgeYears);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid patient date_of_birth' }, 400);
      }
    }
    if (!caseId) {
      caseId = generateCaseId();
    }
  }

  if (!caseId) {
    return json({ error: 'Missing required field: caseId or patientId' }, 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$/.test(caseId)) {
    return json({ error: 'caseId must be a pseudonymous code using letters, numbers, dot, dash, or underscore' }, 400);
  }
  if (!resolvedAgeBand) {
    return json({ error: 'Missing required field: ageBand or patient date_of_birth' }, 400);
  }
  if (!resolvedEducationYears && resolvedEducationYears !== 0) {
    resolvedEducationYears = 12;
  }
  if (!Number.isInteger(resolvedEducationYears) || resolvedEducationYears < 0 || resolvedEducationYears > 40) {
    return json({ error: 'educationYears must be between 0 and 40' }, 400);
  }
  if (!SUPPORTED_LANGUAGES.has(assessmentLanguage)) {
    return json({ error: `Unsupported language: ${assessmentLanguage}` }, 400);
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
      age_band: resolvedAgeBand,
      status: 'pending',
      education_years: resolvedEducationYears,
      patient_id: patientRecordId,
      access_code: accessCode,
      assessment_type: assessmentType,
      moca_version: resolvedMocaVersion,
      patient_age_years: patientAgeYears,
      patient_date_of_birth: patientDateOfBirth,
      patient_gender: patientGender,
      assessment_language: assessmentLanguage,
      patient_dominant_hand: patientDominantHand,
    })
    .select('id, access_code, moca_version')
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
    metadata: { assessmentType, language: assessmentLanguage, mocaVersion: session.moca_version, testNumberGenerated: true },
  });

  return json({
    sessionId: session.id,
    caseId,
    sessionUrl,
    accessCode: session.access_code ?? accessCode,
    testNumber: session.access_code ?? accessCode,
    assessmentType,
    language: assessmentLanguage,
    mocaVersion: session.moca_version,
    patientId: patientRecordId,
  });
});

function calculateAgeYears(dateOfBirth: string): number {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) throw new Error('Invalid patient date_of_birth');
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  if (age < 60) throw new Error('MoCA Hebrew norms require patient age 60 or older');
  if (age > 130) throw new Error('Invalid patient age');
  return age;
}

function ageBandFromAge(age: number): string {
  if (age >= 80) return '80+';
  if (age >= 75) return '75-79';
  if (age >= 70) return '70-74';
  if (age >= 65) return '65-69';
  if (age >= 60) return '60-64';
  throw new Error('MoCA Hebrew norms require patient age 60 or older');
}

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
