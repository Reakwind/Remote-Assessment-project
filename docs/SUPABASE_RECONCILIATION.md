# Supabase Reconciliation Runbook

This runbook is the source of truth for reconciling local Supabase state with the linked hosted Supabase project.

Use it before hosted deployments, remote E2E, migration pushes, Edge Function deploys, or storage/security policy changes.

## Current Linked Project

- Project name: `Remote Assessment`
- Project ref: `jdkaxdtrukfxzlzspuua`
- Region: Southeast Asia (Singapore)
- Local stack URL: `http://127.0.0.1:54321`

As of 2026-04-26, the Supabase CLI is authenticated and this repo is linked to the hosted project.

## Operating Rules

Read-only inspection is allowed when needed:

```bash
supabase status
supabase projects list
supabase migration list --local
supabase migration list --linked
supabase functions list
supabase secrets list
supabase db lint
```

Remote-changing operations require explicit user approval immediately before running:

```bash
supabase db push
supabase db reset
supabase migration up --linked
supabase functions deploy <function-name>
supabase secrets set ...
supabase storage ...
```

Destructive remote actions require a written backup/rollback note in the PR or handoff before approval:

- Dropping tables, columns, buckets, policies, or functions.
- Deleting production rows or auth users.
- Rewriting remote migration history.
- Resetting any hosted database.
- Replacing storage bucket access policies.

Do not paste Supabase access tokens or service-role keys into chat or docs. Use local CLI login, gitignored env files, or Supabase dashboard secrets.

## Point-In-Time Drift Snapshot

Observed on 2026-04-26:

- Remote migrations are not aligned with local migration files.
- Remote has only the first three local migration versions applied cleanly.
- Remote also has four remote-only migration versions:
  - `20260423205655`
  - `20260423205937`
  - `20260423210039`
  - `20260423210205`
- Many local MVP migrations are not applied remotely.
- Remote Edge Functions deployed:
  - `create-session`
  - `start-session`
  - `submit-results`
  - `save-drawing`
  - `complete-session`
  - `export-csv`
- Local Edge Functions present in code but missing remotely:
  - `get-session`
  - `get-stimuli`
  - `save-audio`
  - `update-drawing-review`
  - `update-scoring-review`
  - `export-pdf`

Re-check this snapshot before acting. Treat this section as historical context, not proof of current state.

## Reconciliation Goal

Make hosted Supabase match the current `origin/main` MVP backend contract:

- Schema supports the current patient/case/session/scoring/review/audio/storage model.
- Storage buckets and policies match local MVP security expectations.
- All current Edge Functions are deployed.
- Required secrets exist by name.
- Remote smoke tests pass without exposing patient bearer tokens, private drawings, private audio, or licensed stimuli.

## Step 1: Classify The Hosted Project

Before changing remote state, ask the user whether the hosted project is:

1. Disposable development environment.
2. Shared staging environment with useful test data.
3. Production or clinically sensitive environment.

If it is production or contains data worth preserving, pause and create a backup/export plan before any migration or deploy.

## Step 2: Capture Current State

Run read-only inspection and paste a concise summary into the PR or handoff:

```bash
supabase projects list
supabase migration list --linked
supabase functions list
supabase secrets list
supabase db lint
```

For local comparison:

```bash
supabase status
supabase migration list --local
find supabase/functions -maxdepth 1 -mindepth 1 -type d | sort
```

If local Supabase is running and inspection requires direct Postgres queries, use targeted read-only queries only.

## Step 3: Resolve Migration Drift

Choose one path.

### Path A: Disposable Hosted Dev

Use this only if the user confirms the hosted project can be rebuilt.

1. Confirm no remote data needs preserving.
2. Prefer a clean migration baseline rather than hand-editing remote history.
3. Apply current local migrations in order.
4. Verify storage bucket privacy and RLS policies.
5. Run remote smoke checks.

### Path B: Preserve Hosted Data

Use this for staging/production or any environment with useful data.

1. Inspect the four remote-only migrations and identify what schema changes they made.
2. Create local migration files that represent any legitimate remote-only changes.
3. Create forward-only migrations for missing local MVP changes.
4. Avoid destructive schema changes unless the user explicitly approves and a backup exists.
5. Apply migrations in a small batch.
6. Verify after each batch.

## Step 4: Deploy Missing Edge Functions

Deploy only after schema drift is resolved.

Expected current MVP functions:

```bash
supabase functions deploy create-session
supabase functions deploy start-session
supabase functions deploy get-stimuli
supabase functions deploy submit-results
supabase functions deploy save-drawing
supabase functions deploy save-audio
supabase functions deploy complete-session
supabase functions deploy get-session
supabase functions deploy update-drawing-review
supabase functions deploy update-scoring-review
supabase functions deploy export-pdf
supabase functions deploy export-csv
```

Before deploying, run:

```bash
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/get-stimuli/index.ts supabase/functions/submit-results/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts supabase/functions/export-pdf/index.ts supabase/functions/export-csv/index.ts
```

## Step 5: Verify Secrets

Required remote secret names for current/future MVP behavior:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Legacy/future SMS secrets may exist but are not active in the MVP browser flow:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Secret values must stay out of Git and chat.

## Step 6: Verify Storage

Expected buckets:

- `stimuli`: private licensed assets, served through signed URLs.
- `drawings`: private patient drawings, served through signed URLs.
- `audio`: private patient audio evidence, served through signed URLs.

Required checks:

- Anonymous reads of `audio` and `drawings` objects are blocked.
- Clinician reads go through authenticated functions or scoped signed URLs.
- Service role can upload/manage runtime evidence.
- Licensed MoCA assets are not committed to Git.

## Step 7: Remote Smoke Test

After migration/function deployment, run a minimal hosted smoke test:

1. Clinician signs in.
2. Clinician creates a case and session.
3. `create-session` response includes `testNumber` and excludes patient `linkToken`.
4. Patient starts by test number.
5. Patient submits at least one deterministic task, one drawing task, and one audio task.
6. Patient completes session.
7. Clinician opens dashboard detail.
8. Drawing/audio evidence loads through signed URLs.
9. Manual review saves and finalizes the report.
10. Anonymous storage object reads are blocked.

Record the exact hosted URL, date, branch/commit, and skipped steps in the PR or handoff.

## Rollback Notes

For Edge Function deploys, rollback by redeploying the previous known-good branch/commit.

For schema migrations, rollback should normally be forward-only:

- Add a new corrective migration.
- Preserve existing data unless the user explicitly approves deletion.
- Document the reason and verification.

Hosted database reset is allowed only when the user explicitly confirms the environment is disposable.
