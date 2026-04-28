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
npm run verify:patient-pwa-readiness
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

To print a combined local/external readiness report after building surfaces:

```bash
cd client
npm run verify:patient-pwa-readiness
```

The command fails only for broken local build outputs by default. It reports hosted staging, licensed stimuli, and real-device checks as `blocked` or `manual` until the required external evidence is available. Use `node ../scripts/patient-pwa-readiness.mjs --fail-on-blocked` when a release process should fail while external gates remain blocked.

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

For Netlify setup, use [NETLIFY_HOSTING.md](NETLIFY_HOSTING.md).

Required staging checks:

- Patient staging host serves `client/dist/patient-staging`.
- Clinician host serves `client/dist/clinician` or the existing clinician deployment.
- Patient staging shows the Hebrew `מצב בדיקה` banner.
- Patient host has HTTPS, manifest, icons, and service worker at the host root.
- Clinician routes are not discoverable from the patient PWA and redirect to patient entry when opened directly on the patient host.
- Supabase remote-changing work follows `docs/SUPABASE_RECONCILIATION.md` before deploys, migration pushes, storage-policy changes, or hosted E2E.

After the staging URLs exist, run:

```bash
cd client
PATIENT_STAGING_URL=https://<patient-staging-host> CLINICIAN_STAGING_URL=https://<clinician-staging-host> npm run e2e:hosted-pwa
```

The hosted smoke requires HTTPS, checks the patient staging banner, validates manifest and service-worker availability at the patient host root, confirms clinician routes redirect away from the patient PWA, and confirms patient PWA assets are absent from the clinician host.

## Real-Device Gate

Real-device checks stay blocked until the user tests the installed PWA on the target device.

Minimum device matrix:

| Device mode | Required checks |
|---|---|
| iPadOS Safari installed PWA | Install from patient staging, open in standalone mode, enter test number, complete preflight, drawing, audio, naming, completion, and resume after app relaunch. |
| Tablet browser fallback | Same flow without installing; verify controls remain reachable with browser chrome. |
| Phone portrait fallback | Enter test number, complete preflight, naming, audio, and at least one drawing task; confirm phone drawing is captured and device context flags phone use. |

Record device, OS/browser version, staging URL, MoCA version, and any skipped task in the release note or PR handoff.

Use `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.example.json` as the evidence template. After filling it with the tested devices, include it in the readiness report:

```bash
cd client
PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE=../path/to/real-device-evidence.json npm run verify:patient-pwa-readiness
```

The evidence file must include passing runs for `ipad-installed-pwa`, `tablet-browser-fallback`, and `phone-portrait-fallback`. The readiness command validates required fields, HTTPS staging URLs, and the expected checks for each device mode.

For the current Netlify pilot hosts, start from `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json`. That file intentionally uses `pending` results; change a run to `pass` only after completing it on the named physical device.

## Pilot Readiness Status

The pilot is ready only when:

- Automated local gates pass.
- Hosted staging gate passes.
- Licensed stimuli gate passes for all enabled MoCA versions.
- Real-device gate passes on the target iPad/tablet plus phone fallback.
- No completion-blocking autosave, drawing, audio, or stimulus-fetch issues remain open.
