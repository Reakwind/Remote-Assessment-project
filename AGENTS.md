# AGENTS.md

## Purpose

Operating guide for coding agents working in this repository.

## Repository map

- `client/`: main React + TypeScript app (primary CI target)
- `Skeleton Front End-2/`: secondary/reference frontend
- `supabase/`: database migrations and Edge Functions
- `docs/`: setup and planning docs

## Cursor Cloud specific instructions

### Dependency setup (run from `/workspace`)

Install dependencies for both frontend apps:

- `npm install --prefix "client" --legacy-peer-deps`
- `npm install --prefix "Skeleton Front End-2"`

### Preferred development commands

Start each app on fixed ports so parallel agent sessions remain consistent:

- `client` on port `4173`:
  - `npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173`
- `Skeleton Front End-2` on port `4174`:
  - `npm run dev --prefix "Skeleton Front End-2" -- --host 0.0.0.0 --port 4174`

### Verification commands

Use the smallest high-signal checks for the files you changed:

- For `client/` code changes:
  - `npm run lint --prefix "client"`
  - `npm run test --prefix "client"`
  - `npm run build --prefix "client"` (when build/runtime behavior is affected)
- For `Skeleton Front End-2/` code changes:
  - `npm run build --prefix "Skeleton Front End-2"`
- For docs-only changes:
  - no frontend test run required

### Editing guardrails

- Quote paths that contain spaces, such as `"Skeleton Front End-2"`.
- Prefer focused, minimal diffs; avoid unrelated refactors.
- Do not modify generated lockfiles unless dependency changes require it.

### External service write guardrail (required)

Before running any command that writes to external services, agents must:

1. Show the exact command(s) they plan to run.
2. Explain the expected side effect in one sentence.
3. Wait for explicit user approval before executing.

This guardrail applies to actions that can change remote state, including:

- Supabase (secrets, migrations, function deploys, data writes)
- Twilio / Resend API calls
- GitHub/GitLab write operations (PR edits, labels, releases, etc.)
- Any other third-party API or cloud resource mutation
