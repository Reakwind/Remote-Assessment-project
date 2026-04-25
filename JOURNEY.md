# Journey Playbook

This is the bird's-eye journey map for the Remote Hebrew MoCA pilot MVP. It is written for future AI agents and engineers so they can understand what the product is trying to do before changing code.

Use this as the compact journey authority. Keep detailed UI, database, and implementation specs in focused docs or code. When journey behavior changes, update the relevant section here and add a dated decision note at the bottom.

## MVP Guardrails

- Use case ID as the only patient identifier in app data.
- Clinician creates the session; patient only uses the generated link/code.
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
| Patient | Opens link, completes tasks, submits raw evidence, sees completion only. | Token-scoped patient routes and patient Edge Functions. |
| System/backend | Validates tokens, persists raw data, scores deterministic items, prepares review rows, sends completion email, audits events. | Supabase Postgres, Storage, Auth, Edge Functions. |
| Offline support contact | May help with device basics outside the app. | Offline contact only; the app journey is clinician and patient. |

## Lifecycle

| Status | Meaning | Entered by | Next |
|---|---|---|---|
| `pending` | Clinician created session; patient has not started. | `create-session` | `in_progress` |
| `in_progress` | Patient opened valid one-time token and started. | `start-session` | `awaiting_review` or `completed` |
| `awaiting_review` | Server scoring is provisional because drawings/manual items need clinician review. | `complete-session` | `completed` |
| `completed` | All review items are scored and final totals/norms can be shown to clinician. | `complete-session` or review update functions | Terminal for MVP |

One-time start-token semantics remain strict. Target resume behavior uses same-device resume for an in-progress session while keeping the original start token single-use.

## Clinician Journey

| Step | Browser behavior | Backend/data behavior | Current vs target |
|---|---|---|---|
| Login | Clinician signs into `/dashboard`. | Supabase Auth identifies clinician. | Current target. |
| Create session | Clinician enters case ID, MoCA version, age band, education years, place, city. | `create-session` creates `sessions` row with `pending` status, `moca_version`, and `link_token`; writes `session_created` audit event. | Current target. |
| Share link/code | Clinician copies/generated patient URL or sends it through clinic workflow. | Target SMS provider is Twilio behind a swappable provider interface. | Current supports generated URL. SMS provider abstraction is future hardening. |
| Wait for completion | Clinician waits for a completion notification, then opens the dashboard when ready. | `complete-session` attempts clinician completion email and audits `clinician_completion_email_*`. | Current. Email-first completion ping. |
| Review session | Clinician opens dashboard detail for completed/awaiting review session. | `get-session` returns task results, scoring report, drawing reviews, scoring item reviews, signed drawing/audio URLs. | Current. |
| Score manual items | Clinician scores drawings and any rule-unavailable items. | `update-drawing-review` and `update-scoring-review` persist clinician score/notes, recalculate report, write audit events. | Current. |
| Finalize | Once pending review count reaches 0, session becomes `completed`. | Final report totals and norm lookup become final. | Current. PDF/CSV export is next milestone. |

## Patient Journey

| Step | Browser behavior | Backend/data behavior | Current vs target |
|---|---|---|---|
| Open link | Patient opens `/#/session/{token}`. | Browser uses stored same-device session state or calls `start-session` for a new token. | Current. |
| Start once | Valid unused token starts session; same-device resume returns patient to saved progress. | `start-session` sets `link_used_at`, `started_at`, `status='in_progress'`; second start attempts return 410. | Current. |
| Complete tasks | Patient progresses through Hebrew MoCA task flow with selected MoCA version visible in the assessment header. Advancing without captured evidence records a skipped/requires-review payload. | Each task result is submitted with canonical `moca-*` task IDs and the session keeps MoCA version context. | Current target for traceability. |
| Draw/audio evidence | Drawing tasks save strokes/PNG; audio tasks can save audio evidence. | Private Storage paths are stored; clinician receives signed URLs only. | Current. External STT transcript evidence is future. |
| Autosave | Per-task submit/save should survive refresh enough for MVP testing. | `submit-results`, `save-drawing`, and `save-audio` persist evidence during `in_progress`. | Current target. Full offline-first retry queue is future hardening. |
| Finish | Patient sees a completion screen only; returning home clears completed local resume state. | `complete-session` runs server scoring, creates review rows, sets status, writes audit, triggers clinician email outcome. | Current. |

## Backend/System Map

