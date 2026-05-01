# Remote Assessment Project

Remote Hebrew MoCA pilot MVP. Current `main` is the Pilot MVP baseline.

The active product direction is simple: a clinician creates a session and shares the generated test number outside the app, a patient completes the assessment, raw task/drawing/audio evidence is persisted, deterministic rule scoring is applied where supported by the active test manual, and the clinician reviews/finalizes anything requiring judgment.

## Active Local Checkout

Use this local checkout for all work on this repository:

`/Users/etaycohen/Projects/Remote-Assessment-project-main`

Do not work from a OneDrive, CloudStorage, or other synced clone. If a terminal or agent starts under `/Users/etaycohen/Library/CloudStorage/OneDrive-Personal/`, switch to the active checkout above before running repo commands or making changes.

## Source Of Truth

Read these first for every task:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)

`JOURNEY.md` is the bird's-eye patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.
`docs/DEVELOPMENT_PROCESS.md` defines the provider-neutral development workflow. Supabase is the current MVP runtime; the app contract is the architecture boundary.

Read focused docs only when touching their area:

| Area | Doc |
| --- | --- |
| Patient PWA architecture, installability, cache policy | [docs/PATIENT_PWA_ARCHITECTURE.md](docs/PATIENT_PWA_ARCHITECTURE.md) |
| Surface builds, output directories, frontend hosting split | [docs/PATIENT_PWA_DEPLOYMENT.md](docs/PATIENT_PWA_DEPLOYMENT.md) |
| Netlify patient/clinician hosts | [docs/NETLIFY_HOSTING.md](docs/NETLIFY_HOSTING.md) |
| Clinical-pilot readiness, licensed stimuli, physical-device gates | [docs/PATIENT_PWA_PILOT_READINESS.md](docs/PATIENT_PWA_PILOT_READINESS.md) |
| Patient PWA milestone status | [docs/PATIENT_PWA_TRACKER.md](docs/PATIENT_PWA_TRACKER.md) |
| Patient or clinician Hebrew copy | [docs/HEBREW_TERMINOLOGY.md](docs/HEBREW_TERMINOLOGY.md) |
| GitHub, Netlify, and Supabase delivery flow | [docs/CI_CD_AGENT_RUNBOOK.md](docs/CI_CD_AGENT_RUNBOOK.md) |
| Local browser/Supabase E2E | [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md) |
| Licensed stimulus upload and validation | [docs/STIMULI_ASSET_RUNBOOK.md](docs/STIMULI_ASSET_RUNBOOK.md) |
| Hosted Supabase inspection or changes | [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md) |
| Security threat modeling | [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) |
| Reusable engineering lessons | [docs/AGENT_LEARNINGS.md](docs/AGENT_LEARNINGS.md) |

## Required GitHub Workflow

- `main` is the integration branch.
- Treat the current `origin/main` MVP as the source of truth before starting new work.
- Do not commit or push directly to `main`.
- Start every task from latest `origin/main`.
- Use a feature branch, preferably `codex/<short-scope>`.
- Keep commits focused and open a normal, ready-for-review GitHub PR into `main` after checks pass.
- Do not default to draft PRs; the current GitHub connector has an unreliable draft-to-ready transition. Use drafts only when explicitly needed.
- Run relevant checks before pushing or opening a PR.
- Review the diff and document risks, skipped checks, and open questions.
- Merge to `main` only after explicit user approval for that specific merge.
- Delete merged or superseded branches only after confirming they are no longer needed.

Future work proceeds feature by feature: create a branch from current `origin/main`, review the change, open a PR, and merge only after explicit user approval.

## Development Process

Use [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md) for the full development workflow. Build feature slices around stable app contracts, keep Supabase-specific code isolated behind auth/database/storage/function/notification boundaries, and treat local Supabase plus Playwright E2E as the backend and browser confidence check until hosted preview environments are intentionally configured and trusted.

## MVP Scope

- Clinician work is a website; patient work is a tablet/phone-first PWA. Do not design the patient journey as a desktop website.
- Clinician login, clinical case creation, session creation, dashboard list/detail, drawing/manual review, finalization.
- Clinician auth uses email/password for MVP.
- Patient session start by generated test number, Hebrew MoCA flow, retryable autosave, completion.
- New local patients complete welcome/audio/microphone preflight once; returning local patients start new tests at the first task.
- Same-device resume is explicit from the home-page continue button for in-progress local state.
- Supabase persists sessions, task results, drawings, audio evidence, scoring reports, and audit events.
- Patient task/drawing/audio evidence saves use a local retry queue so refresh or temporary network loss does not immediately discard captured evidence.
- Server-side scoring is authoritative.
- Drawings and ambiguous/manual items go to clinician review.
- Clinician gets an email when a test is completed.
- Clinician copies the generated test number and sends it to the patient outside the app.
- Licensed stimuli load from private Storage through versioned manifests and signed URLs.
- CSV export can include incomplete/provisional data after clinician confirmation, with inline feedback; finalized PDF export remains gated by clinician review.

