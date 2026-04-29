import { decode } from 'https://deno.land/std@0.198.0/encoding/base64.ts';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import { DRAWING_TASKS } from '../_shared/tasks.ts';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const TASK_ID_TO_TASK_NAME: Record<string, string> = {
  'moca-visuospatial': 'trailMaking',
  'moca-cube': 'cube',
  'moca-clock': 'clock',
};

type SupabaseClient = any;

export interface SaveDrawingDeps {
  createSupabaseClient: () => SupabaseClient;
  writeAuditEvent: typeof writeAuditEvent;
}

export async function handleSaveDrawing(req: Request, deps: SaveDrawingDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: { sessionId: string; linkToken: string; taskId: string; strokesData?: unknown[]; imageBase64?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const { sessionId, linkToken, taskId, strokesData, imageBase64 } = body;
  if (!sessionId || !linkToken || !taskId) return json({ error: 'Missing required fields: sessionId, linkToken, taskId' }, 400, req);
  if (!DRAWING_TASKS.has(taskId)) return json({ error: 'Invalid drawing taskId' }, 400, req);
  if (strokesData !== undefined && !Array.isArray(strokesData)) return json({ error: 'strokesData must be an array' }, 400, req);
  if (imageBase64 && !imageBase64.startsWith('data:image/png;base64,')) {
    return json({ error: 'imageBase64 must be a PNG data URL' }, 400, req);
  }
  if (imageBase64 && imageBase64.length > 7_000_000) {
    return json({ error: 'Drawing image is too large' }, 413, req);
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

  let storagePath: string | null = null;
  if (imageBase64) {
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = decode(base64Data);
      if (!hasPngSignature(imageBytes)) return json({ error: 'imageBase64 is not a valid PNG' }, 400, req);
      storagePath = `${sessionId}/${taskId}.png`;
      const { error: uploadError } = await supabase.storage
        .from('drawings')
        .upload(storagePath, imageBytes, { contentType: 'image/png', upsert: true });

      if (uploadError) {
        console.error('Drawing upload failed:', uploadError);
        return json({ error: 'Failed to upload image' }, 500, req);
      }
    } catch (error) {
      console.error('Drawing decode failed:', error);
      return json({ error: error instanceof Error ? error.message : 'Failed to process imageBase64' }, 400, req);
    }
  }

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    task_name: TASK_ID_TO_TASK_NAME[taskId],
    task_id: taskId,
    strokes_data: strokesData ?? [],
  };
  if (storagePath) payload.storage_path = storagePath;

  const { error: upsertError } = await supabase
    .from('drawing_reviews')
    .upsert(payload, { onConflict: 'session_id,task_id' });

  if (upsertError) {
    console.error('Drawing review upsert failed:', upsertError);
    return json({ error: 'Failed to save drawing review' }, 500, req);
  }

  try {
    await deps.writeAuditEvent(supabase, {
      eventType: 'drawing_saved',
      sessionId,
      actorType: 'patient',
      metadata: { taskId, storagePath, strokeCount: strokesData?.length ?? 0 },
    });
  } catch (auditError) {
    return json({ error: auditError instanceof Error ? auditError.message : 'Failed to write audit event' }, 500, req);
  }

  return json({ ok: true, storagePath }, 200, req);
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}
