import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { json } from './http.ts';
import { writeAuditEvent } from './audit.ts';
import { validateTaskPayload } from './tasks.ts';

export async function handleSubmitResult(req: Request): Promise<Response> {
  let body: { sessionId: string; linkToken: string; taskType: string; rawData: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const { sessionId, linkToken, taskType, rawData } = body;
  if (!sessionId || !linkToken || !taskType || rawData === undefined) {
    return json({ error: 'Missing required fields: sessionId, linkToken, taskType, rawData' }, 400, req);
  }

  const validationError = validateTaskPayload(taskType, rawData);
  if (validationError) return json({ error: validationError }, 400, req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('link_token', linkToken)
    .single();

  if (sessionError || !session) return json({ error: 'Session not found' }, 404, req);
  if (session.status !== 'in_progress') return json({ error: 'Session not in progress' }, 409, req);

  const { error: upsertError } = await supabase
    .from('task_results')
    .upsert(
      { session_id: sessionId, task_type: taskType, raw_data: rawData },
      { onConflict: 'session_id,task_type' },
    );

  if (upsertError) {
    console.error('Task upsert failed:', upsertError);
    return json({ error: 'Failed to save result' }, 500, req);
  }

  try {
    await writeAuditEvent(supabase, {
      eventType: 'task_result_submitted',
      sessionId,
      actorType: 'patient',
      metadata: { taskType },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to write audit event' }, 500, req);
  }

  return json({ ok: true }, 200, req);
}
