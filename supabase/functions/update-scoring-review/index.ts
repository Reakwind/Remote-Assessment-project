import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { writeAuditEvent } from '../_shared/audit.ts';
import { recalculateReviewedReport } from '../_shared/reviews.ts';
import { handleUpdateScoringReview } from './handler.ts';

Deno.serve((req) => handleUpdateScoringReview(req, {
  createSupabaseClient: () => createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  ),
  recalculateReviewedReport,
  writeAuditEvent,
}));
