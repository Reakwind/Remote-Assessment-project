type SupabaseClient = any;

export const START_RATE_LIMIT_WINDOW_MINUTES = 15;
export const START_RATE_LIMIT_MAX_IP_FAILURES = 60;
export const START_RATE_LIMIT_MAX_CODE_FAILURES = 8;

export interface StartAttemptFingerprint {
  ipHash: string;
  accessCodeHash: string;
  source: string;
}

export interface StartAttemptRow {
  ip_hash: string;
  access_code_hash: string | null;
}

export interface StartRateLimitDecision {
  allowed: boolean;
  reason?: 'ip_rate_limited' | 'code_rate_limited';
  retryAfterSeconds?: number;
  ipFailures: number;
  codeFailures: number;
}

interface StartRateLimitOptions {
  windowMinutes?: number;
  maxIpFailures?: number;
  maxCodeFailures?: number;
}

export function clientIpFromRequest(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown'
  );
}

export async function buildStartAttemptFingerprint(
  req: Request,
  accessCode: string,
  env: (name: string) => string | undefined = Deno.env.get,
): Promise<StartAttemptFingerprint> {
  const source = clientIpFromRequest(req);
  const secret =
    env('START_SESSION_RATE_LIMIT_SECRET') ||
    env('SUPABASE_SERVICE_ROLE_KEY') ||
    'local-dev-start-rate-limit-secret';

  return {
    source,
    ipHash: await hmacSha256(secret, `ip:${source}`),
    accessCodeHash: await hmacSha256(secret, `access-code:${accessCode}`),
  };
}

export function evaluateStartRateLimit(
  rows: StartAttemptRow[],
  fingerprint: StartAttemptFingerprint,
  options: StartRateLimitOptions = {},
): StartRateLimitDecision {
  const maxIpFailures = options.maxIpFailures ?? START_RATE_LIMIT_MAX_IP_FAILURES;
  const maxCodeFailures = options.maxCodeFailures ?? START_RATE_LIMIT_MAX_CODE_FAILURES;
  const ipFailures = rows.filter((row) => row.ip_hash === fingerprint.ipHash).length;
  const codeFailures = rows.filter((row) => row.access_code_hash === fingerprint.accessCodeHash).length;

  if (ipFailures >= maxIpFailures) {
    return {
      allowed: false,
      reason: 'ip_rate_limited',
      retryAfterSeconds: (options.windowMinutes ?? START_RATE_LIMIT_WINDOW_MINUTES) * 60,
      ipFailures,
      codeFailures,
    };
  }

  if (codeFailures >= maxCodeFailures) {
    return {
      allowed: false,
      reason: 'code_rate_limited',
      retryAfterSeconds: (options.windowMinutes ?? START_RATE_LIMIT_WINDOW_MINUTES) * 60,
      ipFailures,
      codeFailures,
    };
  }

  return { allowed: true, ipFailures, codeFailures };
}

export async function checkStartRateLimit(
  supabase: SupabaseClient,
  fingerprint: StartAttemptFingerprint,
  options: StartRateLimitOptions = {},
): Promise<StartRateLimitDecision> {
  const windowMinutes = options.windowMinutes ?? START_RATE_LIMIT_WINDOW_MINUTES;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('patient_start_attempts')
    .select('ip_hash, access_code_hash')
    .eq('success', false)
    .gte('created_at', windowStart)
    .or(`ip_hash.eq.${fingerprint.ipHash},access_code_hash.eq.${fingerprint.accessCodeHash}`);

  if (error) {
    console.error('Patient start rate-limit lookup failed:', error);
    return { allowed: true, ipFailures: 0, codeFailures: 0 };
  }

  return evaluateStartRateLimit(data ?? [], fingerprint, { ...options, windowMinutes });
}

export async function recordStartAttempt(
  supabase: SupabaseClient,
  input: {
    fingerprint: StartAttemptFingerprint;
    success: boolean;
    failureReason?: string;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase
    .from('patient_start_attempts')
    .insert({
      ip_hash: input.fingerprint.ipHash,
      access_code_hash: input.fingerprint.accessCodeHash,
      success: input.success,
      failure_reason: input.success ? null : input.failureReason ?? 'unknown',
      session_id: input.sessionId ?? null,
      metadata: {
        source: input.fingerprint.source === 'unknown' ? 'unknown' : 'hashed',
        ...input.metadata,
      },
    });

  if (error) {
    console.error('Patient start attempt audit failed:', error);
  }
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
