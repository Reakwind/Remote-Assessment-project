import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { corsResponse, json, methodNotAllowed, requireClinician } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { user, response } = await requireClinician(req, supabase);
  if (response) return response;

  let sessionId = new URL(req.url).searchParams.get('sessionId');
  if (!sessionId && req.method === 'POST') {
    try {
      const body = await req.json();
      sessionId = body.sessionId;
    } catch {
      return json({ error: 'Invalid JSON' }, 400, req);
    }
  }
  if (!sessionId) return json({ error: 'Missing sessionId' }, 400, req);

  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      id,
      case_id,
      patient_id,
      age_band,
      education_years,
      patient_age_years,
      patient_date_of_birth,
      patient_gender,
      patient_dominant_hand,
      assessment_language,
      assessment_type,
      access_code,
      status,
      created_at,
      started_at,
      completed_at,
      moca_version,
      patients ( id, case_id, full_name, phone, date_of_birth, gender, language, dominant_hand, education_years ),
      task_results (*),
      scoring_reports (*),
      drawing_reviews (*),
      scoring_item_reviews (*)
    `)
    .eq('id', sessionId)
    .eq('clinician_id', user.id)
    .single();

  if (error || !session) return json({ error: 'Session not found' }, 404, req);

  const drawings = await Promise.all((session.drawing_reviews ?? []).map(async (review: any) => {
    if (!review.storage_path) return { ...review, signedUrl: null };
    const { data } = await supabase.storage
      .from('drawings')
      .createSignedUrl(review.storage_path, 60 * 15);
    return { ...review, signedUrl: data?.signedUrl ?? null };
  }));

  const taskResults = await Promise.all((session.task_results ?? []).map(async (result: any) => {
    const rawData = addAudioSignedUrl(result.raw_data, await signedAudioUrl(supabase, audioStoragePathFromRaw(result.raw_data)));
    return { ...result, raw_data: rawData };
  }));

  const scoringReviews = await Promise.all((session.scoring_item_reviews ?? []).map(async (review: any) => {
    const rawData = addAudioSignedUrl(review.raw_data, await signedAudioUrl(supabase, audioStoragePathFromRaw(review.raw_data)));
    return { ...review, raw_data: rawData };
  }));

  return json({
    session: {
      ...session,
      task_results: taskResults,
      scoring_report: Array.isArray(session.scoring_reports) ? session.scoring_reports[0] ?? null : session.scoring_reports,
      drawings,
      scoring_reviews: scoringReviews,
    },
  }, 200, req);
});

async function signedAudioUrl(supabase: any, storagePath?: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const { data } = await supabase.storage
    .from('audio')
    .createSignedUrl(storagePath, 60 * 15);
  return data?.signedUrl ?? null;
}

function addAudioSignedUrl(rawData: any, signedUrl: string | null): any {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return rawData;
  return { ...rawData, audioSignedUrl: signedUrl };
}

function audioStoragePathFromRaw(rawData: any): string | null {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null;
  if (typeof rawData.audioStoragePath === 'string') return rawData.audioStoragePath;
  if (typeof rawData.audioId === 'string' && rawData.audioId.includes('/')) return rawData.audioId;
  return null;
}