## Guardrails

- Build the asynchronous clinician-review workflow.
- Use clinician email/password auth for MVP; treat MFA, SSO, and device policy as future security hardening.
- Keep caregiver/support contact usage offline for MVP.
- Use pseudonymous case IDs instead of patient names or national IDs.
- Require clinically useful patient profile fields before test ordering: phone, date of birth, gender, language, dominant hand, and education years.
- Store raw drawing/audio/task evidence for clinician review.
- Use deterministic scoring only where the active manual supports it.
- Use education years for normative interpretation bands only; do not add an education bonus point to the MoCA total.
- Use external speech-to-text only as transcript evidence.
- Send completion notifications when a test is done.
- Keep licensed MoCA assets outside the repository.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind/Radix UI.
- Backend: Supabase Postgres/Auth/Storage/Edge Functions on Deno.
- Local verification: Supabase CLI plus `scripts/local-e2e.mjs`.

## CI And Local E2E

GitHub CI is the required baseline for every PR: install dependencies, lint, unit tests, scoring coverage thresholds, production build, deployable surface builds, Deno type checks, Edge Function unit tests, scripted local Supabase E2E, and Playwright browser E2E.

Use [docs/CI_CD_AGENT_RUNBOOK.md](docs/CI_CD_AGENT_RUNBOOK.md) for the agent delivery flow across GitHub, Netlify, and Supabase, including the manual hosted smoke workflow.

Full browser/Supabase E2E remains a required local pre-merge check for backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, and notification changes. CI may skip licensed PDF file validation, so run `docs/LOCAL_E2E_VERIFICATION.md` locally for clinical-readiness branches and record any skipped checks in the PR.

Use [docs/LOCAL_REHEARSAL_GATE.md](docs/LOCAL_REHEARSAL_GATE.md) for Mac plus iPad HTTPS rehearsal before deployment readiness.

## Repo Map

- `client/` - active frontend.
- `supabase/` - active migrations and Edge Functions.
- `scripts/` - local automation, E2E verification, and bulk flow QA.
- `JOURNEY.md` - patient/clinician browser + backend journey playbook.
- `docs/PATIENT_PWA_ARCHITECTURE.md` - clinician website + patient PWA deployment and UX boundary.
- `docs/PATIENT_PWA_DEPLOYMENT.md` - patient and clinician frontend build outputs, host rules, and cache guidance.
- `docs/PATIENT_PWA_PILOT_READINESS.md` - final readiness gates for staging, licensed stimuli, installed PWA, and phone fallback.
- `docs/PATIENT_PWA_TRACKER.md` - shared patient PWA milestone tracker.
- `docs/AGENT_LEARNINGS.md` - durable lessons from repeated fixes, review findings, and verification gaps.
- `docs/DEVELOPMENT_PROCESS.md` - branch, PR, verification, and provider-neutral backend process.
- `docs/CI_CD_AGENT_RUNBOOK.md` - GitHub, Netlify, and Supabase delivery checklist for agents.
- `docs/LOCAL_E2E_VERIFICATION.md` - local end-to-end test instructions.
- `docs/LOCAL_REHEARSAL_GATE.md` - Mac plus iPad HTTPS rehearsal gate and evidence workflow.
- `docs/STIMULI_ASSET_RUNBOOK.md` - private licensed stimulus upload and validation instructions.
- `docs/SUPABASE_RECONCILIATION.md` - hosted Supabase drift/reconciliation runbook.
- `docs/security/THREAT_MODEL.md` - current application threat model.
- `docs/archive/` - historical plans and backlog notes, not product authority.
- `CONTEXT.md` - project context.

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
node scripts/local-test-shell.mjs
supabase start
supabase functions serve $(node scripts/edge-functions.mjs serve-args) --env-file /dev/null
node scripts/local-e2e.mjs --all-versions
node scripts/bulk-flow-qa.mjs --batch FLOWQA --patients 50 --clinicians 50 --tests-per-patient 30 --concurrency 5
node scripts/bulk-flow-qa.mjs --report-batch FLOWQA
node scripts/bulk-flow-qa.mjs --cleanup-batch FLOWQA
```

Use `node scripts/local-test-shell.mjs` for the local-only regression path before worrying about hosted Supabase or Netlify. It points child commands at local Supabase, disables hosted/Netlify environment variables, starts Edge Functions when needed, and runs the CI-style local checks. Use `--unit-only` when you need checks that do not require local Supabase.

Licensed stimulus readiness:

```bash
node scripts/verify-stimuli.mjs --all-versions --print-manifest
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/verify-stimuli.mjs --all-versions
```
