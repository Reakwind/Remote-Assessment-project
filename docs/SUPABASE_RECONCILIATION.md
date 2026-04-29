# Supabase Reconciliation Runbook

This runbook is the source of truth for reconciling local Supabase state with the linked hosted Supabase project.

Use it before hosted deployments, remote E2E, migration pushes, Edge Function deploys, or storage/security policy changes.

## Current Linked Project

- Project name: `Remote Assessment`
- Project ref: `jdkaxdtrukfxzlzspuua`
- Region: Southeast Asia (Singapore)
- Local stack URL: `http://127.0.0.1:54321`

As of 2026-04-28, the Supabase CLI is authenticated and this repo is linked to the hosted project. The local Codex setup also has a project-scoped Supabase MCP server configured for `jdkaxdtrukfxzlzspuua`; reload the Codex session if `/mcp` does not show the Supabase tools after setup changes.

## Operating Rules

Prefer Supabase MCP for read-only hosted inspection when the tools are available in the current Codex session. Use MCP to inspect hosted migrations, functions, storage buckets, advisors/lint findings, logs, and Supabase docs without switching to the dashboard. The Supabase CLI commands below remain the fallback and are still valid evidence.

Read-only inspection is allowed when needed:

```bash
supabase status
supabase projects list
supabase migration list --local
supabase migration list --linked
supabase functions list
supabase secrets list
supabase storage ls ss:/// --linked --experimental
supabase db lint
supabase db lint --linked
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

## Supabase MCP Workflow

Use this workflow before pilot-readiness decisions, hosted debugging, remote E2E, deployment, migration, function, storage, auth, or RLS work.

### 1. Pre-pilot hosted readiness checks

Use Supabase MCP first, or the CLI fallback commands below, to confirm:

- Remote migrations match local migration files.
- All MVP Edge Functions are deployed and active.
- Required secret names exist. Do not inspect or paste secret values.
- Expected private Storage buckets exist for `stimuli`, `drawings`, and `audio`.
- Private Storage buckets enforce the repo-defined MIME and file-size limits.
- Database advisors/lint findings do not reveal app-schema blockers.

CLI fallback:

```bash
supabase migration list --linked
supabase functions list
supabase secrets list
supabase storage ls ss:/// --linked --experimental
supabase db lint --linked
```

### 2. Remote/local drift detection

Compare hosted state against repo state before any hosted-changing command:

```bash
supabase migration list --local
supabase migration list --linked
node scripts/edge-functions.mjs list
supabase functions list
```

For expected local Edge Function names and entrypoints, prefer the checked-in helper over copying the list by hand:

```bash
node scripts/edge-functions.mjs list
node scripts/edge-functions.mjs deno-check-args
node scripts/edge-functions.mjs deploy-commands
```

For MCP, use the equivalent read-only migration/function/schema inspection tools, then summarize drift as:

- migrations: aligned, local-only, remote-only, or unknown,
- functions: all expected deployed, local-only missing remotely, or remote-only,
- storage: expected buckets/policies present, missing, or unknown,
- secrets: required names present or missing,
- advisors/logs: blocker, warning, or clean.

### 3. Safer hosted debugging

When a hosted browser or patient/clinician issue appears, use MCP read-only inspection before changing anything:

- Check recent Edge Function logs for the failing endpoint.
- Inspect CORS-related failures for the actual hosted origins.
- Inspect function deployment status and last update time.
- Inspect schema/policy state for the affected table or bucket.
- Search Supabase docs through MCP for current behavior before changing RLS, storage, auth, or Edge Function code.

Only move to remote-changing commands after the failure is understood, the intended change is written down, and the user approves that specific action.

### 4. Docs-backed Supabase changes

Supabase behavior changes often. Before changing migrations, RLS, storage policies, auth/session behavior, Edge Functions, branching, or hosted configuration:

- Use MCP docs search when available.
- If MCP docs are unavailable in the session, use official Supabase docs.
- Capture the relevant rule in the PR body or handoff when it affects the implementation.
- Keep local Supabase plus browser E2E as the verification baseline even when hosted inspection passes.

### 5. Workflow hardening

For every hosted Supabase PR or handoff, include:

- the exact read-only inspection commands or MCP checks used,
- date, branch, and commit inspected,
- migration/function/storage/secret/advisor summary,
- remote-changing commands skipped or run,
- rollback note for any destructive or hosted-changing action,
- hosted smoke or local E2E checks performed and skipped.

## Point-In-Time Drift Snapshot

Observed on 2026-04-28 with read-only CLI inspection after Supabase MCP setup:

- Remote migrations align with all local migration files through `20260428000002`.
- All expected current MVP Edge Functions from `node scripts/edge-functions.mjs list` are deployed and active.
- Required secret names are present:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
- Legacy/future SMS secret names are also present.
- Hosted Storage lists expected private buckets `stimuli`, `drawings`, and `audio`; it also lists legacy/extra `assessment-drawings`.
- The Storage CLI inspection required `--experimental`; retry with `--dns-resolver https` if API key lookup times out.
- `supabase db lint --linked` exits successfully, but reports advisory-extension issues in `extensions.index_advisor` (`text` to `text[]` cast warning and missing `hypopg_reset()` error). Treat these as a hosted advisor tooling issue unless app-schema evidence says otherwise.

Previous historical snapshot from 2026-04-26:

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

Current repo hardening expectations:

- Public legacy RPC helpers from the original prototype are removed; browser flows use Edge Functions rather than `validate_link_token`, `mark_session_started`, `mark_session_completed`, or `recalculate_total_score`.
- Trigger helper functions in `public` set an explicit `search_path` and are not directly executable by `public`, `anon`, or `authenticated`.
- `stimuli`, `drawings`, and `audio` stay private and enforce bucket-level upload limits that match the app contract.

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
node scripts/edge-functions.mjs list
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

Expected current MVP functions are listed by:

```bash
node scripts/edge-functions.mjs list
```

Before deploying, run:

```bash
deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)
```

Then print the deploy commands and run only the approved function deploys:

```bash
node scripts/edge-functions.mjs deploy-commands
```

Hosted Edge Functions are expected to keep `verify_jwt = true`. Public patient calls send the Supabase anon key in `apikey` and `Authorization` headers; clinician-only functions still validate the clinician user token inside the handler.

## Step 5: Verify Secrets

Required remote secret names for current/future MVP behavior:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Legacy/future SMS secrets may exist but are not active in the MVP browser flow:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Secret values must stay out of Git and chat.

`ALLOWED_ORIGINS` must include the active hosted clinician and patient origins, separated by commas. For the current Netlify pilot hosts, include:

```text
https://reakwind-remote-assessment-clinician.netlify.app,https://reakwind-remote-assessment-patient-staging.netlify.app
```

If this secret is missing, hosted browser calls to Edge Functions can fail before the app receives JSON, commonly surfacing as `Load failed`.

## Step 6: Verify Storage

Expected buckets:

- `stimuli`: private licensed PNG assets, served through signed URLs, `image/png`, 10 MiB limit.
- `drawings`: private patient drawings, served through signed URLs, `image/png`, 6 MiB limit.
- `audio`: private patient audio evidence, served through signed URLs, `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav`, or `audio/x-wav`, 20 MiB limit.

Required checks:

- Anonymous reads of `audio` and `drawings` objects are blocked.
- Clinician reads go through authenticated functions or scoped signed URLs.
- Service role can upload/manage runtime evidence.
- Licensed MoCA assets are not committed to Git.
- Legacy/extra buckets such as `assessment-drawings` require an empty-bucket check, backup/rollback note, and explicit approval before deletion.

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
11. Edge Function CORS preflight allows the hosted clinician origin for `create-session` and the hosted patient origin for `start-session`.

Record the exact hosted URL, date, branch/commit, and skipped steps in the PR or handoff.

## Rollback Notes

For Edge Function deploys, rollback by redeploying the previous known-good branch/commit.

For schema migrations, rollback should normally be forward-only:

- Add a new corrective migration.
- Preserve existing data unless the user explicitly approves deletion.
- Document the reason and verification.

Hosted database reset is allowed only when the user explicitly confirms the environment is disposable.
