# Agent Learnings

This file captures durable lessons from recent PRs, review findings, and repeated fixes so future agents can avoid rediscovering the same problems.

Use this file for compressed operational guidance, not raw history. Keep evidence anchored to concrete PRs, commits, or review follow-up docs, then translate that evidence into rules and required verification.

## Current Skill Priorities

### 1. Model patient session flow explicitly

Evidence:

- PR `#60` fixed patient start and completion routing.
- PR `#61` fixed UX QA blockers across the patient flow.
- PR `#62` hardened patient start reliability.
- PR `#63` hardened patient validity UX.
- The same surface was revisited repeatedly in `client/src/app/components/AssessmentLayout.tsx` and `client/src/app/store/AssessmentContext.tsx`.

Rules:

- Before changing patient start, resume, autosave, completion, or invalid-session behavior, write the explicit states and allowed transitions first.
- Patient evidence saves should enter the local retry queue before backend sync. Completion must flush queued evidence and stop on save errors so the clinician never reviews a session that the patient browser already knows is missing task, drawing, or audio data.
- Treat routing, resume, and completion as one lifecycle, not independent fixes.
- Prefer reducing implicit state spread across components over adding another patch-level conditional.

Required verification:

- Resume after refresh.
- Invalid or expired session handling.
- Completion routing.
- Mobile viewport checks for the touched patient flow.

### 2. Threat-model Edge Function boundaries before implementation

Evidence:

- PR `#59` hardened backend session media access.
- PR `#62` added patient-start rate limiting and attempt auditing.
- `docs/plans/2026-04-26-security-reliability-backlog.md` records recurring review findings around CORS, notification durability, storage verification, and schema guardrails.

Rules:

- Define abuse cases before changing `create-session`, `start-session`, `get-session`, media access, or notification flows.
- Check the smallest allowed scope for storage paths, signed URLs, bearer tokens, and session lookup data.
- Record durable failure outcomes when external or asynchronous work can fail.

Required verification:

- One test per abuse case or boundary constraint.
- Deno type check for touched functions.
- Local Supabase/browser E2E when the change affects session, storage, review, or notification behavior.

### 3. Convert escaped bugs into permanent E2E templates

Evidence:

- PR `#55` added Playwright regressions for audio review security after the bug class had already escaped.
- PRs `#57`, `#61`, and `#63` were UX hardening follow-ups rather than first-pass stable behavior.

Rules:

- When QA or review finds a real regression, add a targeted browser regression for that bug class in the same branch.
- Write tests around failure modes and role boundaries, not only around happy-path screens.
- Reuse existing regression patterns before inventing new test structure.

Required verification:

- Cover the exact escaped bug class.
- Re-run nearby affected clinician/patient flow regressions.

### 4. Keep client preview scoring aligned with server authority

Evidence:

- PR `#63` added vigilance tap-count scoring coverage.
- PR `#62` clamped client preview scoring where the server already clamped.

Rules:

- Do not let client preview scoring drift from authoritative server scoring.
- Prefer shared rule definitions or mirrored test vectors when logic must exist on both sides.
- When deterministic scoring rules change, inspect both `client/src/lib/scoring` and `supabase/functions/_shared/scoring.ts`.

Required verification:

- Client and server test coverage for changed rules.
- Explicit review of manual-review fallbacks for unsupported or ambiguous inputs.

### 5. Keep Edge Function contracts single-named

Evidence:

- PR `#74` removed the legacy task-submit alias so patient task persistence uses canonical `submit-results` everywhere.

Rules:

- Do not keep two Edge Function routes for one app contract unless there is a documented compatibility window.
- When removing an alias, update client calls, CI Deno checks, local E2E commands, hosted deployment docs, and journey docs in the same branch.
- Prefer canonical names from `JOURNEY.md` over local convenience aliases.

Required verification:

- `rg` confirms the removed route name is absent from active code/docs.
- Deno type checks use only existing function entrypoints.
- Browser/local E2E exercises the canonical endpoint.

### 6. Treat Hebrew clinical copy as product behavior

Evidence:

- The 2026-04-26 UX/copy audit found task-label drift, status-label drift, provisional scores shown as final, and patient task instructions that could leak answers or promise unavailable cues.

Rules:

- Read `docs/HEBREW_TERMINOLOGY.md` before changing patient or clinician UI copy.
- Use `StatusPill` for lifecycle labels instead of local status maps.
- Do not render patient `full_name` as a fallback identity; use case ID or a safe record/session identifier.
- Patient-facing task copy must not reveal expected answers, target counts, or unavailable flows.
- Label provisional scores or show only final scores.

Required verification:

- Update affected text assertions in component tests.
- Search touched surfaces for avoided terms listed in `docs/HEBREW_TERMINOLOGY.md`.

### 7. Treat the patient side as a PWA surface

Evidence:

- The 2026-04-27 product direction decision selected a split surface model: clinician website plus tablet/phone-first patient PWA.
- Patient QA showed the desktop-browser framing worked against the assessment experience, especially where drawing/touch/stylus use should feel closer to pen and paper.
- `docs/PATIENT_PWA_ARCHITECTURE.md` is now the authority for patient PWA deployment, caching, and surface boundaries.

Rules:

- Do not treat patient routes as a generic desktop website. Patient UX should be tablet/phone-first and optimized for focused touch/stylus assessment.
- Keep clinician review, scoring, export, and case management as website workflows unless a separate product decision changes that.
- Before changing patient installability, service-worker behavior, deployment split, mobile/tablet layout, or drawing UX, read `docs/PATIENT_PWA_ARCHITECTURE.md`.
- Cache only static app-shell assets in the PWA. Do not cache patient evidence, PHI, Supabase API responses, signed URLs, or exports.

