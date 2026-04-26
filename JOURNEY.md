# Journey Playbook

This is the bird's-eye journey map for the Remote Hebrew MoCA pilot MVP. Current `main` is the Pilot MVP baseline. This file is written for future AI agents and engineers so they can understand what the product is trying to do before changing code.

Use this as the compact journey authority. Keep detailed UI, database, and implementation specs in focused docs or code. When journey behavior changes, update the relevant section here and add a dated decision note at the bottom.

## MVP Guardrails

- Use a pseudonymous case ID instead of patient names or national IDs.
- Store the clinical background fields needed for interpretation: phone, date of birth, gender, language, dominant hand, and education years.
- Use clinician email/password auth for MVP.
- Clinician creates the session; patient only uses the generated test number.
- Clinician review happens after patient completion through dashboard review.
- Keep caregivers as offline support contacts outside the app journey.
- Send a clinician completion email when a patient finishes.
- Score drawings through clinician rubric review using stored drawing evidence.
- Use speech-to-text output as transcript evidence for clinician review.
- Server-side scoring is authoritative.
- Use licensed MoCA stimuli before clinical use and keep licensed assets outside the repo.

## Actors

| Actor | Role in journey | Browser/backend access |
|---|---|---|
| Clinician | Creates sessions, reviews evidence, enters manual scores, finalizes report. | Authenticated dashboard and clinician-only Edge Functions. |
| Patient | Enters test number, completes tasks, submits raw evidence, sees completion only. | Test-number start route, then token-scoped patient Edge Functions. |
| System/backend | Validates tokens, persists raw data, scores deterministic items, prepares review rows, sends completion email, records notification outcomes, audits events. | Supabase Postgres, Storage, Auth, Edge Functions. |
| Offline support contact | May help with device basics outside the app. | Offline contact only; the app journey is clinician and patient. |

## Lifecycle

| Status | Meaning | Entered by | Next |
|---|---|---|---|
| `pending` | Clinician created session; patient has not started. | `create-session` | `in_progress` |
| `in_progress` | Patient entered a valid one-time test number and started. | `start-session` | `awaiting_review` or `completed` |
| `awaiting_review` | Server scoring is provisional because drawings/manual items need clinician review. | `complete-session` | `completed` |
| `completed` | All review items are scored and final totals/norms can be shown to clinician. | `complete-session` or review update functions | Terminal for MVP |

One-time patient start semantics remain strict. Same-device resume is offered from the home page through an explicit continue button for in-progress local state; entering the same consumed test number does not auto-resume.

## Clinician Journey

| Step | Browser behavior | Backend/data behavior | Current vs target |
|---|---|---|---|
| Login | Clinician signs up or signs in with email/password and reaches `/dashboard`. | Supabase Auth validates credentials; clinician-only Edge Functions require the clinician JWT. | Current target. |
| Create case/session | Clinician creates a clinical case record with case ID, phone, birth date, gender, language, dominant hand, and education years. When opening a test, clinician chooses assessment, language, and test version. | `patients.case_id` stores the pseudonymous case ID; compatibility `patients.full_name` mirrors it. `create-session` snapshots case ID, calculated age/age band, education years, selected language/version, internal `link_token`, and patient-facing `access_code`; writes `session_created` audit event. | Current target. |
| Share test number | Clinician copies the generated test number and sends it to the patient outside the app. | `create-session` stores the patient-facing test number in `sessions.access_code`. | Current target. |
| Wait for completion | Clinician waits for a completion notification, then opens the dashboard when ready. | `complete-session` attempts clinician completion email, records a `notification_events` outcome, and audits `clinician_completion_email_*`. | Current. Email-first completion ping. |
| Review session | Clinician opens dashboard detail for completed/awaiting review session and sees stored patient evidence. | `get-session` returns task results, scoring report, drawing reviews, scoring item reviews, signed drawing/audio URLs. | Current. |
| Score manual items | Clinician scores drawings and any rule-unavailable items from the stored evidence view. | `update-drawing-review` and `update-scoring-review` persist clinician score/notes, recalculate report, write audit events. | Current. |
| Finalize | Once pending review count reaches 0, session becomes `completed`. | Final report totals and norm lookup become final; PDF export is available after finalization. CSV export is available before or after finalization and clearly indicates provisional/incomplete data may be included. | Current. |

