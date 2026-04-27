# Patient PWA Architecture

This document is the source of truth for the selected product direction: **the clinician surface is a website, and the patient surface is a tablet/phone-first Progressive Web App (PWA).**

Future developers and AI agents should not treat the patient journey as a desktop website. Patient UX, QA, and deployment work must assume touch/stylus devices first.

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

### Phase 1: Add PWA Readiness Without Backend Changes

- Add patient PWA manifest and icons.
- Add iOS home-screen metadata and Apple touch icon.
- Add a conservative service worker that caches the static app shell only.
- Keep Supabase API calls, signed URLs, audio, drawings, PHI, reports, and exports network-only.
- Add install guidance for tablet/phone users.
- Add PWA smoke tests and Chrome/mobile viewport QA.

### Phase 2: Split Deployment Targets

- Configure separate patient and clinician build/deploy targets.
- Give the patient deployment a PWA-specific `start_url`, name, icons, and route fallback.
- Give the clinician deployment website-oriented metadata and no patient install prompt.
- Keep backend Edge Function contracts shared.
- Document environment variables and deployment commands for each surface.

### Phase 3: Tablet-First Patient UX Hardening

- Redesign every patient task for tablet/phone portrait and landscape.
- Optimize drawing canvas for touch and stylus.
- Prevent accidental scroll/zoom during drawing.
- Keep task screens full-screen, single-purpose, and low-distraction.
- Recheck Hebrew audio, microphone permission, local retry queue, and completion from installed PWA mode.

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

For patient PWA work, run the relevant baseline checks plus explicit device-mode QA:

- `cd client && npm test && npm run build && npm run lint`
- Browser check for patient entry, system check, drawing tasks, audio tasks, autosave, completion, and invalid/resume states.
- Mobile viewport checks for phone portrait.
- Tablet viewport checks for portrait and landscape.
- Installed PWA/home-screen mode check before clinical pilot.
- Local Supabase E2E when changes affect start, save, complete, storage, review, scoring, or exports.

Record skipped PWA/device checks in the PR.

## Version Control Rules

- Use branches named for the surface, for example `codex/patient-pwa-manifest`, `codex/patient-pwa-deploy-split`, or `codex/patient-tablet-drawing`.
- Do not mix clinician dashboard refactors with patient PWA install/deployment work unless the shared contract requires it.
- Update this document, `JOURNEY.md`, and `docs/DEVELOPMENT_PROCESS.md` whenever the patient/clinician surface boundary changes.
- Update `docs/AGENT_LEARNINGS.md` when a PWA bug or review finding creates a reusable rule.

## Non-Goals

- No native app rewrite in the immediate MVP.
- No app-store distribution until PWA evidence says it is necessary.
- No full offline clinical assessment storage.
- No clinician dashboard PWA unless a separate clinician product decision is made.
