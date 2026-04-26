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

## Update Rule

Update this file before merge when a branch does any of the following:

- fixes a recurring bug class,
- addresses review findings that produced reusable engineering lessons,
- adds a new required verification pattern, or
- reveals a repeated failure mode across multiple PRs.

Do not dump full retrospectives here. Add concise evidence, then the rule future agents should follow.
