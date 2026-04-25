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
}

interface CompletedSession {
  id: string;
  clinician_id: string;
  status: string;
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

function dashboardUrl(sessionId: string): string | undefined {
  const publicUrl = Deno.env.get('PUBLIC_URL')?.trim();
  if (!publicUrl) return undefined;
  return `${publicUrl.replace(/\/$/, '')}/dashboard/${sessionId}`;
}

export async function notifyClinicianSessionCompleted(
  supabase: SupabaseClient,
  session: CompletedSession,
): Promise<ClinicianCompletionNotificationResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
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

  const reviewUrl = dashboardUrl(session.id);
  const text = [
    'A completed assessment is ready for clinician review.',
    `Session: ${session.id}`,
    `Status: ${session.status}`,
    reviewUrl ? `Review: ${reviewUrl}` : undefined,
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'Remote Check <notifications@example.com>',
      to: recipientEmail,
      subject: 'Assessment ready for review',
      text,
    }),
  });

  if (!response.ok) {
    return {
      channel: 'email',
      provider: 'resend',
      status: 'failed',
      reason: `Resend returned ${response.status}`,
      recipientEmail,
    };
  }

  return {
    channel: 'email',
    provider: 'resend',
    status: 'sent',
    recipientEmail,
  };
}
