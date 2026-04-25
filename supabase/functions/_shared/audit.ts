type SupabaseClient = any;

type AuditActorType = 'clinician' | 'patient' | 'system';

export async function writeAuditEvent(
  supabase: SupabaseClient,
  event: {
    eventType: string;
    sessionId?: string | null;
    actorType: AuditActorType;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from('audit_events')
    .insert({
      event_type: event.eventType,
      session_id: event.sessionId ?? null,
      actor_type: event.actorType,
      actor_user_id: event.actorUserId ?? null,
      metadata: event.metadata ?? {},
    });

  if (error) {
    console.error('Audit event write failed:', error);
    throw new Error('Failed to write audit event');
  }
}
