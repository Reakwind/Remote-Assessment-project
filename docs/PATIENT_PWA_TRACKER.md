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
- iPadOS Safari is the first real-device acceptance target; phone support has equal priority and phone drawing is accepted but flagged for clinician interpretation with device context.

## Milestone Tracker

| Phase                             | Owner | Status      | Acceptance check                                                                                                                                                            | PR/link                                                                                                                       |
| --------------------------------- | ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PR #80 baseline                   | Codex | Done        | Tracker exists and is linked from architecture docs.                                                                                                                        | #80                                                                                                                           |
| PR #80 review                     | User  | Done        | PR #80 merged to main on 2026-04-27.                                                                                                                                        | #80                                                                                                                           |
| PWA shell                         | Codex | Done        | Patient manifest, icons, metadata, manual service worker, surface flags, route gating, staging banner, and offline screen pass targeted checks.                             | #80                                                                                                                           |
| Install guidance                  | Codex | Done        | Patient surface gives tablet/phone home-screen guidance without exposing clinician navigation.                                                                              | `codex/patient-install-guidance`                                                                                              |
| Real device shell QA              | User  | Not Started | Installed PWA tested on iPad/tablet and phone fallback.                                                                                                                     | TBD                                                                                                                           |
| Deploy split                      | Codex | Done        | Patient and clinician builds emit separate output directories; patient subdomain deploy instructions exist; clinician stays on current host without patient PWA assets.     | `codex/patient-pwa-deploy-split-current`                                                                                      |
| Device context                    | Codex | Done        | Session metadata captures concise device context and clinician detail/PDF/CSV display it.                                                                                   | `codex/patient-device-context`                                                                                                |
| UX hardening: preflight + drawing | Codex | Done        | Preflight and drawing tasks fit tablet/phone viewports and drawing is stable with finger/stylus.                                                                            | `codex/patient-tablet-drawing`                                                                                                |
| UX hardening: audio/speech tasks  | Codex | Done        | Generated Hebrew speech and audio capture work on tablet/phone viewports.                                                                                                   | `codex/patient-audio-speech`                                                                                                  |
| UX hardening: simple input tasks  | Codex | Done        | Naming task fits phone/tablet viewports with local item progress, guarded next-item navigation, and answer revisit controls.                                                | `codex/patient-simple-inputs`                                                                                                 |
| Readiness reporting               | Codex | Done        | Local command reports patient/clinician build readiness and marks hosted staging, licensed stimuli, and real-device gates as blocked/manual until external evidence exists. | `codex/patient-readiness-report`                                                                                              |
| Hosted staging smoke              | Codex | Done        | Playwright hosted smoke validates patient/clinician staging URL split, HTTPS, patient staging banner, manifest/service worker, and clinician-route hiding once URLs exist.  | `codex/patient-hosted-smoke`                                                                                                  |
| Real-device evidence gate         | Codex | Done        | Readiness report can validate a structured iPad installed-PWA, tablet browser, and phone fallback evidence file before pilot review.                                        | `codex/patient-device-evidence`                                                                                               |
| Verification tightening           | Codex | Done        | Surface/readiness scripts validate offline fallback, manifest icons, service-worker cache guardrails, surface deploy flags, and hosted manifest icon availability.          | `codex/patient-pwa-verification-tightening`                                                                                   |
| Netlify hosting setup             | Codex | Done        | Repo includes Netlify package-directory configs and runbook for separate patient staging and clinician hosts with GitHub continuous deploy from `main`.                     | `codex/netlify-hosting-setup`                                                                                                 |
| Hosted Netlify deployment         | Codex | Done        | Patient staging and clinician Netlify URLs are live and hosted smoke passes against both.                                                                                   | `https://reakwind-remote-assessment-patient-staging.netlify.app` / `https://reakwind-remote-assessment-clinician.netlify.app` |
| Licensed hosted stimuli           | Codex | Done        | Hosted Supabase `stimuli` bucket contains all required MoCA 8.1, 8.2, and 8.3 licensed visual PNGs and verification passes.                                                 | `jdkaxdtrukfxzlzspuua`                                                                                                        |
| Pilot readiness                   | Both  | Blocked     | Automated local gates, hosted Netlify staging, and licensed stimuli pass; physical iPad/tablet install and phone fallback checks still need real-device execution.          | `codex/patient-pilot-readiness`                                                                                               |

## Current Shell Scope

