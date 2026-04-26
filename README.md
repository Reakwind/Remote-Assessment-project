# Remote Assessment Project

Remote Hebrew MoCA pilot MVP. Current `main` is the Pilot MVP baseline.

The active product direction is simple: a clinician creates a session and shares the generated test number outside the app, a patient completes the assessment, raw task/drawing/audio evidence is persisted, deterministic rule scoring is applied where supported by the active test manual, and the clinician reviews/finalizes anything requiring judgment.

## Source Of Truth

Read these first:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [CONTEXT.md](CONTEXT.md)
5. [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)
6. [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md)
7. [docs/STIMULI_ASSET_RUNBOOK.md](docs/STIMULI_ASSET_RUNBOOK.md)
8. [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md)

`JOURNEY.md` is the bird's-eye patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.
`docs/DEVELOPMENT_PROCESS.md` defines the provider-neutral development workflow. Supabase is the current MVP runtime; the app contract is the architecture boundary.

## Required GitHub Workflow

- `main` is the integration branch.
- Treat the current `origin/main` MVP as the source of truth before starting new work.
- Do not commit or push directly to `main`.
- Start every task from latest `origin/main`.
- Use a feature branch, preferably `codex/<short-scope>`.
- Keep commits focused and open a GitHub PR into `main`.
- Run relevant checks before pushing or opening a PR.
- Review the diff and document risks, skipped checks, and open questions.
- Merge to `main` only after explicit user approval for that specific merge.
- Delete merged or superseded branches only after confirming they are no longer needed.

Future work proceeds feature by feature: create a branch from current `origin/main`, review the change, open a PR, and merge only after explicit user approval.

## Development Process

Use [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md) for the full development workflow. Build feature slices around stable app contracts, keep Supabase-specific code isolated behind auth/database/storage/function/notification boundaries, and treat local Supabase E2E as the backend confidence check until hosted preview environments are intentionally configured and trusted.

## MVP Scope

- Clinician login, clinical case creation, session creation, dashboard list/detail, drawing/manual review, finalization.
- Clinician auth uses email/password for MVP.
- Patient session start by generated test number, Hebrew MoCA flow, autosave, completion.
- New local patients complete welcome/audio/microphone preflight once; returning local patients start new tests at the first task.
- Same-device resume is explicit from the home-page continue button for in-progress local state.
- Supabase persists sessions, task results, drawings, audio evidence, scoring reports, and audit events.
- Server-side scoring is authoritative.
- Drawings and ambiguous/manual items go to clinician review.
- Clinician gets an email when a test is completed.
- Clinician copies the generated test number and sends it to the patient outside the app.
- Licensed stimuli load from private Storage through versioned manifests and signed URLs.
- CSV export can include incomplete/provisional data with inline feedback; finalized PDF export remains gated by clinician review.

## Guardrails

- Build the asynchronous clinician-review workflow.
- Use clinician email/password auth for MVP; treat MFA, SSO, and device policy as future security hardening.
- Keep caregiver/support contact usage offline for MVP.
- Use pseudonymous case IDs instead of patient names or national IDs.
- Store only clinically useful patient profile fields needed for interpretation: phone, date of birth, gender, language, dominant hand, and education years.
- Store raw drawing/audio/task evidence for clinician review.
- Use deterministic scoring only where the active manual supports it.
- Use external speech-to-text only as transcript evidence.
- Send completion notifications when a test is done.
- Keep licensed MoCA assets outside the repository.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind/Radix UI.
- Backend: Supabase Postgres/Auth/Storage/Edge Functions on Deno.
- Local verification: Supabase CLI plus `scripts/local-e2e.mjs`.

## CI And Local E2E

GitHub CI is the stable required baseline for every PR: install dependencies, lint, unit tests, scoring coverage thresholds, production build, and Deno type checks for Supabase Edge Functions.

Full browser/Supabase E2E is a required local pre-merge check for backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, and notification changes. Run `docs/LOCAL_E2E_VERIFICATION.md` locally for those branches and record any skipped checks in the PR.

## Repo Map

- `client/` - active frontend.
- `supabase/` - active migrations and Edge Functions.
- `scripts/` - local automation and E2E verification.
- `JOURNEY.md` - patient/clinician browser + backend journey playbook.
- `docs/DEVELOPMENT_PROCESS.md` - branch, PR, verification, and provider-neutral backend process.
- `docs/LOCAL_E2E_VERIFICATION.md` - local end-to-end test instructions.
- `docs/STIMULI_ASSET_RUNBOOK.md` - private licensed stimulus upload and validation instructions.
- `docs/SUPABASE_RECONCILIATION.md` - hosted Supabase drift/reconciliation runbook.
- `docs/plans/` - background implementation plans, not product authority.
- `CONTEXT.md` and `MEMORY.md` - project context/history.

## Development

```bash
cd client
npm install
npm run dev
npm test
npm run e2e:browser
npm run build
npm run lint
```

Backend/local E2E:

```bash
supabase start
supabase functions serve create-session start-session get-stimuli submit-results submit-task save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review export-pdf export-csv --env-file /dev/null
node scripts/local-e2e.mjs --all-versions
```

Licensed stimulus readiness:

```bash
node scripts/verify-stimuli.mjs --all-versions --print-manifest
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/verify-stimuli.mjs --all-versions --visual-only
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/verify-stimuli.mjs --all-versions
```
