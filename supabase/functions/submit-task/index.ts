import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { sessionId: string; linkToken: string; taskType: string; rawData: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { sessionId, taskType, rawData } = body;
  if (!sessionId || !taskType || rawData === undefined) {
    return json({ error: 'Missing required fields: sessionId, taskType, rawData' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Validate session is in_progress
  const { linkToken } = body;
  if (!linkToken) return json({ error: 'Unauthorized: missing token' }, 401);

  // Validate session auth
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, link_token')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) return json({ error: 'Session not found' }, 404);
  if (session.link_token !== linkToken) return json({ error: 'Unauthorized: invalid token' }, 401);

  if (session.status !== 'in_progress') {
    // If it's pending, mark it as in_progress
    if (session.status === 'pending') {
       await supabase.rpc('mark_session_started', { p_session_id: sessionId });
    } else {
       return json({ error: 'Session not in progress' }, 409);
    }
  }

  // Remove the 'moca-' prefix if it exists, as the new schema just uses 'cube', 'clock', etc.
  const taskName = taskType.replace(/^moca-/, '');

  // Upsert — idempotent on (session_id, task_name)
  // Safe to call multiple times on connection loss
  const { error: upsertError } = await supabase
    .from('task_results')
    .upsert(
      { session_id: sessionId, task_name: taskName, raw_data: rawData },
      { onConflict: 'session_id,task_name' }
    );

  if (upsertError) {
    console.error('Upsert Error:', upsertError);
    return json({ error: 'Failed to save result' }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
