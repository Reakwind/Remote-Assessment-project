# Agent Instructions

Read [README.md](README.md) before making product, backend, scoring, or UX changes.

## Source Of Truth

Canonical files:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [CONTEXT.md](CONTEXT.md)
5. [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md)

`JOURNEY.md` is the patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.

## Required GitHub Workflow

Every agent must use branch-based version control.

- Start by checking `git status --short --branch`, `git branch --show-current`, and `git remote -v`.
- Do not work directly on `main`.
- Start new work from latest `origin/main`.
- Use a feature branch, preferably `codex/<short-scope>`.
- Keep unrelated dirty work intact.
- Do not reset, delete, or rewrite user work unless the user explicitly requests it.
- Make focused commits after verification passes.
- Push the branch and open a PR into `main`.
- Do not merge to `main` unless the user explicitly asks for the merge.
- List verification performed and skipped checks in the PR or handoff.

Generated local artifacts stay out of Git: `.env.local`, `.playwright-mcp/`, `client/test-results/`, `client/playwright-report/`, `node_modules/`, and `dist/`.

## Product Guardrails

- Build the asynchronous clinician-review flow.
- Keep caregiver/support contact usage offline for MVP.
- Store raw drawing/audio/task evidence for clinician review.
- Use deterministic scoring only where the active test manual supports it.
- Route drawings and ambiguous/manual items to clinician review.
- Use external speech-to-text as transcript evidence only.
- Notify clinicians when a patient completes a test.
- Use Twilio as the MVP SMS default behind a provider abstraction.
- Keep licensed MoCA stimuli outside the repository.

## Verification

Before handing off backend/scoring changes, run:

```bash
cd client && npm test && npm run e2e:browser && npm run build && npm run lint
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/submit-results/index.ts supabase/functions/submit-task/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts
node scripts/local-e2e.mjs --all-versions
```

For browser or UX changes, verify the affected flow in Chrome when practical.
