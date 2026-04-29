import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.104.0';
import { handleExportPdf } from './handler.ts';

Deno.serve((req) => handleExportPdf(req, {
  createSupabaseClient: () => createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  ),
}));
