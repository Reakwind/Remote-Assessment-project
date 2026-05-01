# Patient PWA Tracker

This is the shared tracker for the patient PWA program. It records current
milestone status and the active blocker only. Use
[PATIENT_PWA_ARCHITECTURE.md](PATIENT_PWA_ARCHITECTURE.md) for architecture and
[PATIENT_PWA_PILOT_READINESS.md](PATIENT_PWA_PILOT_READINESS.md) for final pilot
gates.

Status values: `Not Started`, `In Progress`, `Blocked`, `Done`.

## Locked Decisions

- Clinician surface remains the website.
- Patient surface is a tablet/phone PWA for a small invite-only supervised remote pilot.
- Patient UI title is `הערכה קוגניטיבית`.
- Patient action copy uses `מבדק`, including `התחלת המבדק` and `המבדק הושלם`.
- Installed app name is `Remote Assessment`; short name is `Assessment`.
- Patient starts with the existing 8-digit test number.
- Support may help with device setup only, not answers.
- Formal consent is outside the app.
- iPadOS Safari is the first installed-PWA acceptance target.
- Phone fallback has equal priority; phone drawing is accepted but flagged for clinician interpretation with device context.

## Milestones

| Phase | Owner | Status | Current note |
| --- | --- | --- | --- |
| PWA shell | Codex | Done | Manifest, icons, metadata, manual service worker, route gating, staging banner, offline screen. |
| Install guidance | Codex | Done | Patient home-screen guidance exists without exposing clinician navigation. |
| Deploy split | Codex | Done | Patient staging, patient production, and clinician builds emit separate outputs. |
| Device context | Codex | Done | Start metadata captures device type/orientation and exposes it to clinician detail, PDF, and CSV. |
| Tablet/phone UX hardening | Codex | Done | Preflight, drawing, audio/speech, and simple input tasks have focused mobile/tablet hardening. |
| Readiness reporting | Codex | Done | `npm run verify:patient-pwa-readiness` reports local and external gates. |
| Hosted staging smoke | Codex | Done | Hosted smoke validates patient/clinician URL split, HTTPS, patient banner, manifest, service worker, route hiding, and CORS. |
| Real-device evidence validation | Codex | Done | The readiness script validates the structured physical-device evidence file. |
| Netlify hosting setup | Codex | Done | Provider config and runbook exist for separate patient staging and clinician hosts. |
| Hosted Netlify deployment | Codex | Done | Current patient and clinician Netlify URLs are live and smoke-tested. |
| Licensed hosted stimuli | Codex | Done | Hosted Supabase `stimuli` bucket was verified for MoCA 8.1, 8.2, and 8.3. |
| Physical-device QA | User | In Progress | iPad installed-PWA testing started on 2026-04-30; the first blocker is a drawing save failure on the letter-number sequence. |
| Pilot readiness | Both | Blocked | Blocked on the iPad drawing-save failure plus remaining tablet browser and phone fallback evidence. |

## Current Evidence

- Patient staging URL: `https://reakwind-remote-assessment-patient-staging.netlify.app`
- Clinician URL: `https://reakwind-remote-assessment-clinician.netlify.app`
- Hosted Supabase project ref: `jdkaxdtrukfxzlzspuua`
- Hosted staging and licensed-stimuli evidence file: `docs/PATIENT_PWA_PILOT_EVIDENCE.json`
- Physical-device evidence template: `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json`

## Active Blocker

iPad installed-PWA real-device testing started on 2026-04-30. The current observed blocker is that the letter-number sequence drawing task reports `Failed to save drawing review` and does not advance to the next task.

Fill and validate the real-device evidence template after testing:

- `ipad-installed-pwa`
- `tablet-browser-fallback`
- `phone-portrait-fallback`

Validation command:

```bash
cd client
PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE=../docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json npm run verify:patient-pwa-readiness
```

Only change a run from `pending` to `pass` after completing it on the named
physical device.

## Current Commands

For surface build readiness:

```bash
cd client
npm run build:surfaces
npm run verify:surface-builds
npm run verify:patient-pwa-readiness
```

For hosted smoke:

```bash
cd client
HOSTED_SUPABASE_URL=https://jdkaxdtrukfxzlzspuua.supabase.co PATIENT_STAGING_URL=https://reakwind-remote-assessment-patient-staging.netlify.app CLINICIAN_STAGING_URL=https://reakwind-remote-assessment-clinician.netlify.app npm run e2e:hosted-pwa
```

For local contract work that touches start, save, complete, storage, review,
scoring, or export behavior, use
[LOCAL_E2E_VERIFICATION.md](LOCAL_E2E_VERIFICATION.md).

## Verification Policy

- Frontend implementation slices should follow `docs/FRONTEND_READINESS.md` and record skipped device or viewport checks.
- Shell/UI PRs: `cd client && npm test`, `npm run lint`, `npm run build`, plus phone/iPad viewport smoke checks.
- Contract PRs: full local Supabase/browser E2E is required when start, save, complete, storage, review, scoring, or export behavior changes.
- Real-device checks stay blocked until the user tests the installed PWA on the available iPad/tablet and phone fallback.
