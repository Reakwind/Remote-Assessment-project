# Local Pilot MVP E2E Verification

This checklist verifies the current Pilot MVP flow against local Supabase.

## CI Scope

GitHub CI runs the required baseline plus full local contract E2E: dependency install, lint, unit tests, scoring coverage thresholds, production build, Deno type checks, Edge Function unit tests, scripted local Supabase E2E, and Playwright browser E2E.

Use this checklist as the required local pre-merge verification for backend, session-flow, patient-flow, dashboard, scoring, review, export, storage, notification, and clinical-readiness changes. CI may skip licensed PDF file validation because licensed MoCA PDFs must stay outside GitHub-hosted runners. Record any skipped local E2E checks in the PR body.

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
supabase functions serve create-session start-session get-stimuli submit-results save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review export-pdf export-csv --env-file /dev/null
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
3. Create a case using a pseudonymous case ID plus phone, birth date, gender, language, dominant hand, and education years.
4. Create a session by choosing assessment, language, and MoCA version.
5. Copy the generated test number and enter it on the patient home page.
6. For a first-use local patient browser, confirm the welcome/system-check page appears and requires Hebrew audio plus microphone checks before the first task.
7. For a returning local patient browser with preflight already completed, confirm a new valid test number starts at the first task.
8. Refresh the patient browser during an in-progress session, return home, and confirm same-device resume happens only after pressing the continue-test button.
9. Confirm the patient assessment header displays the selected MoCA version.
10. Complete the patient flow enough to confirm task auto-save calls succeed.
11. Advance past at least one task without entering evidence and confirm it is recorded as requires-review/skipped evidence, not silently ignored.
12. Finish the assessment and confirm the patient sees only the dead-end completion screen saying results are being sent to the referring therapist.
13. Return home and confirm the completed session is no longer offered as a resumable test.
14. Return to `/dashboard/{sessionId}`, review drawing rows, save scores, and confirm the report finalizes.
15. Confirm CSV export works before finalization only after the clinician confirms the sensitive/provisional data warning, then shows inline feedback; PDF export remains unavailable until finalization.

## Verification Commands

The scripted local E2E flow validates the three local licensed Hebrew MoCA PDF pairs by file path and hash, then exercises the backend clinician-to-patient-to-review flow with generated local fixture answers. It also confirms repeat tests can be ordered for the same case, incomplete/provisional sessions can be exported to CSV, patient test numbers stay single-use, patient stimulus manifests return version-scoped private Storage keys, anonymous storage reads are denied, and other clinicians cannot read, review, or export a session they do not own. The script does not copy or extract licensed MoCA stimuli into the repository.

From the repo root, with Supabase and Edge Functions running:

```bash
node scripts/local-e2e.mjs --all-versions
```

To extract and upload visual stimuli from the local licensed PDFs into private local Storage:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY="<local Secret value>" node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY="<local Secret value>" node scripts/verify-stimuli.mjs --all-versions
```

Memory learning uses generated Hebrew speech in the browser, so there is no licensed memory MP3 to upload.

To verify uploaded private stimulus assets before clinical testing:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY="<local Secret value>" node scripts/verify-stimuli.mjs --all-versions
```

To run only one version:

```bash
node scripts/local-e2e.mjs --version 8.3
```

For CI-only or non-clinical local contract checks where licensed PDFs are intentionally unavailable:

```bash
node scripts/local-e2e.mjs --all-versions --skip-licensed-pdf-check
```

Do not use `--skip-licensed-pdf-check` to claim clinical-readiness validation.

Run these before and after the manual flow:

```bash
cd client
npm test
npm run e2e:browser
npm run build
npm run lint
cd ..
deno check --frozen supabase/functions/complete-session/index.ts supabase/functions/create-session/index.ts supabase/functions/start-session/index.ts supabase/functions/get-stimuli/index.ts supabase/functions/submit-results/index.ts supabase/functions/save-drawing/index.ts supabase/functions/save-audio/index.ts supabase/functions/get-session/index.ts supabase/functions/update-drawing-review/index.ts supabase/functions/update-scoring-review/index.ts supabase/functions/export-pdf/index.ts supabase/functions/export-csv/index.ts
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
5. Confirm first-use local browsers see welcome/system-check, and returning local browsers start at the first task.
6. Confirm the patient header shows the selected version.
7. Refresh during a patient task, return home, and confirm same-device resume only after pressing continue.
8. Finish and confirm the patient sees only the dead-end completion screen.
9. Return to dashboard detail, confirm the CSV warning step and inline feedback, and complete clinician review.

The repeatable browser check is:

```bash
cd client
npm run e2e:browser
```

This starts or reuses Vite and expects local Supabase plus Edge Functions to already be running.

## Known Clinical Blockers

- Official licensed MoCA visual stimuli are still required before clinical pilot use and must not be committed to this repository.
- The local E2E script verifies the PDF files exist locally. The clinician-facing MoCA version selector stores the selected version on each session for traceability; licensed visual stimuli are loaded from private Storage by version/task and verified with `scripts/verify-stimuli.mjs`. Memory learning uses generated Hebrew speech rather than a licensed MP3.
- Audio/manual tasks are supported through clinician review, but fully structured rule-based scoring is still incomplete for several tasks.
- External speech-to-text is future transcript evidence only; it must not become an automated scoring authority.
