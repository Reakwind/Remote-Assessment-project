# Netlify Hosting

This runbook configures the patient PWA staging host and clinician website host on Netlify. `docs/PATIENT_PWA_DEPLOYMENT.md` remains the deployment split authority.

## Sites

Create two separate Netlify sites from the same GitHub repository:

| Netlify site | Package directory | Config file | Output |
|---|---|---|---|
| Patient PWA staging | `deploy/netlify/patient-staging` | `deploy/netlify/patient-staging/netlify.toml` | `client/dist/patient-staging` |
| Clinician website | `deploy/netlify/clinician` | `deploy/netlify/clinician/netlify.toml` | `client/dist/clinician` |

Set Base directory to the matching package directory. Netlify resolves each site-specific `netlify.toml` from that directory, so the checked-in build commands and publish paths are relative to `deploy/netlify/<site>`.

## Current Pilot Hosts

The current pilot staging sites are:

| Surface | Site name | URL | Deploy source |
|---|---|---|---|
| Patient PWA staging | `reakwind-remote-assessment-patient-staging` | `https://reakwind-remote-assessment-patient-staging.netlify.app` | GitHub continuous deploy from `main` |
| Clinician website | `reakwind-remote-assessment-clinician` | `https://reakwind-remote-assessment-clinician.netlify.app` | GitHub continuous deploy from `main` |

These sites are connected to `Reakwind/Remote-Assessment-project` and configured with hosted Supabase project `jdkaxdtrukfxzlzspuua`. Netlify build environment variables are set on both sites.

## Environment Variables

Set these variables on both Netlify sites with the Builds scope:

```bash
VITE_SUPABASE_URL=<hosted-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<hosted-supabase-anon-key>
```

Do not set service-role keys in Netlify. The browser app needs only the anon key.

Optional after the patient staging URL is known:

```bash
VITE_PATIENT_PWA_URL=https://<patient-staging-host>
```

## Create The Patient Staging Site

1. In Netlify, add a new project from `Reakwind/Remote-Assessment-project`.
2. Select manual configuration if the site is not auto-detected.
3. Set Package directory to `deploy/netlify/patient-staging`.
4. Set Base directory to `deploy/netlify/patient-staging`.
5. Keep the config-file build settings:
   - Build command: `cd ../../../client && npm ci --legacy-peer-deps && npm run build:patient:staging`
   - Publish directory: `../../../client/dist/patient-staging`
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Deploy from `main`.

The patient staging host must serve these files from the host root:

```text
/
/patient.webmanifest
/patient-sw.js
/offline.html
/patient-icon.svg
/patient-icon-192.png
/patient-icon-512.png
```

## Create The Clinician Site

1. In Netlify, add another new project from `Reakwind/Remote-Assessment-project`.
2. Select manual configuration if the site is not auto-detected.
3. Set Package directory to `deploy/netlify/clinician`.
4. Set Base directory to `deploy/netlify/clinician`.
5. Keep the config-file build settings:
   - Build command: `cd ../../../client && npm ci --legacy-peer-deps && npm run build:clinician`
   - Publish directory: `../../../client/dist/clinician`
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Deploy from `main`.

The clinician host must not publish patient PWA files:

```text
/patient.webmanifest
/patient-sw.js
/offline.html
/patient-icon.svg
/patient-icon-192.png
/patient-icon-512.png
```

## Verification

Before creating the Netlify sites, local surface verification should pass:

```bash
cd client
npm run build:surfaces
npm run verify:surface-builds
npm run verify:patient-pwa-readiness
```

After both Netlify URLs exist, run the hosted smoke:

```bash
cd client
PATIENT_STAGING_URL=https://<patient-staging-host> CLINICIAN_STAGING_URL=https://<clinician-host> npm run e2e:hosted-pwa
```

The hosted smoke checks HTTPS, patient staging banner, manifest, service worker, manifest icons, clinician-route redirects on the patient host, and absence of patient PWA assets on the clinician host.

## Pilot Handoff

Record these values in the pilot handoff:

- Patient staging URL.
- Clinician URL.
- Netlify site names.
- Supabase project ref.
- Commit deployed from `main`.
- Hosted smoke command and result.

Do not record Supabase keys in docs or PRs.
