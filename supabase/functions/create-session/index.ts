import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { handleCreateSession } from './handler.ts';

Deno.serve((req) => handleCreateSession(req, {
  createSupabaseClient: () => createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  ),
  writeAuditEvent,
  getPublicUrl: () => Deno.env.get('PUBLIC_URL') ?? undefined,
}));
