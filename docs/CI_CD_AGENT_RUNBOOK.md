# CI/CD Agent Runbook

This runbook is the delivery checklist for future agents working across GitHub, Netlify, and Supabase. Use it with `README.md`, `AGENTS.md`, `docs/DEVELOPMENT_PROCESS.md`, `docs/LOCAL_E2E_VERIFICATION.md`, `docs/PATIENT_PWA_DEPLOYMENT.md`, `docs/NETLIFY_HOSTING.md`, and `docs/SUPABASE_RECONCILIATION.md`.

## Service Registry

| Service | Current role | Current target |
|---|---|---|
| GitHub | Source control, PR review, CI, manual hosted smoke workflow | `Reakwind/Remote-Assessment-project`, default branch `main` |
| GitHub Actions | Required baseline verification | `CI` workflow jobs `test` and `full-e2e` |
| GitHub Actions | Hosted backend deploy and hosted smoke | `Deploy Hosted Backend` workflow |
| Supabase hosted | MVP backend runtime | project ref `jdkaxdtrukfxzlzspuua` |
| Supabase local | Contract and browser E2E backend | `http://127.0.0.1:54321` |
| Netlify patient | Patient PWA staging host | `https://reakwind-remote-assessment-patient-staging.netlify.app` |
| Netlify clinician | Clinician website host | `https://reakwind-remote-assessment-clinician.netlify.app` |

Do not put Supabase service-role keys, Netlify auth tokens, Resend keys, Twilio secrets, or licensed MoCA assets in Git, PR text, docs, or chat.

## Agent Delivery Flow

1. Start from `/Users/etaycohen/Projects/Remote-Assessment-project-main`.
2. Run `git status --short --branch`, `git branch --show-current`, `git remote -v`, then `git fetch --prune origin`.
3. Create a focused branch from `origin/main`, preferably `codex/<short-scope>`.
4. Make the smallest repo-backed change that addresses the request.
5. Run the verification tier that matches the risk.
6. Push the branch and open a ready-for-review PR.
7. Record checks run, skipped checks, hosted inspection, deploy notes, and rollback notes in the PR.
8. Merge only after explicit user approval.

## Verification Tiers

| Change type | Required checks |
|---|---|
| Docs-only | Link/search verification for touched docs. |
| Frontend-only | `cd client && npm test && npm run lint && npm run build`; add `npm run build:surfaces && npm run verify:surface-builds` for surface/deploy changes. |
| Patient PWA | Frontend checks plus `npm run e2e:patient-pwa` against a patient preview when installability, cache, routing, or task UX changed. |
| Backend/session/storage/review/scoring | Prefer `node scripts/local-test-shell.mjs` before hosted work. It disables hosted Supabase/Netlify env vars for child commands, uses local Supabase, and runs the CI-style local checks, browser E2E, and scripted local E2E. |
| Hosted Supabase Edge Functions | Merges to `main` run `Deploy Hosted Backend` after `CI` succeeds when `supabase/functions/**`, `supabase/config.toml`, or `scripts/edge-functions.mjs` changed. |
| Hosted Supabase migrations | Use `Deploy Hosted Backend` manually with `deploy_migrations=true`; keep the `supabase-production-migrations` environment approval gate enabled. |
| Hosted frontend/backend smoke | `Deploy Hosted Backend` runs a hosted Supabase create/start data smoke and Netlify PWA shell smoke after frontend or hosted backend code changes. The manual `Hosted Smoke` workflow remains available for ad hoc rechecks. |

CI may use `node scripts/local-e2e.mjs --all-versions --skip-licensed-pdf-check`. Do not use that skipped licensed-PDF path as clinical-readiness evidence.

## Shared Edge Function List

Use `scripts/edge-functions.mjs` instead of copying Edge Function names by hand:

```bash
node scripts/edge-functions.mjs list
deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)
supabase functions serve $(node scripts/edge-functions.mjs serve-args) --env-file /dev/null
node scripts/edge-functions.mjs deploy-commands
```

The deploy commands printed by `deploy-commands` are remote-changing commands. Run them only after hosted drift inspection and explicit user approval.

## GitHub Actions

The `CI` workflow is the required PR and `main` baseline. It installs dependencies with `npm ci --legacy-peer-deps`, runs lint, unit tests, coverage, production build, deployable surface builds, Deno checks, Edge Function unit tests, local Supabase E2E, and Playwright browser E2E.

The `Deploy Hosted Backend` workflow runs after successful `CI` runs on `main`, then:

