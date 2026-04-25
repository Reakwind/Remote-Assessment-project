import { corsResponse, methodNotAllowed } from '../_shared/http.ts';
import { handleSubmitResult } from '../_shared/submitResult.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req);
  if (req.method !== 'POST') return methodNotAllowed(req);
  return handleSubmitResult(req);
});
