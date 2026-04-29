# CI/CD Agent Runbook

This runbook is the delivery checklist for future agents working across GitHub, Netlify, and Supabase. Use it with `README.md`, `AGENTS.md`, `docs/DEVELOPMENT_PROCESS.md`, `docs/LOCAL_E2E_VERIFICATION.md`, `docs/PATIENT_PWA_DEPLOYMENT.md`, `docs/NETLIFY_HOSTING.md`, and `docs/SUPABASE_RECONCILIATION.md`.

## Service Registry

| Service | Current role | Current target |
|---|---|---|
| GitHub | Source control, PR review, CI, manual hosted smoke workflow | `Reakwind/Remote-Assessment-project`, default branch `main` |
| GitHub Actions | Required baseline verification | `CI` workflow jobs `test` and `full-e2e` |
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
| Backend/session/storage/review/scoring | GitHub CI baseline locally where practical: Deno check, Edge Function tests, local Supabase, `node scripts/local-e2e.mjs --all-versions`, and `cd client && npm run e2e:browser`. |
| Hosted Supabase | Follow `docs/SUPABASE_RECONCILIATION.md`; inspect remote state first, get explicit approval before any remote-changing command, and record rollback notes. |
| Hosted frontend smoke | Run the manual GitHub `Hosted Smoke` workflow or run `cd client && PATIENT_STAGING_URL=... CLINICIAN_STAGING_URL=... HOSTED_SUPABASE_URL=... npm run e2e:hosted-pwa`. |

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

The `Hosted Smoke` workflow is manual. Use it after Netlify or hosted Supabase changes, or before pilot-readiness handoff. It does not need service-role secrets.

## Netlify

Netlify builds two sites from the same GitHub repo and `main` branch:

- patient staging: base `deploy/netlify/patient-staging`, command `cd ../../../client && npm ci --legacy-peer-deps && npm run build:patient:staging`.
- clinician: base `deploy/netlify/clinician`, command `cd ../../../client && npm ci --legacy-peer-deps && npm run build:clinician`.

Backend-only or docs-only commits can produce Netlify deploy records that say `Canceled build due to no content change`. Treat those as deploy-signal noise unless a frontend surface changed or the published site fails hosted smoke.

## Supabase

Hosted Supabase is intentionally not auto-mutated by PR CI. Before any hosted-changing work:

```bash
supabase migration list --local
supabase migration list --linked
supabase functions list
supabase secrets list
supabase storage ls ss:/// --linked --experimental
supabase db lint --linked
```

For function deploys, first run:

```bash
deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)
```

Then deploy only the intended functions after approval. Keep hosted Edge Functions on `verify_jwt = true`; patient-browser calls use anon-key headers, and clinician functions validate the user token inside the handler. For destructive schema/storage/auth work, include a backup or forward-only rollback note before asking for approval.

## Known Setup Limits

- `main` protection may not be available through the current private-repo plan/API path. If enforcement cannot be configured, keep the PR workflow documented and manually followed.
- GitHub automatic branch deletion after merge is enabled for this repository and should stay enabled.
- Keep Node aligned through `.nvmrc`; GitHub Actions and Netlify should both use Node 22.
