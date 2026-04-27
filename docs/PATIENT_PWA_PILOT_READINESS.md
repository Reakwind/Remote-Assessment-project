# Patient PWA Pilot Readiness

This checklist tracks the final gates before using the patient PWA in a supervised remote pilot. `docs/PATIENT_PWA_ARCHITECTURE.md` remains the product architecture authority, and `docs/PATIENT_PWA_DEPLOYMENT.md` remains the deployment split authority.

## Automated Local Gates

Run these before requesting pilot-readiness review:

```bash
cd client
npm test -- --reporter=dot
npm run lint
npm run build -- --debug
npm run build:surfaces
npm run verify:surface-builds
npm run e2e:browser
```

For patient PWA deploy-preview smoke, first run a patient preview in one terminal:

```bash
cd client
npm run build:patient
npm run preview:patient -- --host 127.0.0.1 --port 4173
```

Then run this from another terminal:

```bash
cd client
npm run e2e:patient-pwa
```

The patient PWA smoke gate checks:

- Patient app title is `Remote Assessment`.
- Patient entry UI renders.
- `patient.webmanifest` is served.
- `patient-sw.js` is served.
- Clinician auth route redirects back to patient entry in patient-surface mode.

## Licensed Stimuli Gate

Before any clinical pilot, all enabled licensed visual stimuli must be present in private Supabase Storage.

Print the required manifest without contacting Supabase:

```bash
node scripts/verify-stimuli.mjs --all-versions --print-manifest
```

Verify local or hosted Storage after the licensed assets are uploaded:

```bash
SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/verify-stimuli.mjs --all-versions
```

Keep licensed PDFs, extracted images, and service-role keys out of Git.

## Hosted Staging Gate

Hosted staging is not complete until a shared patient staging URL exists and is connected to the intended Supabase project.

Required staging checks:

- Patient staging host serves `client/dist/patient-staging`.
- Clinician host serves `client/dist/clinician` or the existing clinician deployment.
- Patient staging shows the Hebrew `מצב בדיקה` banner.
- Patient host has HTTPS, manifest, icons, and service worker at the host root.
- Clinician routes are not discoverable from the patient PWA and redirect to patient entry when opened directly on the patient host.
- Supabase remote-changing work follows `docs/SUPABASE_RECONCILIATION.md` before deploys, migration pushes, storage-policy changes, or hosted E2E.

## Real-Device Gate

Real-device checks stay blocked until the user tests the installed PWA on the target device.

Minimum device matrix:

| Device mode | Required checks |
|---|---|
| iPadOS Safari installed PWA | Install from patient staging, open in standalone mode, enter test number, complete preflight, drawing, audio, naming, completion, and resume after app relaunch. |
| Tablet browser fallback | Same flow without installing; verify controls remain reachable with browser chrome. |
| Phone portrait fallback | Enter test number, complete preflight, naming, audio, and at least one drawing task; confirm phone drawing is captured and device context flags phone use. |

Record device, OS/browser version, staging URL, MoCA version, and any skipped task in the release note or PR handoff.

## Pilot Readiness Status

The pilot is ready only when:

- Automated local gates pass.
- Hosted staging gate passes.
- Licensed stimuli gate passes for all enabled MoCA versions.
- Real-device gate passes on the target iPad/tablet plus phone fallback.
- No completion-blocking autosave, drawing, audio, or stimulus-fetch issues remain open.