| Function | Caller | Purpose |
|---|---|---|
| `create-session` | Clinician | Create pending session and patient link token. |
| `start-session` | Patient | Validate one-time token and return scoring context. |
| `submit-results` / `submit-task` | Patient | Idempotently persist task result payloads. |
| `save-drawing` | Patient | Store drawing strokes and optional PNG in private storage/review row. |
| `save-audio` | Patient | Store audio evidence in private storage and attach path to raw data. |
| `complete-session` | Patient | Run server-side scoring, create review rows, update status, notify clinician, audit completion. |
| `get-session` | Clinician | Read session detail, report, raw results, review rows, and signed evidence URLs. |
| `update-drawing-review` | Clinician | Persist drawing score/rubric/notes and recalculate final report. |
| `update-scoring-review` | Clinician | Persist clinician score for non-drawing manual review items and recalculate final report. |

Storage buckets are private. Browser-facing review access uses short-lived signed URLs. Audit events are part of the journey and should exist for create, start, task/audio/drawing save, completion, review updates, and notification outcome.

## Scoring Journey

- Use deterministic rule scoring when the active test manual defines a clear rule from structured payloads.
- Send drawing tasks to clinician review with `needsReview=true` and stored drawing evidence.
- Preserve raw data and create clinician review work for missing, malformed, ambiguous, unsupported, or unscorable payloads.
- `total_provisional=true` until all review items are scored.
- Norm percentile/SD are meaningful only after the report is final.
- Show scores, flags, and clinician notes only in the clinician dashboard.

## Current vs Target MVP

| Area | Current implementation | Target MVP | Known gap |
|---|---|---|---|
| Session creation | Case ID, MoCA version, age band, education, location, generated link token. | Same, with MoCA version visible in clinician and patient workflow and preserved for reporting. | Version-specific scoring/stimulus policy still needs deeper implementation. |
| Patient start | One-time token moves session to `in_progress`; same-device resume uses stored in-progress state. | Same, with clearer resume UX and stale-state cleanup. | Resume UX can be improved. |
| Task persistence | Per-task submit, skipped-task review payloads, drawings, audio evidence. | Reliable autosave for every task; refresh preserves saved progress in normal use. | Full offline retry queue remains future hardening. |
| Drawing review | Manual drawing review rows and signed URLs. | Clinician rubric scoring from stored evidence. | Rubric UX can be improved. |
| Rule scoring | Server-side scoring for supported structured tasks. | Version-aware deterministic scoring by active test manual. | Some tasks still require more structured payloads/version-specific rules. |
| Completion notification | Email outcome via Resend when configured; skipped outcome audited locally. | Email-first clinician ping when test is done. | Production sender/config and retry policy need hardening. |
| Dashboard review | Real session list/detail and review updates. | Efficient clinician review, finalization, then export. | PDF/CSV export is next milestone. |
| SMS | Generated link exists; Twilio is direction. | Twilio-first patient SMS behind provider abstraction. | Provider interface and message lifecycle not fully built. |
| STT | Audio evidence storage exists. | External STT creates transcript evidence only. | Vendor/job model and clinician transcript editing are future. |

## Parking Lot

- PDF/CSV export after clinician finalization.
- Full offline-first browser queue and retry reconciliation.
- External speech-to-text job model, transcript review/editing, and privacy review.
- Twilio provider abstraction, message templates, delivery status, and retry handling.
- Version-specific scoring/stimulus policy beyond storing selected MoCA version.
- Arabic/Russian/English future batteries.
- Report comparison across prior sessions.

## Decision Log

- 2026-04-25: Root `JOURNEY.md` becomes the single journey-level authority. Exported prototype/handoff directories stay removed.
- 2026-04-25: MVP centers on asynchronous clinician review, offline caregiver support, completion email pings, and clinician-scored drawings.
- 2026-04-25: Clinician finalization is MVP; PDF/CSV export is next milestone.
- 2026-04-25: MoCA version must become explicit session context; case ID remains the patient identity model.
- 2026-04-25: Session creation stores selected MoCA version (`8.1`, `8.2`, or `8.3`) for traceability.
- 2026-04-25: Same-device patient resume uses locally stored in-progress session state while backend start tokens stay single-use.
- 2026-04-25: Patient assessment header shows selected MoCA version and completed sessions clear local resume state after returning home.
- 2026-04-25: Patient navigation records explicit skipped-task payloads for tasks advanced without captured evidence, so clinician review sees all visited tasks.
