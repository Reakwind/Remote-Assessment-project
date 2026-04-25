import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { corsResponse, json, methodNotAllowed } from '../_shared/http.ts';
import { buildStimulusManifest } from '../_shared/stimulus-manifest.ts';

interface GetStimuliBody {
  sessionId: string;
  linkToken: string;
}

interface SignedStimulusAsset {
  taskType: string;
  assetId: string;
  label: string;
  kind: string;
  contentType: string;
  required: boolean;
  storagePath: string;
  available: boolean;
  signedUrl: string | null;
  missingReason: string | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 15;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);

  let body: GetStimuliBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, req);
  }

  const { sessionId, linkToken } = body;
  if (!sessionId || !linkToken) return json({ error: 'Missing sessionId or linkToken' }, 400, req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, status, moca_version')
    .eq('id', sessionId)
    .eq('link_token', linkToken)
    .single();

  if (error || !session) return json({ error: 'Session not found' }, 404, req);
  if (session.status !== 'in_progress') return json({ error: 'Session not in progress' }, 409, req);

  let manifest;
  try {
    manifest = buildStimulusManifest(session.moca_version);
  } catch (manifestError) {
    return json({ error: manifestError instanceof Error ? manifestError.message : 'Unsupported MoCA version' }, 400, req);
  }

  const assets = await Promise.all(
    manifest.map(async (entry): Promise<SignedStimulusAsset> => {
      const exists = await stimulusExists(supabase, entry.storagePath);
      if (!exists) {
        return {
          ...entry,
          available: false,
          signedUrl: null,
          missingReason: 'missing_private_asset',
        };
      }

      const { data, error: signedUrlError } = await supabase.storage
        .from('stimuli')
        .createSignedUrl(entry.storagePath, SIGNED_URL_TTL_SECONDS);

      return {
        ...entry,
        available: Boolean(data?.signedUrl && !signedUrlError),
        signedUrl: data?.signedUrl ?? null,
        missingReason: signedUrlError ? 'signed_url_failed' : null,
      };
    }),
  );

  const missingRequiredCount = assets.filter((asset) => asset.required && !asset.available).length;

  try {
    await writeAuditEvent(supabase, {
      eventType: 'stimuli_manifest_requested',
      sessionId,
      actorType: 'patient',
      metadata: {
        mocaVersion: session.moca_version,
        totalAssets: assets.length,
        missingRequiredCount,
      },
    });
  } catch (auditError) {
    console.error('Stimuli manifest audit failed:', auditError);
  }

  return json({
    sessionId,
    mocaVersion: session.moca_version,
    bucket: 'stimuli',
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    clinicalReady: missingRequiredCount === 0,
    missingRequiredCount,
    assets,
  }, 200, req);
});

async function stimulusExists(supabase: any, storagePath: string): Promise<boolean> {
  const lastSlash = storagePath.lastIndexOf('/');
  const directory = storagePath.slice(0, lastSlash);
  const fileName = storagePath.slice(lastSlash + 1);

  const { data, error } = await supabase.storage
    .from('stimuli')
    .list(directory, { limit: 1, search: fileName });

  if (error) {
    console.error('Stimulus lookup failed:', { storagePath, error });
    return false;
  }

  return (data ?? []).some((file: { name?: string }) => file.name === fileName);
}
