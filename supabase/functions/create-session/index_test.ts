import { handleCreateSession } from './handler.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function postRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request('https://example.test/functions/v1/create-session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

const clinician = {
  id: 'clinician-1',
  email: 'clinician@example.test',
  user_metadata: {
    full_name: 'Clinician One',
    clinic_name: 'Remote Check Clinic',
  },
};

const completePatient = {
  id: 'patient-1',
  clinician_id: 'clinician-1',
  case_id: 'CASE-1',
  full_name: 'CASE-1',
  phone: '0501234567',
  date_of_birth: '1951-04-30',
  gender: 'female',
  language: 'he',
  dominant_hand: 'right',
  education_years: 14,
};

function createSupabaseStub(patient = completePatient) {
  const clinicianUpserts: unknown[] = [];
  const sessionInserts: Array<Record<string, unknown>> = [];

  const supabase = {
    auth: {
      getUser: async (token: string) => ({
        data: { user: token === 'clinician-token' ? clinician : null },
        error: token === 'clinician-token' ? null : new Error('unauthorized'),
      }),
    },
    from: (table: string) => {
      if (table === 'clinicians') {
        return {
          upsert: async (payload: unknown) => {
            clinicianUpserts.push(payload);
            return { data: null, error: null };
          },
        };
      }

      if (table === 'patients') {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: patient, error: null }),
        };
        return query;
      }

      if (table === 'sessions') {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          maybeSingle: async () => ({ data: null, error: null }),
          insert: (payload: Record<string, unknown>) => {
            sessionInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'session-1',
                    access_code: payload.access_code,
                    moca_version: payload.moca_version,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, clinicianUpserts, sessionInserts };
}

Deno.test('handleCreateSession creates a pending session with patient scoring context', async () => {
  const { supabase, clinicianUpserts, sessionInserts } = createSupabaseStub();
  const auditEvents: Array<Record<string, unknown>> = [];

  const response = await handleCreateSession(
    postRequest(
      { patientId: 'patient-1', assessmentType: 'moca', language: 'he', mocaVersion: '8.3' },
      {
        Authorization: 'Bearer clinician-token',
        Origin: 'https://clinician.test',
      },
    ),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async (_supabase, input) => {
        auditEvents.push(input);
      },
      generateTestNumber: () => '87654321',
      now: () => new Date('2026-04-29T00:00:00.000Z'),
    },
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.sessionId, 'session-1');
  assertEquals(body.caseId, 'CASE-1');
  assertEquals(body.accessCode, '87654321');
  assertEquals(body.sessionUrl, 'https://clinician.test/#/session/87654321');
  assertEquals(body.patientId, 'patient-1');

  assertEquals(clinicianUpserts.length, 1);
  assertEquals(sessionInserts.length, 1);
  assertEquals(sessionInserts[0]?.case_id, 'CASE-1');
  assertEquals(sessionInserts[0]?.age_band, '70-74');
  assertEquals(sessionInserts[0]?.education_years, 14);
  assertEquals(sessionInserts[0]?.patient_age_years, 74);
  assertEquals(sessionInserts[0]?.patient_gender, 'female');
  assertEquals(sessionInserts[0]?.patient_dominant_hand, 'right');
  assertEquals(sessionInserts[0]?.assessment_language, 'he');
  assertEquals(auditEvents.length, 1);
  assertEquals(auditEvents[0]?.eventType, 'session_created');
  assertEquals((auditEvents[0]?.metadata as Record<string, unknown>).mocaVersion, '8.3');
});

Deno.test('handleCreateSession rejects incomplete patient profiles before creating sessions', async () => {
  const incompletePatient: any = {
    ...completePatient,
    phone: '',
    date_of_birth: null,
  };
  const { supabase, sessionInserts } = createSupabaseStub(incompletePatient);

  const response = await handleCreateSession(
    postRequest({ patientId: 'patient-1' }, { Authorization: 'Bearer clinician-token' }),
    {
      createSupabaseClient: () => supabase,
      writeAuditEvent: async () => undefined,
      generateTestNumber: () => '87654321',
      now: () => new Date('2026-04-29T00:00:00.000Z'),
    },
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assert(String(body.error).includes('phone'), 'expected phone gap in error');
  assert(String(body.error).includes('date_of_birth'), 'expected date_of_birth gap in error');
  assertEquals(sessionInserts.length, 0);
});

Deno.test('handleCreateSession rejects unsupported request values before auth work', async () => {
  let createClientCalls = 0;

  const response = await handleCreateSession(
    postRequest({ patientId: 'patient-1', language: 'en' }),
    {
      createSupabaseClient: () => {
        createClientCalls += 1;
        return {};
      },
      writeAuditEvent: async () => undefined,
    },
  );

  assertEquals(response.status, 400);
  assertEquals(await response.text(), JSON.stringify({ error: 'Unsupported language: en' }));
  assertEquals(createClientCalls, 0);
});
