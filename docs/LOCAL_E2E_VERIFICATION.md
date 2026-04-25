# Local Pilot MVP E2E Verification

This checklist verifies the current Pilot MVP flow against local Supabase.

## CI Scope

GitHub CI is intentionally stable and does not start local Supabase or Playwright browser E2E. Required PR checks cover dependency install, lint, unit tests, scoring coverage thresholds, production build, and Deno type checks for Supabase Edge Functions.

Use this checklist as the required local pre-merge verification for backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, and notification changes. Record any skipped local E2E checks in the PR body.

## Prerequisites

- Node/npm for the React client.
- Deno for Supabase Edge Function type checks.
- Supabase CLI installed.
- Docker Desktop or another working Docker daemon available to the Supabase CLI.
- Google Chrome installed at `/Applications/Google Chrome.app` for Playwright/browser-agent UI checks.
- Local licensed Hebrew MoCA PDFs available at the paths expected by `scripts/local-e2e.mjs`.
- `client/.env.local` points to the local Supabase API once the stack is running:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

## Backend

From the repo root:

```bash
supabase start
supabase db reset
supabase functions serve create-session start-session get-stimuli submit-results submit-task save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review export-pdf export-csv --env-file /dev/null
```

`supabase db reset` is destructive for the local database. Use it only when local test data can be discarded.

When using Colima, the analytics/logging containers may fail to mount the Docker socket. If that happens, start without them:

```bash
supabase start -x vector,logflare
```

## Frontend

From `client/`:

```bash
npm run dev
```

Open the Vite URL in Chrome, then:

1. Go to `/dashboard`.
2. Create a local clinician account with the dashboard login form.
3. Create a session using a case ID, age band, education years, and MoCA version.
4. Copy the generated test number and enter it on the patient home page.
5. Confirm the patient assessment header displays the selected MoCA version.
6. Refresh the patient browser during an in-progress session and confirm same-device resume returns to saved progress.
7. Complete the patient flow enough to confirm task auto-save calls succeed.
8. Advance past at least one task without entering evidence and confirm it is recorded as requires-review/skipped evidence, not silently ignored.
9. Finish the assessment and confirm `complete-session` creates a provisional report.
10. Return home and confirm the completed session is no longer offered as a resumable test.
11. Return to `/dashboard/{sessionId}`, review drawing rows, save scores, and confirm the report finalizes.

## Verification Commands

The scripted local E2E flow validates the three local licensed Hebrew MoCA PDF pairs by file path and hash, then exercises the backend clinician-to-patient-to-review flow with generated local fixture answers. It also confirms the backend keeps patient test numbers single-use and that the patient stimulus manifest returns version-scoped private Storage keys for the selected MoCA version. The script does not copy or extract licensed MoCA stimuli into the repository.

From the repo root, with Supabase and Edge Functions running:

```bash
node scripts/local-e2e.mjs --all-versions
```

To verify uploaded private stimulus assets before clinical testing:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY="<local Secret value>" node scripts/verify-stimuli.mjs --all-versions
```

To run only one version:

```bash
node scripts/local-e2e.mjs --version 8.3
```

Run these before and after the manual flow:

```bash
cd client
npm test
npm run e2e:browser
npm run build
npm run lint
cd ..
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/get-stimuli/index.ts supabase/functions/submit-results/index.ts supabase/functions/submit-task/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts supabase/functions/export-pdf/index.ts supabase/functions/export-csv/index.ts
```

Expected current lint status: no errors and no warnings.

## Browser-Agent Checks

Future agents should use browser automation for UI checks when touching patient or clinician flows.

Required local setup:

- Chrome exists at `/Applications/Google Chrome.app`.
- Vite is running from `client/` with `npm run dev`.
- Supabase and Edge Functions are running locally.
- `client/.env.local` uses the local Supabase URL and anon key.

Useful browser checks:

1. Open `http://localhost:5173/#/dashboard`.
2. Create or sign in as a clinician.
3. Create a session and choose a MoCA version.
4. Enter the generated test number on the patient home page.
5. Confirm the patient header shows the selected version.
6. Refresh during a patient task and confirm same-device resume.
7. Finish and confirm the patient sees only completion.
8. Return to dashboard detail and complete clinician review.

The repeatable browser check is:

```bash
cd client
npm run e2e:browser
```

This starts or reuses Vite and expects local Supabase plus Edge Functions to already be running.

## Known Clinical Blockers

- Official licensed MoCA stimuli are still required before clinical pilot use and must not be committed to this repository.
- The local E2E script verifies the PDF files exist locally. The clinician-facing MoCA version selector stores the selected version on each session for traceability; licensed stimuli are loaded from private Storage by version/task and verified with `scripts/verify-stimuli.mjs`.
- Audio/manual tasks are supported through clinician review, but fully structured rule-based scoring is still incomplete for several tasks.
- External speech-to-text is future transcript evidence only; it must not become an automated scoring authority.
