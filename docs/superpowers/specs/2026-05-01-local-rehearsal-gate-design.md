# Local Rehearsal Gate Design

## Status

Approved design for implementation planning. This document defines the local readiness gate that must pass before deployment work or provider evaluation begins.

## Context

The project already has strong local pieces:

- `scripts/local-test-shell.mjs` runs the local-only regression path with local Supabase and hosted/Netlify environment variables disabled.
- `scripts/review-server.mjs` serves patient or clinician surfaces on the local network and proxies browser Supabase calls back to local Supabase.
- `docs/LOCAL_E2E_VERIFICATION.md` defines local browser and backend checks.
- `docs/PATIENT_PWA_DEPLOYMENT.md` documents the current local iPad HTTP review server and notes that installed-PWA behavior still needs HTTPS.

The missing piece is one explicit deployment-readiness gate that proves the patient and clinician apps work together locally on a real iPad before hosted deployment is considered.

## Goal

Create a local pilot rehearsal gate for Mac plus iPad that proves the full app flow works locally before deployment.

The gate covers:

- local Supabase database, Auth, Storage, and Edge Functions;
- local clinician website served over trusted HTTPS;
- local patient PWA served over trusted HTTPS;
- iPad installed-PWA behavior, not only Safari browser behavior;
- clinician case creation, test creation, patient completion, clinician review/finalization, and export checks;
- automated setup and health checks where possible;
- manual iPad evidence where a physical device is unavoidable.

## Non-Goals

- Do not evaluate Netlify, hosted Supabase, or alternative hosts/services in this phase.
- Do not replace Supabase during this phase.
- Do not claim deployment readiness from desktop-only Playwright or local HTTP testing.
- Do not automate physical iPad behavior unless a later implementation plan chooses an additional device automation tool.

Alternative hosts and services are a later design phase after this local gate is stable and passing.

## Rehearsal Modes

### Deployment-Readiness Mode

Deployment-readiness mode is strict and repeatable. It should:

1. warn clearly that local data will be reset;
2. reset local Supabase to a known clean state;
3. apply migrations and seed required local data;
4. upload and verify local licensed stimuli when available;
5. start local Edge Functions with trusted local HTTPS origins allowed;
6. start clinician and patient HTTPS review servers;
7. run automated local checks;
8. create an evidence file for the manual iPad run;
9. fail deployment readiness unless automated checks and manual iPad evidence both pass.

This is the only mode that can certify readiness to discuss deployment.

### Debug Mode

Debug mode preserves local data. It should:

1. start or reuse local Supabase;
2. start or reuse Edge Functions;
3. start clinician and patient HTTPS review servers;
4. run health checks;
5. help reproduce a specific failure without deleting the broken session.

Debug mode can validate a fix during investigation, but it cannot certify deployment readiness.

## Local HTTPS Model

The gate uses trusted local HTTPS instead of a public tunnel.

The intended model:

- The Mac has a local development certificate for a stable LAN hostname or IP.
- The iPad trusts that certificate/profile.
- The clinician app runs at a local HTTPS origin, for example `https://remote-assessment.local:<clinician-port>/`.
- The patient app runs at a local HTTPS origin, for example `https://remote-assessment.local:<patient-port>/`.
- Both apps proxy Supabase calls back to local Supabase so the iPad never calls `127.0.0.1`.
- Edge Function CORS includes both HTTPS local origins.
- Patient PWA checks run from HTTPS so installability, service worker scope, standalone mode, microphone permission, audio playback, and iPad Safari behavior are tested under realistic browser constraints.

The implementation should extend or wrap `scripts/review-server.mjs` rather than create an unrelated local-serving path.

## Automation Boundary

Automate deterministic checks. Keep physical-device proof manual and explicit.

Automated work should include:

- tool checks for Node, npm, Deno, Supabase CLI, Docker or Colima, Chrome, and certificate tooling;
- clean reset or preserve-data mode selection;
- local Supabase startup and health checks;
- Edge Function startup and CORS origin setup;
- patient and clinician HTTPS server startup;
- Supabase proxy checks from the iPad-facing origins;
- unit tests, lint, production build, surface builds, surface verification, browser E2E, and scripted local E2E;
- evidence file creation;
- clear terminal output with exact Mac and iPad URLs.

Manual work should include:

- trusting the local certificate on the iPad;
- installing or opening the local patient PWA from HTTPS;
- granting microphone permission;
- completing the physical iPad assessment flow;
- recording physical-device results and failure notes.

## Evidence Bundle

Each deployment-readiness run should produce a small evidence bundle. JSON is preferred for machine readability, with optional screenshots or notes referenced by path.

Minimum evidence:

- run timestamp and commit SHA;
- mode: deployment-readiness or debug;
- Mac network address and local HTTPS origins;
- local Supabase health result;
- Edge Function health result;
- clinician HTTPS health result;
- patient HTTPS health result;
- Supabase proxy health result;
- automated command results;
- iPad model and iPadOS version;
- installed-PWA result;
- microphone permission result;
- audio playback result;
- drawing save result;
- refresh/resume result;
- offline/retry result;
- patient completion result;
- clinician review/finalization result;
- CSV/PDF export result;
- failure notes with screen, task, visible message, timestamp, and matching local logs when available.

## Pass Criteria

Deployment readiness passes only when all of these are true:

- deployment-readiness mode ran from a clean local reset;
- automated checks passed;
- local HTTPS clinician and patient origins were used;
- iPad installed-PWA flow completed;
- the patient completed all tasks, including drawings and audio;
- autosave, refresh/resume, and offline/retry behavior were checked;
- clinician review and finalization completed;
- export behavior matched the local MVP rules;
- evidence was recorded.

Debug mode, HTTP browser testing, desktop-only testing, or partial patient completion cannot mark the app deployment-ready.

## Failure Handling

When the gate fails:

1. stop deployment discussion;
2. keep or preserve logs and evidence;
3. use debug mode to reproduce the issue;
4. fix locally;
5. rerun the relevant automated checks;
6. rerun deployment-readiness mode before returning to deployment planning.

This is meant to prevent repeated hosted-firefighting around `create-session`, `start-session`, drawing saves, and patient autosave flows.

## Later Phase: Deployment And Provider Evaluation

After the local gate is stable and passing, deployment planning can resume with the current stack first:

- GitHub;
- Netlify clinician and patient hosts;
- hosted Supabase.

Only after current-stack deployment is understood should a separate design compare alternative frontend hosts, backend services, managed Postgres/Supabase alternatives, VPS/self-hosted options, or stricter staging environments.
