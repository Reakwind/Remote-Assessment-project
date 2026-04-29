import { decode } from 'https://deno.land/std@0.198.0/encoding/base64.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import { audioExtension, isAudioTask, parseAudioDataUrl } from '../_shared/tasks.ts';

const MAX_AUDIO_BASE64_LENGTH = 20_000_000;

type SupabaseClient = any;

export interface SaveAudioDeps {
  createSupabaseClient: () => SupabaseClient;
  writeAuditEvent: typeof writeAuditEvent;
}

export async function handleSaveAudio(req: Request, deps: SaveAudioDeps): Promise<Response> {
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
  const audioData = parseAudioDataUrl(audioBase64, body.contentType);
  if (!audioData) {
    return json({ error: 'audioBase64 must be a supported audio data URL' }, 400, req);
  }
  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: 'Audio recording is too large' }, 413, req);
  }

  const supabase = deps.createSupabaseClient();

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('link_token', linkToken)
    .single();
  if (sessionError || !session) return json({ error: 'Session not found' }, 404, req);
  if (session.status !== 'in_progress') return json({ error: 'Session not in progress' }, 409, req);

  const extension = audioExtension(audioData.contentType);
  let audioBytes: Uint8Array;
  try {
    audioBytes = decode(audioData.base64Data);
  } catch (error) {
    console.error('Audio decode failed:', error);
    return json({ error: 'Failed to process audioBase64' }, 400, req);
  }
  if (audioBytes.length === 0) return json({ error: 'Audio recording is empty' }, 400, req);

  const storagePath = `${sessionId}/${taskType}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('audio')
    .upload(storagePath, audioBytes, { contentType: audioData.contentType, upsert: true });

  if (uploadError) {
    console.error('Audio upload failed:', uploadError);
    return json({ error: 'Failed to upload audio' }, 500, req);
  }

  try {
    await deps.writeAuditEvent(supabase, {
      eventType: 'audio_saved',
      sessionId,
      actorType: 'patient',
      metadata: { taskType, storagePath, contentType: audioData.contentType, byteLength: audioBytes.length },
    });

    return json({
      ok: true,
      storagePath,
      audioStoragePath: storagePath,
      contentType: audioData.contentType,
      audioContentType: audioData.contentType,
    }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to write audit event' }, 500, req);
  }
}
