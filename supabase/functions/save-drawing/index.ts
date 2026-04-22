import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
import { decode } from 'https://deno.land/std@0.198.0/encoding/base64.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { sessionId: string; linkToken: string; taskId: string; strokesData?: any[]; imageBase64?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { sessionId, linkToken, taskId, strokesData, imageBase64 } = body;

  
  if (!linkToken) return json({ error: 'Unauthorized: missing token' }, 401);

  // Validate session auth
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, link_token')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) return json({ error: 'Session not found' }, 404);
  if (session.link_token !== linkToken) return json({ error: 'Unauthorized: invalid token' }, 401);

  
  if (!sessionId || !taskId) {
    return json({ error: 'Missing required fields: sessionId, taskId' }, 400);
  }

  const taskName = taskId.replace(/^moca-/, '');

  if (!['cube', 'clock', 'trailMaking'].includes(taskName)) {
    return json({ error: 'Invalid drawing task name' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let storagePath: string | null = null;
  let publicUrl: string | null = null;

  if (imageBase64) {
    try {
      // imageBase64 might come with a prefix like "data:image/png;base64,"
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = decode(base64Data);
      
      const fileName = `${sessionId}/${taskName}.png`;

      const { error: uploadError } = await supabase.storage
        .from('drawings')
        .upload(fileName, imageBytes, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return json({ error: 'Failed to upload image' }, 500);
      }

      storagePath = fileName;
      
      const { data } = supabase.storage.from('drawings').getPublicUrl(fileName);
      publicUrl = data.publicUrl;
      
    } catch (e) {
      console.error('Image decode error:', e);
      return json({ error: 'Failed to process imageBase64' }, 400);
    }
  }

  const { error: upsertError } = await supabase
    .from('drawing_reviews')
    .upsert(
      { 
        session_id: sessionId, 
        task_name: taskName, 
        storage_path: storagePath || undefined,
        strokes_data: strokesData || [] // Keep empty array if omitted to satisfy NOT NULL constraint
      },
      { onConflict: 'session_id,task_name' }
    );

  if (upsertError) {
    console.error('Drawing Upsert Error:', upsertError);
    return json({ error: 'Failed to save drawing review' }, 500);
  }
  
  // Set needs_review = true in scoring_reports if we are saving a drawing
  await supabase
    .from('scoring_reports')
    .update({ needs_review: true })
    .eq('session_id', sessionId);

  return json({ ok: true, url: publicUrl });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
