# Patient PWA Architecture

This document is the source of truth for the selected product direction: **the clinician surface is a website, and the patient surface is a tablet/phone-first Progressive Web App (PWA).**

Future developers and AI agents should not treat the patient journey as a desktop website. Patient UX, QA, and deployment work must assume touch/stylus devices first.

Use `docs/PATIENT_PWA_TRACKER.md` as the shared implementation tracker for milestones, owners, status, and acceptance checks.

## Decision

Use a separate patient PWA deployment from the same repo and backend.

- Clinician website: authenticated dashboard for case creation, review, scoring, and exports.
- Patient PWA: installable tablet/phone app for test-number entry, system check, task completion, drawing, audio evidence, autosave, and completion.
- Backend: shared Supabase Auth/Postgres/Storage/Edge Functions during MVP.
- Codebase: keep shared clinical contracts, scoring, task definitions, and Edge Function clients reusable across both surfaces.

This is intentionally not a native rewrite. A native wrapper can be reconsidered later only if PWA device limitations block clinical pilot use.

## Why This Direction

The patient journey is closer to pen-and-paper assessment than to desktop web browsing:

- Drawing tasks benefit from tablet size, touch, and stylus input.
- Patients need a focused full-screen flow without browser chrome, tabs, or desktop dashboard affordances.
- The device should be portable and easy to hand to a patient or use with a support person nearby.
- Clinician work remains better as a website because review, scoring, export, and case management are information-dense desktop workflows.

## Deployment Shape

Preferred MVP deployment:

| Surface | Example host | Purpose |
|---|---|---|
| Patient PWA | `patient.<domain>` | Installable patient assessment app. |
| Clinician website | `clinician.<domain>` or current app host | Authenticated clinician portal. |
| Supabase backend | current Supabase project | Shared app contract, persistence, storage, auth, functions. |

Both frontends may initially build from the same React app, but deployment config should make the surface boundary explicit.
Use `docs/PATIENT_PWA_DEPLOYMENT.md` for the concrete build commands, output directories, host fallback rules, and cache headers.

Minimum patient PWA route set:

- `/`
- `/session/:token`
- `/patient/welcome`
- `/patient/*`

Clinician-only route set:

- `/clinician/auth`
- `/dashboard/*`

Do not expose clinician navigation inside the installed patient PWA. Authentication still protects clinician routes, but the patient PWA should not make those routes discoverable.

## Implementation Phases

Current status: Phase 1, Phase 2, and the Codex-owned Phase 3 hardening slices are implemented in the app and tracked in `docs/PATIENT_PWA_TRACKER.md`. Phase 4 remains a future decision gate, and real-device installed-PWA evidence is still required before clinical pilot use.

### Phase 1: Add PWA Readiness Without Backend Changes

- Implemented: patient PWA manifest and icons.
- Implemented: iOS home-screen metadata and Apple touch icon.
- Implemented: conservative service worker that caches the static app shell only.
- Implemented: Supabase API calls, signed URLs, audio, drawings, PHI, reports, and exports stay network-only.
- Implemented: install guidance for tablet/phone users.
- Implemented: PWA smoke tests and Chrome/mobile viewport QA.

### Phase 2: Split Deployment Targets

- Implemented: separate patient and clinician build/deploy targets.
- Implemented: patient deployment has a PWA-specific `start_url`, name, icons, and route fallback.
- Implemented: clinician deployment keeps website-oriented metadata and no patient install prompt.
- Implemented: backend Edge Function contracts stay shared.
- Implemented: environment variables and deployment commands are documented for each surface.

### Phase 3: Tablet-First Patient UX Hardening

- Implemented for current MVP tasks: tablet/phone portrait and landscape hardening.
- Implemented: drawing canvas touch/stylus optimization.
- Implemented: drawing surface avoids accidental scroll/zoom.
- Implemented: task screens remain focused, single-purpose, and low-distraction.
- Still required before clinical pilot: recheck Hebrew audio, microphone permission, local retry queue, resume, and completion from installed PWA mode on real devices.

### Phase 4: Decide Whether Native Wrapper Is Needed

Only consider Capacitor or another native wrapper after PWA pilot evidence shows a concrete blocker, such as device permissions, install friction, locked kiosk mode, or required app-store distribution.

## Caching And Data Rules

The PWA must not become an offline clinical record store.

Allowed to cache:

- Static app shell assets.
- Non-sensitive UI images/icons.
- Versioned JavaScript/CSS bundles.

Do not cache:

- Patient profile fields.
- Test numbers or internal link tokens beyond existing same-device session state.
- Task responses.
- Drawing/audio evidence.
- Supabase API responses.
- Signed stimulus/evidence URLs.
- PDF/CSV exports.

Patient evidence persistence remains online-first with the existing local retry queue. If the device is offline or queued evidence cannot sync, completion must remain blocked until required evidence is saved.

## Platform Notes

- Installability requires a web app manifest, icons, HTTPS hosting, and browser support.
- iOS/iPadOS Home Screen web apps in standalone mode have app-like browser chrome removal and separate storage from Safari browser sessions.
- Because installed PWA storage can differ from regular browser storage, patients should start and finish an assessment in the installed patient PWA, not begin in Safari and switch midway.
- Patient resume should be tested in installed PWA mode, not only desktop Chrome.

## Verification Requirements

Use `docs/FRONTEND_READINESS.md` for frontend implementation rules, shared state language, and the patient/clinician verification matrix.

For patient PWA work, run the relevant baseline checks plus explicit device-mode QA:

- `cd client && npm test && npm run build && npm run lint`
- Browser check for patient entry, system check, drawing tasks, audio tasks, autosave, completion, and invalid/resume states.
- Mobile viewport checks for phone portrait.
- Tablet viewport checks for portrait and landscape.
- Installed PWA/home-screen mode check before clinical pilot.
- Local Supabase E2E when changes affect start, save, complete, storage, review, scoring, or exports.

Record skipped PWA/device checks in the PR.

Update `docs/PATIENT_PWA_TRACKER.md` whenever a PWA milestone starts, is blocked, or is completed.

## Version Control Rules

- Use branches named for the surface, for example `codex/patient-pwa-manifest`, `codex/patient-pwa-deploy-split`, or `codex/patient-tablet-drawing`.
- Do not mix clinician dashboard refactors with patient PWA install/deployment work unless the shared contract requires it.
- Update this document, `JOURNEY.md`, and `docs/DEVELOPMENT_PROCESS.md` whenever the patient/clinician surface boundary changes.
- Update `docs/PATIENT_PWA_TRACKER.md` whenever milestone ownership, status, or acceptance criteria changes.
- Update `docs/AGENT_LEARNINGS.md` when a PWA bug or review finding creates a reusable rule.

## Non-Goals

- No native app rewrite in the immediate MVP.
- No app-store distribution until PWA evidence says it is necessary.
- No full offline clinical assessment storage.
- No clinician dashboard PWA unless a separate clinician product decision is made.
