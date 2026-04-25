type SupabaseClient = any;
const DEFAULT_SMS_GATEWAY = 'https://api.twilio.com/2010-04-01/Accounts';

export interface SmsPayload {
  to: string;
  message: string;
}

export interface ClinicianCompletionNotificationResult {
  channel: 'email';
  provider: 'resend';
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
  recipientEmail?: string;
  providerMessageId?: string;
}

interface CompletedSession {
  id: string;
  clinician_id: string;
  status: string;
}

interface NotificationDependencies {
  env?: (name: string) => string | undefined;
  fetch?: typeof fetch;
}

interface NotificationOutcome {
  sessionId: string;
  notificationType: 'clinician_completion_email';
  result: ClinicianCompletionNotificationResult;
}

export async function sendSms(payload: SmsPayload): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  const gateway = Deno.env.get('TWILIO_API_BASE') || DEFAULT_SMS_GATEWAY;

  if (!sid || !token || !from) {
    return { ok: false, error: 'Missing TWILIO credentials' };
  }

  const body = new URLSearchParams({
    To: payload.to,
    From: from,
    Body: payload.message,
  });

  try {
    const response = await fetch(`${gateway}/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Twilio error: ${text}` };
    }

    const data = (await response.json()) as { sid?: string };
    return { ok: true, providerMessageId: data.sid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown SMS error' };
  }
}

function readEnv(deps: NotificationDependencies, name: string): string | undefined {
  return deps.env ? deps.env(name) : Deno.env.get(name);
}

function dashboardUrl(sessionId: string, deps: NotificationDependencies): string | undefined {
  const publicUrl = readEnv(deps, 'PUBLIC_URL')?.trim();
  if (!publicUrl) return undefined;
  return `${publicUrl.replace(/\/$/, '')}/dashboard/${sessionId}`;
}

export async function notifyClinicianSessionCompleted(
  supabase: SupabaseClient,
  session: CompletedSession,
  deps: NotificationDependencies = {},
): Promise<ClinicianCompletionNotificationResult> {
  const apiKey = readEnv(deps, 'RESEND_API_KEY')?.trim();
  if (!apiKey) {
    return {
      channel: 'email',
      provider: 'resend',
      status: 'skipped',
      reason: 'RESEND_API_KEY not configured',
    };
  }

  const { data, error } = await supabase.auth.admin.getUserById(session.clinician_id);
  const recipientEmail = data?.user?.email;
  if (error || !recipientEmail) {
    return {
      channel: 'email',
      provider: 'resend',
      status: 'skipped',
      reason: 'clinician email unavailable',
    };
  }

  const reviewUrl = dashboardUrl(session.id, deps);
  const text = [
    'A completed assessment is ready for clinician review.',
    `Session: ${session.id}`,
    `Status: ${session.status}`,
    reviewUrl ? `Review: ${reviewUrl}` : undefined,
  ].filter(Boolean).join('\n');

  let response: Response;
  try {
    const apiBase = readEnv(deps, 'RESEND_API_BASE')?.trim() || 'https://api.resend.com';
    response = await (deps.fetch ?? fetch)(`${apiBase.replace(/\/$/, '')}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: readEnv(deps, 'RESEND_FROM_EMAIL') ?? 'Remote Check <notifications@example.com>',
        to: recipientEmail,
        subject: 'Assessment ready for review',
        text,
      }),
    });
  } catch (error) {
    return {
      channel: 'email',
      provider: 'resend',
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown Resend error',
      recipientEmail,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      channel: 'email',
      provider: 'resend',
      status: 'failed',
      reason: `Resend returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      recipientEmail,
    };
  }

  const responseData = await response.json().catch(() => ({})) as { id?: string };

  return {
    channel: 'email',
    provider: 'resend',
    status: 'sent',
    recipientEmail,
    providerMessageId: responseData.id,
  };
}

export async function recordNotificationOutcome(
  supabase: SupabaseClient,
  outcome: NotificationOutcome,
): Promise<void> {
  const retryAt = outcome.result.status === 'failed'
    ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from('notification_events')
    .upsert({
      session_id: outcome.sessionId,
      notification_type: outcome.notificationType,
      channel: outcome.result.channel,
      provider: outcome.result.provider,
      status: outcome.result.status,
      recipient: outcome.result.recipientEmail ?? null,
      provider_message_id: outcome.result.providerMessageId ?? null,
      attempts: 1,
      error_message: outcome.result.reason ?? null,
      next_retry_at: retryAt,
      metadata: outcome.result,
    }, { onConflict: 'session_id,notification_type,channel' });

  if (error) {
    console.error('Notification event write failed:', error);
    throw new Error('Failed to write notification event');
  }
}
