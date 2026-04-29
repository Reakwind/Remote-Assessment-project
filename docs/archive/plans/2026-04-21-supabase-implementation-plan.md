# Supabase Implementation Plan

**Date:** 2026-04-21

## Tasks

### Batch 1 — Migrations

**Task 1:** Write migration 001 — schema (tables + constraints)
- File: `supabase/migrations/20260421000001_schema.sql`
- Tables: clinicians, sessions, task_results, scoring_reports, drawing_reviews

**Task 2:** Write migration 002 — RLS policies
- File: `supabase/migrations/20260421000002_rls.sql`
- Enable RLS on all tables, create clinician-scoped policies

**Task 3:** Write migration 003 — storage bucket
- File: `supabase/migrations/20260421000003_storage.sql`
- Create assessment-drawings bucket (private)
- Storage RLS: clinician access via signed URLs only

---

### Batch 2 — Edge Functions

**Task 4:** Write `start-session` Edge Function
- Validate link_token, enforce single-use, return scoring context

**Task 5:** Write `submit-results` Edge Function
- Upsert task_results, validate session in_progress, idempotent

**Task 6:** Write `complete-session` Edge Function
- Insert scoring_report, insert drawing_reviews, set status, send email via Resend

---

### Batch 3 — Client Integration

**Task 7:** Write `supabase.ts` client config
- File: `client/src/lib/supabase.ts`
- Typed Supabase client from env vars

**Task 8:** Write `useSession.ts` hook
- Reads `?t=` token from URL on load
- Calls `start-session`, stores sessionId + scoring context
- Exposes session state to BatteryPlayer

**Task 9:** Wire `submit-results` into BatteryPlayer
- Call `submit-results` after each task completes (fire-and-forget + retry on fail)
- Call `save-drawing` after drawing tasks

**Task 10:** Wire `complete-session` into BatteryPlayer
- Call on `state.isFinished`
- Pass scoring report computed client-side

---

### Batch 4 — Supabase Setup Instructions (user runs)

**Task 11:** Write setup instructions for user
- `supabase init`, `supabase login`, `supabase link`, `supabase db push`, `supabase functions deploy`
- `.env` template with required vars
