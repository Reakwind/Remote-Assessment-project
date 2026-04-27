# Patient PWA Tracker

This is the shared implementation tracker for the patient PWA program. `docs/PATIENT_PWA_ARCHITECTURE.md` remains the architecture authority; this file tracks the concrete work, owners, status, and acceptance checks.

Status values: `Not Started`, `In Progress`, `Blocked`, `Done`.

## Locked Decisions

- Clinician surface remains the website.
- Patient surface becomes a tablet/phone PWA for a small invite-only supervised remote pilot.
- Patient UI title is `הערכה קוגניטיבית`.
- Patient action copy uses `מבדק`, including `התחלת המבדק` and `המבדק הושלם`.
- Installed app name is `Remote Assessment`; short name is `Assessment`.
- Patient starts with the existing 8-digit test number.
- Support may help with device setup only, not answers.
- Formal consent is outside the app.
- iPadOS Safari is the first real-device acceptance target; phone support has equal priority and phone drawing is accepted but should be flagged later with device context.

## Milestone Tracker

| Phase | Owner | Status | Acceptance check | PR/link |
|---|---|---|---|---|
| PR #80 baseline | Codex | Done | Tracker exists and is linked from architecture docs. | #80 |
| PR #80 review | User | Not Started | PR #80 checks are green and the branch is reviewed before merge. | #80 |
| PWA shell | Codex | Done | Patient manifest, icons, metadata, manual service worker, surface flags, route gating, staging banner, and offline screen pass targeted checks. | #80 |
| Real device shell QA | User | Not Started | Installed PWA tested on iPad/tablet and phone fallback. | TBD |
| Deploy split | Codex | Not Started | Patient subdomain build/deploy instructions exist; clinician stays on current host. | TBD |
| Device context | Codex | Not Started | Session metadata captures concise device context and clinician detail/PDF/CSV display it. | TBD |
| UX hardening: preflight + drawing | Codex | Done | Preflight and drawing tasks fit tablet/phone viewports and drawing is stable with finger/stylus. | `codex/patient-tablet-drawing` |
| UX hardening: audio/speech tasks | Codex | Not Started | Generated Hebrew speech and audio capture work on tablet/phone viewports. | TBD |
| UX hardening: simple input tasks | Codex | Not Started | Remaining patient tasks fit main action and guarded navigation without desktop-web assumptions. | TBD |
| Pilot readiness | Both | Not Started | Shared staging, all enabled licensed visual stimuli, iPad/tablet install, and phone fallback checks pass. | TBD |

## Current Shell Scope

- Use `VITE_APP_SURFACE=combined|patient|clinician`; default local development remains `combined`.
- Use `VITE_DEPLOY_ENV=local|staging|production`; patient staging shows `מצב בדיקה`.
- Keep hash routing; patient PWA starts at `/#/`.
- In patient surface, clinician routes redirect to patient home.
- Register the service worker only for patient preview/production builds.
- Runtime-cache only same-origin static JS/CSS/icons.
- Keep Supabase calls, signed URLs, patient data, responses, drawings, audio, PDF, and CSV out of service-worker caches.
- Show a Hebrew connect-to-internet page when the app shell opens offline.
- Use generated Hebrew speech for memory words; do not require licensed memory MP3 files.
- Clear local session evidence after successful completion.
- Expire abandoned same-device resume state after 6 hours.

## Latest Verification

2026-04-27 Codex preflight + drawing verification:

- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build`
- Patient-surface browser smoke with `npm run dev:patient -- --host 127.0.0.1`
- Phone viewport checks at 390x844 for `/patient/welcome`, `/patient/trail-making`, and `/patient/clock`
- Tablet landscape viewport checks at 1024x768 for `/patient/cube` and `/patient/clock`

2026-04-27 Codex shell verification:

- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build`
- `cd client && npm run build:patient:staging`
- Built-preview browser smoke at `http://127.0.0.1:5174/#/` for manifest/meta, service-worker registration, staging banner, clinician-route gating, offline fallback, and iPad portrait, iPad landscape, and iPhone portrait viewports.

## Verification Policy

- Shell/UI PRs: `cd client && npm test`, `npm run lint`, `npm run build`, plus phone/iPad viewport smoke checks.
- Contract PRs: full local Supabase/browser E2E is required when start, save, complete, storage, review, scoring, or export behavior changes.
- Real-device checks stay `Blocked` until the user tests the installed PWA on the available iPad/tablet.
