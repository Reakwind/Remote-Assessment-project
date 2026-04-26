# Agent Instructions

Read [README.md](README.md) before making product, backend, scoring, or UX changes. Current `main` is the Pilot MVP baseline.

## Source Of Truth

Canonical files:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [CONTEXT.md](CONTEXT.md)
5. [docs/AGENT_LEARNINGS.md](docs/AGENT_LEARNINGS.md)
6. [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)
7. [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md)
8. [docs/STIMULI_ASSET_RUNBOOK.md](docs/STIMULI_ASSET_RUNBOOK.md)
9. [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md)

`JOURNEY.md` is the patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.
`docs/DEVELOPMENT_PROCESS.md` is the provider-neutral engineering workflow. Supabase is the current MVP runtime; the app contract is the architecture boundary.
`docs/AGENT_LEARNINGS.md` is the durable lessons file for future agents. Update it when PRs or review findings expose reusable engineering rules or recurring failure modes.

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

Generated local artifacts stay out of Git: `.env.local`, `.playwright-mcp/`, `client/test-results/`, `client/playwright-report/`, `node_modules/`, and `dist/`.

## Development Process

Read [docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md) before backend, platform, storage, auth, notification, session-flow, or verification changes.

- Build features as vertical slices: browser journey, app contract, persistence, review/scoring, verification, and docs.
- Keep Supabase-specific work behind auth, database, storage, Edge Function/API, and notification boundaries.
- Put deterministic scoring, validation, task mapping, and report logic in provider-independent shared modules when practical.
- Use local Supabase E2E as the backend confidence check until hosted preview environments are intentionally configured and trusted.

## Product Guardrails

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

GitHub CI intentionally runs the stable baseline only: dependency install, lint, unit tests, scoring coverage thresholds, production build, and Deno type checks for Supabase Edge Functions.

For backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, and notification changes, full browser/Supabase E2E remains a required local pre-merge check. Start local Supabase and Edge Functions, then run:

```bash
supabase start
supabase functions serve create-session start-session get-stimuli submit-results submit-task save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review export-pdf export-csv --env-file /dev/null
cd client && npm test && npm run build && npm run lint && npm run e2e:browser
cd ..
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/get-stimuli/index.ts supabase/functions/submit-results/index.ts supabase/functions/submit-task/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts supabase/functions/export-pdf/index.ts supabase/functions/export-csv/index.ts
node scripts/local-e2e.mjs --all-versions
```

Record skipped local E2E checks and the reason in the PR body.

Useful local variants from the current runbooks:

- `supabase db reset` resets the local database before rerunning flows. Use it only when local test data can be discarded.
- `supabase start -x vector,logflare` is the fallback when Colima or Docker socket mounts break the default local start.
- `node scripts/local-e2e.mjs --version 8.3` runs the scripted E2E flow for a single MoCA version.

For browser or UX changes, verify the affected flow in Chrome when practical.

For licensed stimulus storage or clinical-readiness changes, keep assets out of Git. Use `node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload` for local licensed visual assets when appropriate, and run `node scripts/verify-stimuli.mjs --all-versions` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` configured. Use `node scripts/verify-stimuli.mjs --all-versions --print-manifest` to inspect the expected manifest, and use `--visual-only` only when memory word-list audio is intentionally not part of the check.

## Supabase Remote Operations

The linked hosted Supabase project may drift from local MVP code. Before any hosted deployment, migration push, remote function deploy, storage-policy change, or remote E2E run, read [docs/SUPABASE_RECONCILIATION.md](docs/SUPABASE_RECONCILIATION.md).

Read-only Supabase inspection is allowed when needed. Remote-changing commands require explicit user approval immediately before execution. Destructive hosted database/storage/auth actions require a backup or rollback note before approval.
