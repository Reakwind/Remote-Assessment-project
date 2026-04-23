import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from 'https://deno.land/std@0.198.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let body: { sessionId: string; linkToken: string; taskId: string; audioBase64: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const { sessionId, linkToken, taskId, audioBase64 } = body;
  if (!sessionId || !linkToken || !taskId || !audioBase64) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: session } = await supabase.from('sessions').select('id, link_token').eq('id', sessionId).single();
  if (!session || session.link_token !== linkToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const taskName = taskId.replace(/^moca-/, '');
  const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
  const audioBytes = decode(base64Data);
  const fileName = `${sessionId}/${taskName}.webm`;

  const { error: uploadError } = await supabase.storage
    .from('audio')
    .upload(fileName, audioBytes, { contentType: 'audio/webm', upsert: true });

  if (uploadError) {
    console.error(uploadError);
    return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const { data } = supabase.storage.from('audio').getPublicUrl(fileName);
  return new Response(JSON.stringify({ ok: true, url: data.publicUrl }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
});
