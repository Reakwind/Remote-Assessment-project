# Remote Assessment Project

Remote Hebrew MoCA pilot MVP.

The active product direction is simple: a clinician creates a session link, a patient completes the assessment, raw task/drawing/audio evidence is persisted, deterministic rule scoring is applied where supported by the active test manual, and the clinician reviews/finalizes anything requiring judgment.

## Source Of Truth

Read these first:

1. [README.md](README.md)
2. [AGENTS.md](AGENTS.md)
3. [JOURNEY.md](JOURNEY.md)
4. [CONTEXT.md](CONTEXT.md)
5. [docs/LOCAL_E2E_VERIFICATION.md](docs/LOCAL_E2E_VERIFICATION.md)

`JOURNEY.md` is the bird's-eye patient/clinician journey authority. Update it when browser, backend, status, scoring, notification, or review behavior changes.

## Required GitHub Workflow

- `main` is the integration branch.
- Do not work directly on `main`.
- Start every task from latest `origin/main`.
- Use a feature branch, preferably `codex/<short-scope>`.
- Keep commits focused and open a PR into `main`.
- Run relevant checks before pushing or opening a PR.
- Merge only after explicit user approval.

## MVP Scope

- Clinician login, session creation, dashboard list/detail, drawing/manual review, finalization.
- Patient session start by link/code, Hebrew MoCA flow, autosave, completion.
- Supabase persists sessions, task results, drawings, audio evidence, scoring reports, and audit events.
- Server-side scoring is authoritative.
- Drawings and ambiguous/manual items go to clinician review.
- Clinician gets an email when a test is completed.
- Patient SMS uses Twilio first, behind a provider abstraction.

## Guardrails

- Build the asynchronous clinician-review workflow.
- Keep caregiver/support contact usage offline for MVP.
- Store raw drawing/audio/task evidence for clinician review.
- Use deterministic scoring only where the active manual supports it.
- Use external speech-to-text only as transcript evidence.
- Send completion notifications when a test is done.
- Keep licensed MoCA assets outside the repository.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind/Radix UI.
- Backend: Supabase Postgres/Auth/Storage/Edge Functions on Deno.
- Local verification: Supabase CLI plus `scripts/local-e2e.mjs`.

## Repo Map

- `client/` - active frontend.
- `supabase/` - active migrations and Edge Functions.
- `scripts/` - local automation and E2E verification.
- `JOURNEY.md` - patient/clinician browser + backend journey playbook.
- `docs/LOCAL_E2E_VERIFICATION.md` - local end-to-end test instructions.
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
supabase functions serve create-session start-session submit-results submit-task save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review --env-file /dev/null
node scripts/local-e2e.mjs --all-versions
```
