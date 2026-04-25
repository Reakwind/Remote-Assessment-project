import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { decode } from 'https://deno.land/std@0.198.0/encoding/base64.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import { audioExtension, isAudioTask, normalizeAudioContentType } from '../_shared/tasks.ts';

const MAX_AUDIO_BASE64_LENGTH = 20_000_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: {
    sessionId: string;
    linkToken: string;
    taskType: string;
    audioBase64: string;
    contentType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const { sessionId, linkToken, taskType, audioBase64 } = body;
  if (!sessionId || !linkToken || !taskType || !audioBase64) {
    return json({ error: 'Missing required fields: sessionId, linkToken, taskType, audioBase64' }, 400, req);
  }
  if (!isAudioTask(taskType)) {
    return json({ error: 'Invalid audio taskType' }, 400, req);
  }
  const contentType = normalizeAudioContentType(body.contentType);
  if (!contentType) {
    return json({ error: 'Unsupported audio contentType' }, 400, req);
  }
  if (!audioBase64.startsWith(`data:${contentType};base64,`)) {
    return json({ error: 'audioBase64 must be a matching audio data URL' }, 400, req);
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: 'Audio recording is too large' }, 413, req);
  }

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

  const extension = audioExtension(contentType);
  const base64Data = audioBase64.replace(`data:${contentType};base64,`, '');
  let audioBytes: Uint8Array;
  try {
    audioBytes = decode(base64Data);
  } catch (error) {
    console.error('Audio decode failed:', error);
    return json({ error: 'Failed to process audioBase64' }, 400, req);
  }
  if (audioBytes.length === 0) return json({ error: 'Audio recording is empty' }, 400, req);

  const storagePath = `${sessionId}/${taskType}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('audio')
    .upload(storagePath, audioBytes, { contentType, upsert: true });

  if (uploadError) {
    console.error('Audio upload failed:', uploadError);
    return json({ error: 'Failed to upload audio' }, 500, req);
  }

  try {
    await writeAuditEvent(supabase, {
      eventType: 'audio_saved',
      sessionId,
      actorType: 'patient',
      metadata: { taskType, storagePath, contentType, byteLength: audioBytes.length },
    });

    return json({ ok: true, storagePath, contentType }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to write audit event' }, 500, req);
  }
});