## Patient Journey

| Step | Browser behavior | Backend/data behavior | Current vs target |
|---|---|---|---|
| Enter test number | Patient enters the clinician-provided test number on the home page. | Browser uses stored same-device session state or calls `start-session` with the test number. | Current target. |
| Start once | Valid unused test number starts the session. New local users go through the welcome/system-check screen; returning local users go directly to the first task. | `start-session` rate-limits repeated failed attempts, records hashed attempt audit rows, resolves `sessions.access_code`, atomically sets `link_used_at`, `started_at`, `status='in_progress'`; second start attempts return 410 unless local same-device state already owns the session. | Current target. |
| System check | New local users confirm Hebrew audio output and microphone access before the first task. Returning local users who already completed preflight can skip it. | Browser stores a local onboarding-complete flag; no clinical response data is created during preflight. | Current target. |
| Complete tasks | Patient progresses through Hebrew MoCA task flow with selected MoCA version visible in the assessment header. Advancing without captured evidence records a skipped/requires-review payload. | Each task result is submitted with canonical `moca-*` task IDs and active client payload shapes, and the session keeps MoCA version context. | Current. |
| Load stimuli | Patient tasks request the versioned stimulus manifest for the active session and prefer short-lived signed URLs from private Storage. | `get-stimuli` returns version-scoped asset keys and signed URLs for uploaded licensed assets. Missing assets produce an explicit development placeholder state. | Current architecture. Licensed assets remain external. |
| Draw/audio evidence | Drawing tasks save current strokes/PNG; audio tasks can save audio evidence. | Private Storage paths and stroke data are stored; clinician receives signed URLs only. | Current. External STT transcript evidence is future. |
| Autosave | Per-task submit/save should survive refresh enough for MVP testing. | `submit-results`, `save-drawing`, and `save-audio` persist evidence during `in_progress`. | Current target. Full offline-first retry queue is future hardening. |
| Finish | Patient sees a dead-end completion screen only: the test is complete and results are being sent to the referring therapist. | `complete-session` runs server scoring, creates review rows, sets status, writes audit, records notification outcome, and triggers clinician email. | Current. |

## Backend/System Map

| Function | Caller | Purpose |
|---|---|---|
| `create-session` | Clinician | Create pending session, internal session token, and patient-facing test number. |
| `start-session` | Patient | Rate-limit and validate one-time 8-digit test number, then return scoring context plus internal session token for post-start saves. |
| `get-stimuli` | Patient | Return the active MoCA version's private stimulus manifest with short-lived signed URLs. |
| `submit-results` / `submit-task` | Patient | Idempotently persist task result payloads. |
| `save-drawing` | Patient | Store drawing strokes and optional PNG in private storage/review row. |
| `save-audio` | Patient | Store audio evidence in private storage and attach path to raw data. |
| `complete-session` | Patient | Run server-side scoring, create review rows, update status, notify clinician, audit completion. |
| `get-session` | Clinician | Read session detail, report, raw results, review rows, and signed evidence URLs. |
| `update-drawing-review` | Clinician | Persist drawing score/rubric/notes and recalculate final report. |
| `update-scoring-review` | Clinician | Persist clinician score for non-drawing manual review items and recalculate final report. |

Storage buckets are private. Patient-facing stimulus access and clinician-facing review access use short-lived signed URLs. Audit events are part of the journey and should exist for create, start, stimulus manifest request, task/audio/drawing save, completion, review updates, and notification outcome. Completion emails also create a `notification_events` row so sent, skipped, and failed outcomes are observable and retry-ready.
Patient test-number starts also write hashed attempt records for operational rate limiting without storing raw test numbers or IP addresses.