- deploys all hosted Supabase Edge Functions when function/config deploy inputs changed and no pending migration gate blocks the hosted deploy,
- blocks with a manual gate when migration files changed on `main` but `deploy_migrations=true` was not selected,
- runs hosted data-contract smoke and Netlify shell smoke after frontend, Netlify, Edge Function, or migration changes,
- retries hosted smoke to absorb normal Netlify deploy lag.

The hosted data-contract smoke is `node scripts/hosted-backend-smoke.mjs`. It creates a confirmed smoke clinician, inserts a complete patient profile, calls `create-session`, verifies the returned 8-digit patient test number, calls `start-session`, submits the full patient assessment contract across all MoCA task types, completes the session, verifies the clinician review queue, finalizes drawing/scoring review, and then cleans up its smoke records. Use `--keep-records` only when debugging a failed hosted smoke run.

The `Hosted Smoke` workflow is still manual. Use it for ad hoc rechecks or before pilot-readiness handoff. Keep `run_backend_data_smoke=true` unless you intentionally only want the Netlify shell/PWA smoke; the backend data smoke needs anon and service-role secrets.

## Netlify

Netlify builds two sites from the same GitHub repo and `main` branch:

- patient staging: base `deploy/netlify/patient-staging`, command `cd ../../../client && npm ci --legacy-peer-deps && npm run build:patient:staging`.
- clinician: base `deploy/netlify/clinician`, command `cd ../../../client && npm ci --legacy-peer-deps && npm run build:clinician`.

Backend-only or docs-only commits can produce Netlify deploy records that say `Canceled build due to no content change`. Treat those as deploy-signal noise unless a frontend surface changed or the published site fails hosted smoke.

## Supabase

Hosted Supabase is intentionally not mutated by PR CI. After merge to `main`, Edge Functions deploy automatically through `Deploy Hosted Backend` when relevant files changed. Before manual hosted-changing work:

```bash
supabase migration list --local
supabase migration list --linked
supabase functions list
supabase secrets list
supabase storage ls ss:/// --linked --experimental
supabase db lint --linked
```

Required GitHub secrets for hosted automation:

| Secret | Used by | Notes |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Edge Function deploys, migration deploys | Personal access token for Supabase CLI in GitHub Actions. |
| `SUPABASE_DB_PASSWORD` | migration deploys only | Required only for the protected migration job. |
| `HOSTED_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` | hosted backend data smoke | Hosted project's anon key. |
| `HOSTED_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | hosted backend data smoke | Hosted project's service-role key; never expose it to frontend build env. |

Required hosted Supabase Edge Function secrets:

| Secret | Notes |
|---|---|
| `START_SESSION_RATE_LIMIT_SECRET` | Long random secret dedicated to HMAC hashing patient-start IP and test-number fingerprints. |
| `ALLOWED_ORIGINS` | Comma-separated clinician and patient Netlify origins for hosted browser calls. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Notification provider configuration. |

Optional GitHub repository variables override the default hosted smoke targets:

| Variable | Default |
|---|---|
| `SUPABASE_PROJECT_REF` | `jdkaxdtrukfxzlzspuua` |
| `PATIENT_STAGING_URL` | `https://reakwind-remote-assessment-patient-staging.netlify.app` |
| `CLINICIAN_STAGING_URL` | `https://reakwind-remote-assessment-clinician.netlify.app` |
| `HOSTED_SUPABASE_URL` | `https://jdkaxdtrukfxzlzspuua.supabase.co` |

For function deploys, first run:

```bash
deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)
```

The automatic workflow deploys all checked-in Edge Functions with `supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF"` after CI passes. Keep hosted Edge Functions on `verify_jwt = true`; patient-browser calls use anon-key headers, and clinician functions validate the user token inside the handler. For destructive schema/storage/auth work, include a backup or forward-only rollback note before asking for approval.

For migrations, use `Deploy Hosted Backend` with `deploy_migrations=true` only after reviewing the migration diff, drift state, and rollback note. The job uses the `supabase-production-migrations` GitHub Environment so repository admins can require approval before it applies hosted migrations.

## Known Setup Limits

- `main` protection may not be available through the current private-repo plan/API path. If enforcement cannot be configured, keep the PR workflow documented and manually followed.
- GitHub automatic branch deletion after merge is enabled for this repository and should stay enabled.
- Keep Node aligned through `.nvmrc`; GitHub Actions and Netlify should both use Node 22.
