import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { notifyClinicianSessionCompleted, recordNotificationOutcome } from '../_shared/notifications.ts';
import { scoreSession } from '../_shared/scoring.ts';
import { handleCompleteSession } from './handler.ts';

Deno.serve((req) => handleCompleteSession(req, {
  createSupabaseClient: () => createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  ),
  writeAuditEvent,
  notifyClinicianSessionCompleted,
  recordNotificationOutcome,
  scoreSession,
}));
