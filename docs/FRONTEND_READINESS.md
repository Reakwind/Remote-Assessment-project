# Frontend Readiness

This guide is the implementation-facing frontend quality bar for the patient PWA and clinician operations app. It is separate from the local rehearsal gate: the rehearsal proves the full stack locally, while this guide defines what the frontend must make clear and usable.

## Priorities

1. Pilot usability.
2. Reliability and debuggability.
3. Agent-proof structure.

## Patient PWA

- Keep the MoCA task order, one-time test-number semantics, same-device resume model, and backend contracts stable.
- Use a consistent task shell with progress, task title, concise instructions, evidence area, save/retry state, and safe navigation.
- Make drawing and audio failures visible, specific, and recoverable before the patient can move on.
- Keep phone fallback usable and preserve device context for clinician interpretation.
- Installed iPad PWA testing is required for pilot readiness.

## Clinician Operations App

- Optimize for desktop/laptop clinical operations.
- Separate actionable work queues from passive history.
- Keep one primary action per screen and avoid duplicate create, copy, finalize, or export controls in the same context.
- Make review status, pending count, provisional data, finalization, and export availability visible before the clinician clicks.
- Evidence and scoring should feel like a workbench, not a long form.

## Shared Foundation

- Reuse visible states for loading, empty, blocked, saving, saved, retryable error, queued, offline, and completed.
- Keep patient and clinician surface boundaries explicit.
- Add tokens or shared components only when they remove real repeated behavior or make future tuning safer.
- Keep responsive rules different by surface: patient tablet/phone-first, clinician laptop/desktop-first.

## Verification Matrix

These checks are additive to the required baseline in `AGENTS.md`, `docs/DEVELOPMENT_PROCESS.md`, and `docs/CI_CD_AGENT_RUNBOOK.md`. Do not use this matrix to skip `npm run lint`, `npm run build`, or required local Supabase/browser E2E. Patient start, save, complete, storage, review, scoring, and export changes still require the full local contract checks described in `docs/LOCAL_E2E_VERIFICATION.md`.

| Change area | Required checks |
| --- | --- |
| Patient task shell or save state | `cd client && npm test`, `npm run e2e:browser`, iPad installed-PWA manual check |
| Drawing or audio recovery | Focused component tests, `npm run e2e:browser`, local rehearsal gate |
| Clinician work queue or detail | Focused component tests, clinician desktop/laptop walkthrough |
| Surface routing or assets | `npm run build:surfaces`, `npm run verify:surface-builds`, `npm run e2e:patient-pwa` |

Record skipped device, viewport, browser, or local rehearsal checks in the PR with the reason.
