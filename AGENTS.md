# Agent Instructions

Read [README.md](README.md) before making product, backend, scoring, or UX changes. Current `main` is the Pilot MVP baseline.

## Source Of Truth

Canonical files:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [CONTEXT.md](CONTEXT.md)
5. [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md)
6. [docs/STIMULI_ASSET_RUNBOOK.md](docs/STIMULI_ASSET_RUNBOOK.md)

`JOURNEY.md` is the patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.

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
- Push the branch and open a GitHub PR into `main`.
- Review the diff before asking to merge; call out risks, skipped checks, and any open questions.
- Merge to `main` only after explicit user approval for that specific merge.
- Prefer squash merge for feature branches unless the user requests a different merge strategy.
- Delete merged/superseded branches only after confirming they are merged or explicitly no longer needed.
- List verification performed and skipped checks in the PR and final handoff.

Generated local artifacts stay out of Git: `.env.local`, `.playwright-mcp/`, `client/test-results/`, `client/playwright-report/`, `node_modules/`, and `dist/`.

## Product Guardrails

- Build the asynchronous clinician-review flow.
- Use clinician email/password auth for MVP; keep MFA, SSO, and device policy in future security hardening work.
- Keep caregiver/support contact usage offline for MVP.
- Use pseudonymous case IDs instead of patient names or national IDs.
- Store only clinically useful patient profile fields needed for interpretation: phone, date of birth, gender, language, dominant hand, and education years.
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
cd client && npm test && npm run build && npm run lint && npm run e2e:browser
cd ..
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/get-stimuli/index.ts supabase/functions/submit-results/index.ts supabase/functions/submit-task/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts supabase/functions/export-pdf/index.ts supabase/functions/export-csv/index.ts
node scripts/local-e2e.mjs --all-versions
```

Record skipped local E2E checks and the reason in the PR body.

For browser or UX changes, verify the affected flow in Chrome when practical.

For licensed stimulus storage or clinical-readiness changes, keep assets out of Git. Use `node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload` for local licensed visual assets when appropriate, and run `node scripts/verify-stimuli.mjs --all-versions` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` configured. Use `--visual-only` only when memory word-list audio is intentionally not part of the check.
