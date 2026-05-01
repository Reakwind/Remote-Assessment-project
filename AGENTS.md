# Agent Instructions

Read [README.md](README.md) before making product, backend, scoring, or UX changes. Current `main` is the Pilot MVP baseline.

## Active Local Checkout

The active local checkout for this project is:

`/Users/etaycohen/Projects/Remote-Assessment-project-main`

Do not use or update any OneDrive, CloudStorage, or similarly synced checkout for repo work. If the shell starts in a path under `/Users/etaycohen/Library/CloudStorage/OneDrive-Personal/`, stop and switch to the active checkout above before reading, editing, testing, committing, pushing, or opening PRs. Do not rely on stale chat context, memory entries, or older worktree paths when they conflict with this rule.

## Source Of Truth

Read these first for every task:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)

`JOURNEY.md` is the patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.
`docs/DEVELOPMENT_PROCESS.md` is the provider-neutral engineering workflow. Supabase is the current MVP runtime; the app contract is the architecture boundary.

Read focused docs only when touching their area:

| Area | Doc |
| --- | --- |
| Patient PWA architecture, installability, cache policy | [docs/PATIENT_PWA_ARCHITECTURE.md](docs/PATIENT_PWA_ARCHITECTURE.md) |
| Surface builds, output directories, frontend hosting split | [docs/PATIENT_PWA_DEPLOYMENT.md](docs/PATIENT_PWA_DEPLOYMENT.md) |
| Netlify patient/clinician hosts | [docs/NETLIFY_HOSTING.md](docs/NETLIFY_HOSTING.md) |
| Clinical-pilot readiness, licensed stimuli, physical-device gates | [docs/PATIENT_PWA_PILOT_READINESS.md](docs/PATIENT_PWA_PILOT_READINESS.md) |
| Patient PWA milestone status | [docs/PATIENT_PWA_TRACKER.md](docs/PATIENT_PWA_TRACKER.md) |
| Frontend readiness, patient/clinician UI rules, verification matrix | [docs/FRONTEND_READINESS.md](docs/FRONTEND_READINESS.md) |
| Patient-facing copy, clinician labels, status labels, task names, review rubrics | [docs/HEBREW_TERMINOLOGY.md](docs/HEBREW_TERMINOLOGY.md) |
| GitHub, Netlify, and Supabase delivery flow | [docs/CI_CD_AGENT_RUNBOOK.md](docs/CI_CD_AGENT_RUNBOOK.md) |
| Local browser/Supabase E2E | [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md) |
| Local Mac plus iPad HTTPS rehearsal | [docs/LOCAL_REHEARSAL_GATE.md](docs/LOCAL_REHEARSAL_GATE.md) |
| Licensed stimulus upload and validation | [docs/STIMULI_ASSET_RUNBOOK.md](docs/STIMULI_ASSET_RUNBOOK.md) |
| Hosted Supabase inspection or changes | [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md) |
| Security threat modeling | [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) |
| Reusable engineering lessons | [docs/AGENT_LEARNINGS.md](docs/AGENT_LEARNINGS.md) |

## Required GitHub Workflow

Every agent must use GitHub branch-based version control for all repo changes. This is mandatory for current and future AI agents and human collaborators.

- Start by checking `git status --short --branch`, `git branch --show-current`, and `git remote -v`.
- Do not work directly on `main`; if the repo is on `main`, create a feature branch before editing files.
- Start new work from latest `origin/main`.
- Treat the current `origin/main` MVP as the source of truth before changing, deleting, or adding features.
- Use a feature branch, preferably `codex/<short-scope>`.
- Keep unrelated dirty work intact.
- Do not reset, delete, or rewrite user work unless the user explicitly requests it.
- Make focused commits after relevant verification passes.
- Push the branch and open a normal, ready-for-review GitHub PR into `main` after checks pass.
- Do not default to draft PRs. The current GitHub connector can create and merge PRs, but its draft-to-ready mutation is unreliable. Use drafts only when explicitly needed, and expect conversion to require the GitHub UI or a working `gh` login.
- Review the diff before asking to merge; call out risks, skipped checks, and any open questions.
- Merge to `main` only after explicit user approval for that specific merge.
- Prefer squash merge for feature branches unless the user requests a different merge strategy.
- Delete merged/superseded branches only after confirming they are merged or explicitly no longer needed.
- List verification performed and skipped checks in the PR and final handoff.

Generated local artifacts stay out of Git: `.env.local`, `.certs/`, `.playwright-mcp/`, `client/test-results/`, `client/playwright-report/`, `local-rehearsal-evidence/`, `node_modules/`, and `dist/`.

## Development Process