## Scoring Journey

- Use deterministic rule scoring when the active test manual defines a clear rule from structured payloads.
- Send drawing tasks to clinician review with `needsReview=true` and stored drawing evidence.
- Keep audio-only speech responses in clinician rubric review until an external transcript or structured response workflow exists.
- Preserve raw data and create clinician review work for missing, malformed, ambiguous, unsupported, or unscorable payloads.
- `total_provisional=true` until all review items are scored.
- Norm percentile/SD are meaningful only after the report is final.
- Show scores, flags, and clinician notes only in the clinician dashboard.

## Current vs Target MVP

| Area | Current implementation | Target MVP | Known gap |
|---|---|---|---|
| Clinician auth | Email/password Supabase Auth gates the dashboard; old `/clinician/2fa` links redirect out of the removed MFA screen. | Clinician email/password login with backend JWT checks. | MFA, SSO, device policy, and other security hardening are future milestones. |
| Session creation | Case profile stores birth date, gender, language, dominant hand, phone, and education. Test creation stores assessment, language, version, calculated age/age band, internal session token, and generated patient test number. | Same, with standardized scoring using the session snapshot from the case profile. | Current target. |
| Patient start | One-time 8-digit test number moves session to `in_progress`; repeated failed starts are rate-limited and audited with hashed fingerprints. Same-device resume is explicit from the home-page continue button. New local users see welcome/system-check; returning local users start at the first task. | Same, with stale local state filtered out of resume controls. | Resume copy and refresh recovery can be refined. |
| Stimulus delivery | `get-stimuli` returns versioned private Storage paths and signed URLs when licensed assets are uploaded. Patient UI uses explicit development placeholders when assets are missing. | Licensed MoCA assets are uploaded to private Storage by version and task before clinical use, then validated with `scripts/verify-stimuli.mjs`. | Production asset validation should be part of release readiness. |
| Task persistence | Per-task submit, skipped-task review payloads, drawings, audio evidence. | Reliable autosave for every task; refresh preserves saved progress in normal use. | Full offline retry queue remains future hardening. |
| Drawing review | Clinician dashboard reads stored drawing/audio evidence, signed URLs, and review rows from `get-session`; score updates persist through review functions. | Clinician rubric scoring from stored evidence. | Rubric UX can be refined for clinical ergonomics. |
| Rule scoring | Server-side scoring selects an explicit `8.1`, `8.2`, or `8.3` MoCA config and preserves version in the scoring report. | Version-aware deterministic scoring by active test manual. | Some tasks still require more structured payloads and licensed manual validation before clinical use. |
| Completion notification | Email outcome via Resend when configured; sent/skipped/failed outcome is stored in `notification_events` and audited. | Email-first clinician ping when test is done, with retry-ready failure records. | Dedicated retry worker and production sender monitoring are future hardening. |
| Dashboard review | Real session list/detail, review updates, finalized PDF export, and CSV export for completed or incomplete/provisional data. | Efficient clinician review, finalization, and clearly labeled exports. | Export templates can be refined for clinical formatting. |
| Patient start code | Generated test number exists; clinician copies it and sends it outside the app. | Patient enters the test number on the home page and starts once. | SMS/link delivery can be reconsidered after MVP. |
| STT | Audio evidence storage exists. | External STT creates transcript evidence only. | Vendor/job model and clinician transcript editing are future. |

## Parking Lot

- Clinic-branded PDF templates and richer CSV/report export fields.
- Full offline-first browser queue and retry reconciliation.
- External speech-to-text job model, transcript review/editing, and privacy review.
- Optional future SMS/link delivery provider abstraction, message templates, delivery status, and retry handling.
- Production release checklist for licensed stimulus validation.
- Arabic/Russian/English future batteries.
- Report comparison across prior sessions.
- Clinician MFA, SSO, session policy, and device/session hardening.