- Use `VITE_APP_SURFACE=combined|patient|clinician`; default local development remains `combined`.
- Use `VITE_DEPLOY_ENV=local|staging|production`; patient staging shows `מצב בדיקה`.
- Surface builds emit separate deployable outputs: `client/dist/patient`, `client/dist/patient-staging`, and `client/dist/clinician`.
- Keep hash routing; patient PWA starts at `/#/`.
- In patient surface, clinician routes redirect to patient home.
- Register the service worker only for patient preview/production builds.
- Runtime-cache only same-origin static JS/CSS/icons.
- Keep Supabase calls, signed URLs, patient data, responses, drawings, audio, PDF, and CSV out of service-worker caches.
- Show a Hebrew connect-to-internet page when the app shell opens offline.
- Use generated Hebrew speech for memory words; do not require licensed memory MP3 files.
- Clear local session evidence after successful completion.
- Expire abandoned same-device resume state after 6 hours.
- Preserve the local preflight-complete flag when session evidence is cleared, so returning local patients can start future tests at the first task.
- Capture explicit device type and orientation at patient start so phone/tablet fallback use is visible in clinician detail, PDF, and CSV exports.
- Flag drawing reviews captured on phones so clinicians account for small-screen touch input while scoring.
- Show home-screen guidance on patient entry unless the PWA is already running in standalone mode.
- Use `npm run verify:patient-pwa-readiness` after `npm run build:surfaces` to print local readiness status and the remaining external blocks.
- Use `PATIENT_STAGING_URL=https://<patient-host> CLINICIAN_STAGING_URL=https://<clinician-host> npm run e2e:hosted-pwa` after staging publication.
- Use `PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE=../path/to/real-device-evidence.json npm run verify:patient-pwa-readiness` after filling the real-device evidence template.
- Use `docs/NETLIFY_HOSTING.md` when creating or changing the Netlify patient staging and clinician sites.
- Use `docs/PATIENT_PWA_PILOT_EVIDENCE.json` as the repo-recorded hosted staging and licensed-stimuli evidence for the current Netlify/Supabase pilot setup.
- Use `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json` as the current Netlify evidence template for physical-device QA.
- Use `docs/PATIENT_PWA_PILOT_READINESS.md` for the final staging, licensed-stimuli, installed-PWA, and phone fallback gates before clinical pilot use.

## Latest Verification

2026-04-28 Codex hosted Netlify and stimuli verification:

- `cd deploy/netlify/patient-staging && netlify build`
- `cd deploy/netlify/clinician && netlify build`
- `cd client && PATIENT_STAGING_URL=https://reakwind-remote-assessment-patient-staging.netlify.app CLINICIAN_STAGING_URL=https://reakwind-remote-assessment-clinician.netlify.app npm run e2e:hosted-pwa`
- `SUPABASE_URL=https://jdkaxdtrukfxzlzspuua.supabase.co SUPABASE_SERVICE_ROLE_KEY=<from authenticated Supabase CLI> node scripts/verify-stimuli.mjs --all-versions`
- Patient staging URL: `https://reakwind-remote-assessment-patient-staging.netlify.app`
- Clinician URL: `https://reakwind-remote-assessment-clinician.netlify.app`
- Remaining blocker: fill and validate `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json` after real iPad/tablet/phone testing.

2026-04-28 Codex pilot-evidence wiring verification:

- `node --check scripts/patient-pwa-readiness.mjs`
- `node scripts/patient-pwa-readiness.mjs --external-only --json`
- `git diff --check`
- Current evidence file: `docs/PATIENT_PWA_PILOT_EVIDENCE.json`
- Remaining blocker: fill and validate `docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.netlify-template.json` after real iPad/tablet/phone testing.

2026-04-28 Codex verification-tightening verification:

- `node --check scripts/verify-surface-builds.mjs`
- `node --check scripts/patient-pwa-readiness.mjs`
- `cd client && npm run e2e:hosted-pwa` (skips until `PATIENT_STAGING_URL` and `CLINICIAN_STAGING_URL` are set)
- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `cd client && npm run e2e:browser`
- `cd client && npm run build:patient`
- `cd client && npm run e2e:patient-pwa` against `npm run preview:patient -- --host 127.0.0.1 --port 4173`
- `cd client && npm run build:surfaces`
- `cd client && npm run verify:surface-builds`
- `node scripts/patient-pwa-readiness.mjs`
- `PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE=docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.example.json node scripts/patient-pwa-readiness.mjs --json`
- `node scripts/verify-stimuli.mjs --all-versions --print-manifest`
- `git diff --check`

2026-04-28 Codex real-device-evidence verification:

- `cd client && npm run build:surfaces`
- `cd client && npm run verify:surface-builds`
- `node --check scripts/patient-pwa-readiness.mjs`
- `PATIENT_PWA_REAL_DEVICE_EVIDENCE_FILE=docs/PATIENT_PWA_REAL_DEVICE_EVIDENCE.example.json node scripts/patient-pwa-readiness.mjs --json`
- `git diff --check`

