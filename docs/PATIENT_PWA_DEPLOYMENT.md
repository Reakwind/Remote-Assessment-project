# Patient PWA Deployment

This document captures the MVP deployment split for the two browser surfaces. `docs/PATIENT_PWA_ARCHITECTURE.md` remains the surface architecture authority.

## Surfaces

| Surface | Build command | Output directory | Intended host |
|---|---|---|---|
| Patient PWA production | `cd client && npm run build:patient` | `client/dist/patient` | `patient.<domain>` |
| Patient PWA staging | `cd client && npm run build:patient:staging` | `client/dist/patient-staging` | staging patient host |
| Clinician website production | `cd client && npm run build:clinician` | `client/dist/clinician` | current app host or `clinician.<domain>` |
| Combined local/default | `cd client && npm run build` | `client/dist` | local verification only |

The patient and clinician builds come from the same React app and shared Supabase backend, but the build outputs are separate so hosting settings can be owned per surface.

## Environment Variables

Required for both deployed surfaces:

```bash
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Surface build scripts set these automatically:

```bash
VITE_APP_SURFACE=patient|clinician
VITE_DEPLOY_ENV=staging|production
VITE_BUILD_OUT_DIR=dist/<surface>
```

Optional:

```bash
VITE_PATIENT_PWA_URL=https://patient.<domain>
```

Use `VITE_DEPLOY_ENV=staging` only for patient staging builds; it shows the patient staging banner.

## Hosting Rules

Configure each host as a single-page app:

- Serve `index.html` for unknown paths.
- Keep hash routes working from `/`.
- Use HTTPS.
- Do not share one deployed output directory between patient and clinician hosts.

Patient host requirements:

- Publish `client/dist/patient` or `client/dist/patient-staging`.
- Keep `patient.webmanifest`, `patient-sw.js`, `offline.html`, and patient icons at the host root.
- Use the patient host root as the PWA scope.
- Do not add clinician navigation or clinician route links.

Clinician host requirements:

- Publish `client/dist/clinician`.
- Do not publish patient manifest, service worker, offline fallback page, or patient app icons.
- Keep clinician auth and dashboard routes available behind normal app auth.

Recommended cache policy:

| Path | Cache behavior |
|---|---|
| `/assets/*` | Long-lived immutable cache is acceptable for hashed files. |
| `/index.html` | No-cache or short TTL. |
| `/patient-sw.js` | No-cache. |
| `/patient.webmanifest` | No-cache or short TTL. |
| Supabase API, signed URLs, PDF, CSV, audio, drawings | Network-only; do not route through an app-shell cache. |

## Netlify

Use [NETLIFY_HOSTING.md](NETLIFY_HOSTING.md) for the provider-specific setup. The current Netlify plan uses two separate sites from the same GitHub repository:

| Netlify site | Package directory | Publish directory |
|---|---|---|
| Patient PWA staging | `deploy/netlify/patient-staging` | `client/dist/patient-staging` |
| Clinician website | `deploy/netlify/clinician` | `client/dist/clinician` |

Set Base directory to the matching package directory for each site. Netlify resolves the site-specific `netlify.toml` from that directory, and its build command and publish paths are relative to `deploy/netlify/<site>`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify with the Builds scope.

## Verification

Before publishing a patient build:

```bash
cd client
npm run build:patient
npm run preview:patient
```

Check the preview root:

- `index.html` links `patient.webmanifest`.
- `patient-sw.js` is present at the root.
- Clinician routes redirect to the patient home in patient surface mode.
- Phone portrait and iPad portrait or landscape viewports render without clipped primary controls.

Before publishing a clinician build:

```bash
cd client
npm run build:clinician
npm run preview:clinician
```

Check the preview root:

- `index.html` does not link a web app manifest.
- `patient.webmanifest`, `patient-sw.js`, and patient app icons are absent from the output directory.
- `offline.html` is absent from the output directory.
- Clinician auth and dashboard routes are available.

To build and mechanically verify all deployable surface outputs:

```bash
cd client
npm run build:surfaces
npm run verify:surface-builds
```

## Local HTTPS iPad Rehearsal

Use [docs/LOCAL_REHEARSAL_GATE.md](LOCAL_REHEARSAL_GATE.md) for the Mac plus iPad HTTPS installed-PWA rehearsal before deployment readiness. The rehearsal gate runs the local Supabase stack, serves the patient PWA and clinician website over trusted local HTTPS, writes evidence under `local-rehearsal-evidence/`, and distinguishes debug runs from readiness runs.

Use the older local review server only for browser debugging when installed-PWA behavior is not being certified:

```bash
node scripts/review-server.mjs --surface patient
```

The script starts local Supabase if needed, serves all Edge Functions, starts the selected Vite surface on the local network, and prints:

- a Mac URL,
- an iPad URL,
- the local Supabase proxy used by the browser.

Open the iPad URL on a device connected to the same Wi-Fi network. Without `--https-cert` and `--https-key`, this is an HTTP browser-only debugging server; it does not certify installed-PWA readiness.

To smoke-test deployed staging hosts after publication:

```bash
cd client
PATIENT_STAGING_URL=https://<patient-staging-host> CLINICIAN_STAGING_URL=https://<clinician-staging-host> npm run e2e:hosted-pwa
```

Remote Supabase deploys, migration pushes, function deploys, storage policy changes, and hosted E2E runs still require `docs/SUPABASE_RECONCILIATION.md` before any remote-changing command.