Required verification:

- Phone portrait viewport check.
- Tablet portrait and landscape viewport checks.
- Installed PWA/home-screen mode check before clinical pilot.
- Local Supabase E2E when patient start, save, complete, storage, review, scoring, or export contracts are touched.

### 8. Keep the MoCA stimulus manifest visual-only

Evidence:

- The 2026-04-26 Chrome QA pass confirmed memory learning should use generated Hebrew browser speech, not an uploaded licensed MP3.

Rules:

- Do not add `moca-memory-learning/word-list-audio.mp3` back to the required private stimulus manifest.
- Keep `scripts/verify-stimuli.mjs --all-versions` focused on the licensed visual stimuli listed in `docs/STIMULI_ASSET_RUNBOOK.md`.
- Patient memory learning should use generated Hebrew speech through the in-browser listen flow and still capture the patient's spoken response as audio evidence for clinician review.

Required verification:

- `node scripts/verify-stimuli.mjs --all-versions` should pass once visual assets are uploaded.
- Browser testing should confirm Hebrew audio preflight and memory recording work in Chrome.

### 9. Treat email-confirmation signup as unauthenticated until a session exists

Evidence:

- The clinician signup RLS fix handled Supabase returning an Auth user without a browser session, then the client attempting to write `clinicians` and hitting RLS.

Rules:

- Do not depend on client-side inserts for Auth-owned profile rows when signup can require email confirmation.
- Create or backfill profile rows from `auth.users` with a database trigger using signup metadata, then let signed-in clients update their own profile through normal RLS.
- In client auth code, only perform browser profile writes when Supabase returns an active session.

Required verification:

- Unit test the no-session signup path so it does not call the profile table.
- Locally apply the migration and smoke-test that inserting an Auth user creates the profile row.

### 10. Hosted shell smoke is not hosted backend readiness

Evidence:

- Hosted Netlify smoke passed while hosted Edge Function CORS still returned the localhost origin for the clinician and patient Netlify origins.
- The clinician could create a patient through Supabase client APIs, but opening a test failed in the browser as `Load failed` before `create-session` returned JSON.

Rules:

- For hosted patient/clinician QA, verify Edge Function CORS from the actual hosted origins, not just HTTPS, manifest, service worker, and routing.
- Keep `ALLOWED_ORIGINS` in hosted Supabase secrets aligned with active clinician and patient hosts.
- Browser-facing function failures should render actionable product copy instead of raw fetch errors.

Required verification:

- Hosted smoke must include preflight checks for `create-session` from the clinician host and `start-session` from the patient host.
- After changing hosted origins or Supabase project links, rerun `npm run e2e:hosted-pwa` with `HOSTED_SUPABASE_URL`, `PATIENT_STAGING_URL`, and `CLINICIAN_STAGING_URL`.

### 11. Keep full local E2E in CI without leaking licensed assets

Evidence:

- The full-E2E QA branch moved Edge Function unit tests, scripted local Supabase E2E, and Playwright browser E2E into GitHub CI.
- Licensed MoCA PDFs remain local-only clinical materials and cannot be required on GitHub-hosted runners.

Rules:

- Keep CI coverage broad enough to exercise clinician signup, patient creation, session creation, patient submission, clinician review, exports, storage access denial, and cross-clinician isolation.
- Use `--skip-licensed-pdf-check` only for CI or non-clinical local contract checks where licensed PDFs are intentionally unavailable.
- Do not treat CI's skipped licensed PDF validation as clinical-readiness evidence. Clinical-readiness work still needs local licensed PDF validation, uploaded private Storage stimulus verification, and real device/PWA checks when relevant.

Required verification:

- `deno test` for Edge Function/shared logic.
- `node scripts/local-e2e.mjs --all-versions --skip-licensed-pdf-check` in CI.
- `npm run e2e:browser` in CI after local Supabase and Edge Functions are running.
- Local clinical-readiness runs without `--skip-licensed-pdf-check` before pilot evidence collection.

### 12. Separate bulk success-flow QA from abuse/rate-limit probes

Evidence:

- A 50-patient bulk local QA run showed that repeated invalid or reused patient test-number starts can trip the IP-based start-session limiter and then block later valid starts from the same local source.
- The same run also showed transient local Edge runtime failures such as `WorkerAlreadyRetired` and upstream `502` during otherwise valid save/review calls.

Rules:

- Use `scripts/bulk-flow-qa.mjs` for high-volume local data-flow QA and keep each run under a unique batch prefix.
- Use `--negative-starts` only for sampled start-number abuse checks, not for every generated session in a bulk success-flow matrix.
- After any bulk run, use `node scripts/bulk-flow-qa.mjs --report-batch <batch>` and `node scripts/bulk-flow-qa.mjs --cleanup-batch <batch>` so fictitious patients, clinicians, evidence rows, storage objects, and auth rows do not pollute later QA.
- Browser clients should retry transient Edge runtime failures, but must not retry validation, authorization, or clinical data errors.

Required verification:

- Run a small bulk preflight such as `node scripts/bulk-flow-qa.mjs --batch FLOWPRE --patients 1 --clinicians 1 --tests-per-patient 3 --concurrency 1`.
- Confirm `--report-batch` and `--cleanup-batch` both work for the test batch.

## Update Rule

Update this file before merge when a branch does any of the following:

- fixes a recurring bug class,
- addresses review findings that produced reusable engineering lessons,
- adds a new required verification pattern, or
- reveals a repeated failure mode across multiple PRs.

Do not dump full retrospectives here. Add concise evidence, then the rule future agents should follow.
