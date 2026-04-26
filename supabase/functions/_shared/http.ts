const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') ?? '';
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  };
}

export function corsResponse(req: Request): Response {
  return new Response(null, { headers: corsHeaders(req) });
}

export const legacyCorsHeaders = {
  'Access-Control-Allow-Origin': DEFAULT_ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

export function json(body: unknown, status = 200, req?: Request, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...Object.fromEntries(new Headers(extraHeaders)), 'Content-Type': 'application/json' },
  });
}

export function methodNotAllowed(req?: Request): Response {
  return json({ error: 'Method not allowed' }, 405, req);
}

export async function requireClinician(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, response: json({ error: 'Missing Authorization header' }, 401, req) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, response: json({ error: 'Unauthorized clinician' }, 401, req) };
  }

  return { user: data.user, response: null };
}
