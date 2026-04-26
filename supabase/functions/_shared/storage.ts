export function browserReachableSignedUrl(signedUrl: string | null | undefined, req: Request): string | null {
  if (!signedUrl) return null;

  try {
    const url = new URL(signedUrl);
    const publicOrigin = browserReachableSupabaseOrigin(req);
    return `${publicOrigin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return signedUrl;
  }
}

export function sessionScopedObjectPath(storagePath: string | null | undefined, sessionId: string): string | null {
  if (!storagePath || !sessionId) return null;
  const parts = storagePath.split('/');
  if (parts.length !== 2) return null;
  const [pathSessionId, fileName] = parts;
  if (pathSessionId !== sessionId) return null;
  if (!fileName || fileName === '.' || fileName === '..' || fileName.includes('..')) return null;
  return storagePath;
}

function browserReachableSupabaseOrigin(req: Request): string {
  const explicitOrigin = normalizeOrigin(readOptionalEnv('SUPABASE_PUBLIC_URL') ?? readOptionalEnv('PUBLIC_SUPABASE_URL'));
  if (explicitOrigin) return explicitOrigin;

  const forwardedOrigin = forwardedRequestOrigin(req);
  if (forwardedOrigin) return forwardedOrigin;

  const requestUrl = new URL(req.url);
  if (isLocalSupabaseInternalHost(requestUrl.hostname)) return 'http://127.0.0.1:54321';

  return requestUrl.origin;
}

function readOptionalEnv(name: string): string | null {
  try {
    return Deno.env.get(name) ?? null;
  } catch {
    return null;
  }
}

function forwardedRequestOrigin(req: Request): string | null {
  const forwarded = req.headers.get('forwarded');
  if (forwarded) {
    const first = forwarded.split(',')[0] ?? '';
    const host = first.match(/host="?([^;"]+)/i)?.[1];
    const proto = first.match(/proto="?([^;"]+)/i)?.[1];
    if (host) return `${proto || new URL(req.url).protocol.replace(':', '')}://${normalizeLocalSupabaseHost(host)}`;
  }

  const host = req.headers.get('x-forwarded-host');
  if (!host || isLocalSupabaseInternalHost(host.split(':')[0])) return null;
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  return `${proto}://${normalizeLocalSupabaseHost(host)}`;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalSupabaseInternalHost(hostname: string): boolean {
  return hostname === 'kong' || hostname.startsWith('supabase_edge_runtime');
}

function normalizeLocalSupabaseHost(host: string): string {
  if ((host === '127.0.0.1' || host === 'localhost') && !host.includes(':')) return `${host}:54321`;
  return host;
}