2026-04-28 Codex hosted-smoke verification:

- `cd client && npm run e2e:hosted-pwa` (skips until `PATIENT_STAGING_URL` and `CLINICIAN_STAGING_URL` are set)
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `git diff --check`

2026-04-28 Codex readiness-report verification:

- `cd client && npm run build:surfaces`
- `cd client && npm run verify:surface-builds`
- `cd client && npm run verify:patient-pwa-readiness`
- `node --check scripts/patient-pwa-readiness.mjs`
- `node scripts/patient-pwa-readiness.mjs --json`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`

2026-04-28 Codex phone-drawing-review verification:

- `cd client && npm test -- ClinicianDashboardDetail`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `git diff --check`

2026-04-27 Codex device-classification verification:

- `cd client && npm test -- useSession ClinicianDashboardDetail`
- `deno check --frozen supabase/functions/start-session/index.ts supabase/functions/get-session/index.ts supabase/functions/export-csv/index.ts supabase/functions/export-pdf/index.ts`
- `deno test --allow-env --cached-only supabase/functions/_shared/export-report.test.ts supabase/functions/start-session/index_test.ts`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`

2026-04-27 Codex onboarding-once verification:

- `cd client && npm test -- PatientResume PatientWelcome EndScreen`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `cd client && npx playwright test ux-blockers.spec.ts -g "landing test number entry"`

2026-04-27 Codex install-guidance verification:

- `cd client && npm test -- PatientResume`
- `cd client && npm run build:patient`
- `cd client && npm run e2e:patient-pwa` against `npm run preview:patient -- --host 127.0.0.1 --port 4173`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`

2026-04-27 Codex pilot-readiness verification:

- `cd client && npm run e2e:browser`
- `cd client && npm run e2e:patient-pwa` against `npm run preview:patient -- --host 127.0.0.1 --port 4173`
- `cd client && npm test -- --reporter=dot`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `cd client && npm run build:patient`
- `cd client && npm run build:surfaces`
- `cd client && npm run verify:surface-builds`
- `node --check scripts/verify-surface-builds.mjs`

2026-04-27 Codex deploy split verification:

- `cd client && npm test -- --reporter=dot`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `cd client && npm run build:surfaces`
- `cd client && npm run build:patient`
- `cd client && npm run build:patient:staging`
- `cd client && npm run build:clinician`
- `cd client && npm run verify:surface-builds`
- Built-preview browser smoke: patient build at `http://127.0.0.1:4173/#/` confirmed patient title, patient entry UI, and clinician-route redirect; clinician build at `http://127.0.0.1:4174/#/clinician/auth` confirmed website title and clinician auth page.

2026-04-27 Codex simple-input verification:

- `cd client && npm test -- NamingTask`
- `cd client && npm test -- --reporter=dot`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- Patient-surface browser smoke with `npm run dev:patient -- --host 127.0.0.1`
- Phone viewport check at 390x844 for `/patient/naming`
- Tablet landscape viewport check at 1024x768 for `/patient/naming`

2026-04-27 Codex audio/speech verification:

- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- Patient-surface browser smoke with `npm run dev:patient -- --host 127.0.0.1`
- Phone viewport checks at 390x844 for `/patient/memory`, `/patient/digit-span`, `/patient/vigilance`, and `/patient/orientation`
- Tablet landscape viewport checks at 1024x768 for `/patient/language` and `/patient/orientation`

2026-04-27 Codex preflight + drawing verification:

- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build`
- Patient-surface browser smoke with `npm run dev:patient -- --host 127.0.0.1`
- Phone viewport checks at 390x844 for `/patient/welcome`, `/patient/trail-making`, and `/patient/clock`
- Tablet landscape viewport checks at 1024x768 for `/patient/cube` and `/patient/clock`

2026-04-27 Codex device-context verification:

- `cd client && npm test`
- `cd client && npm run lint`
- `cd client && npm run build -- --debug`
- `deno check --frozen supabase/functions/start-session/index.ts supabase/functions/get-session/index.ts supabase/functions/export-csv/index.ts supabase/functions/export-pdf/index.ts`
- `deno test --allow-env --cached-only supabase/functions/_shared/export-report.test.ts supabase/functions/start-session/index_test.ts`
- `supabase migration up`
- `supabase db lint`
- `supabase functions serve create-session start-session get-stimuli submit-results save-drawing save-audio complete-session get-session update-drawing-review update-scoring-review export-pdf export-csv --env-file /dev/null`
- `node scripts/local-e2e.mjs --version 8.3`

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
