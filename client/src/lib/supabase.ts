import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);

export const edgeFn = (name: string) =>
  `${supabaseUrl}/functions/v1/${name}`;

export const edgeHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: supabaseAnon,
  Authorization: `Bearer ${supabaseAnon}`,
});