Read [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md) before backend, platform, storage, auth, notification, session-flow, or verification changes.

- Build features as vertical slices: browser journey, app contract, persistence, review/scoring, verification, and docs.
- Keep Supabase-specific work behind auth, database, storage, Edge Function/API, and notification boundaries.
- Put deterministic scoring, validation, task mapping, and report logic in provider-independent shared modules when practical.
- Use local Supabase plus Playwright E2E as the backend and browser confidence check until hosted preview environments are intentionally configured and trusted.

## Product Guardrails

- Treat the clinician side as a website and the patient side as a tablet/phone-first PWA. Do not design or QA the patient journey as a desktop website.
- Build the asynchronous clinician-review flow.
- Use clinician email/password auth for MVP; keep MFA, SSO, and device policy in future security hardening work.
- Keep caregiver/support contact usage offline for MVP.
- Use pseudonymous case IDs instead of patient names or national IDs.
- Require clinically useful patient profile fields before test ordering: phone, date of birth, gender, language, dominant hand, and education years.
- Store raw drawing/audio/task evidence for clinician review.
- Use deterministic scoring only where the active test manual supports it.
- Route drawings and ambiguous/manual items to clinician review.
- Use external speech-to-text as transcript evidence only.
- Notify clinicians when a patient completes a test.
- Use clinician-shared test numbers for MVP patient start; keep SMS delivery out of the active MVP flow.
- Keep licensed MoCA stimuli outside the repository.
- Load licensed stimuli from private Storage through versioned manifests and signed URLs.

## Verification

GitHub CI is the required baseline: dependency install, lint, unit tests, scoring coverage thresholds, production build, deployable surface builds, Deno type checks, Edge Function unit tests, scripted local Supabase E2E, and Playwright browser E2E.

For backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, and notification changes, full browser/Supabase E2E remains a required local pre-merge check. Start local Supabase and Edge Functions, then run:

```bash
supabase start
supabase functions serve $(node scripts/edge-functions.mjs serve-args) --env-file /dev/null
cd client && npm test && npm run build && npm run lint && npm run e2e:browser
cd ..
deno check --frozen $(node scripts/edge-functions.mjs deno-check-args)
node scripts/local-e2e.mjs --all-versions
```

Preferred local-only regression shortcut:

```bash
node scripts/local-test-shell.mjs
```

This script disables hosted Supabase/Netlify environment variables for child commands, writes `client/.env.local` with local Supabase values, starts local Edge Functions when needed, then runs the CI-style local checks plus browser and scripted local E2E. Use `--unit-only` for checks that do not require local Supabase, and `--skip-licensed-pdf-check` only for non-clinical contract checks.

Record skipped local E2E checks and the reason in the PR body.

CI may use `node scripts/local-e2e.mjs --all-versions --skip-licensed-pdf-check` because licensed MoCA PDFs must stay outside GitHub-hosted runners. Do not use that flag for clinical-readiness validation; local clinical checks should verify the licensed PDFs and private Storage manifests.

Useful local variants from the current runbooks:

- `supabase db reset` resets the local database before rerunning flows. Use it only when local test data can be discarded.
- `supabase start -x vector,logflare` is the fallback when Colima or Docker socket mounts break the default local start.
- `node scripts/local-e2e.mjs --version 8.3` runs the scripted E2E flow for a single MoCA version.
- `node scripts/bulk-flow-qa.mjs --batch FLOWQA --patients 50 --clinicians 50 --tests-per-patient 30 --concurrency 5` runs high-volume local data-flow QA; pair it with `--report-batch FLOWQA` and `--cleanup-batch FLOWQA`.

For browser or UX changes, verify the affected flow in Chrome when practical.

For licensed stimulus storage or clinical-readiness changes, keep assets out of Git. Use `node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload` for local licensed visual assets when appropriate, and run `node scripts/verify-stimuli.mjs --all-versions` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` configured. Use `node scripts/verify-stimuli.mjs --all-versions --print-manifest` to inspect the expected manifest. Memory learning uses generated Hebrew speech in the browser; do not add a licensed memory MP3 requirement.

## Supabase Remote Operations

The linked hosted Supabase project may drift from local MVP code. Before any hosted deployment, migration push, remote function deploy, storage-policy change, or remote E2E run, read [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md).

Use the project-scoped Supabase MCP server for read-only hosted inspection when it is available in the current Codex session; use the CLI fallback commands in `docs/SUPABASE_RECONCILIATION.md` when MCP tools are unavailable. Remote-changing MCP or CLI operations require explicit user approval immediately before execution. Destructive hosted database/storage/auth actions require a backup or rollback note before approval.