## Decision Log

- 2026-04-25: Root `JOURNEY.md` becomes the single journey-level authority. Exported prototype/handoff directories stay removed.
- 2026-04-25: MVP centers on asynchronous clinician review, offline caregiver support, completion email pings, and clinician-scored drawings.
- 2026-04-25: Clinician finalization is MVP; PDF/CSV export is next milestone.
- 2026-04-25: MoCA version must become explicit session context; case ID remains the patient identity model.
- 2026-04-25: Session creation stores selected MoCA version (`8.1`, `8.2`, or `8.3`) for traceability.
- 2026-04-25: Same-device patient resume uses locally stored in-progress session state while backend test-number starts stay single-use.
- 2026-04-25: Patient assessment header shows selected MoCA version and completed sessions clear local resume state after returning home.
- 2026-04-25: Patient navigation records explicit skipped-task payloads for tasks advanced without captured evidence, so clinician review sees all visited tasks.
- 2026-04-25: PDF export is available only after clinician finalization; CSV export uses modern report fields.
- 2026-04-25: Clinician dashboard detail review uses backend `get-session` evidence, signed URLs, and review update functions instead of local patient-browser assessment state.
- 2026-04-25: Patient start consumes links atomically; drawing saves send current strokes with PNG evidence; naming scoring accepts the active client answers object.
- 2026-04-25: Completion emails write `notification_events` records for sent, skipped, and failed outcomes so notification delivery is observable and retry-ready.
- 2026-04-25: Same-device patient resume works from the original test number, filters stale local state, and shows the active MoCA version in the patient header.
- 2026-04-25: Patient SMS delivery is removed from active MVP scope; clinicians share the generated test number outside the app.
- 2026-04-25: Scoring now uses explicit per-version MoCA config for `8.1`, `8.2`, and `8.3`; licensed stimuli remain outside the repo.
- 2026-04-25: Patient stimulus delivery uses a versioned private Storage manifest and short-lived signed URLs; missing licensed assets show development placeholders.
- 2026-04-25: Licensed stimulus readiness is verified through `scripts/verify-stimuli.mjs` and `docs/STIMULI_ASSET_RUNBOOK.md`.
- 2026-04-25: Clinician MFA is deferred from the MVP; email/password auth is the active clinician login model.
- 2026-04-25: Session place/city are legacy optional fields and are no longer part of MVP session creation.
- 2026-04-25: Current `main` after the clinician email/password and test-number flow is the Pilot MVP baseline; future changes proceed feature by feature from current `origin/main` through reviewed PRs.
- 2026-04-25: Active case creation collects clinical background fields for interpretation. Sessions snapshot calculated age, education, language, gender, and dominant hand from the case profile when the test is created.
- 2026-04-25: Patient starts require the generated 8-digit test number; internal link tokens are used only after start for patient save/complete calls.
- 2026-04-25: Naming items are version-specific for MoCA 8.1, 8.2, and 8.3. Licensed visual stimuli are extracted from local licensed PDFs into private Storage with `scripts/upload-stimuli-from-pdfs.mjs`; extracted assets stay out of Git.
- 2026-04-25: Audio recordings persist with explicit storage paths in task evidence. Clinician review receives signed audio URLs, including evidence-only audio rows for no-score tasks.
- 2026-04-26: Patient test-number starts are rate-limited and audited with hashed fingerprints; raw test numbers and IP addresses are not stored in attempt logs.
- 2026-04-26: Patient flow requires Hebrew audio and microphone preflight before task start; naming feedback is neutral during the test; audio-only speech tasks remain clinician-rubric review until structured transcript evidence exists.
- 2026-04-26: Welcome/system-check is a local first-use gate only. Resume happens from the explicit home-page continue button; patient completion is a dead-end screen that says results are being sent to the referring therapist. CSV export can include incomplete/provisional data with inline feedback.
