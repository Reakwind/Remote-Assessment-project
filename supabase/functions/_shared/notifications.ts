type SupabaseClient = any;

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
