# Development Process

This project uses Supabase as the current MVP runtime. The product architecture is the Remote Check app contract: clinician/session/patient/review/scoring workflows, API payloads, persisted evidence, and verification expectations. Keep platform-specific code isolated so Supabase can be replaced later without rewriting the product.

## Core Rules

- Use `/Users/etaycohen/Projects/Remote-Assessment-project-main` as the active local checkout.
- Do not run repo work from OneDrive, CloudStorage, or other synced clones. If `pwd` shows `/Users/etaycohen/Library/CloudStorage/OneDrive-Personal/...`, switch checkouts before continuing.
- Start every change from latest `origin/main`.
- Work on a feature branch, preferably `codex/<short-scope>`.
- Keep each branch focused on one feature, bug fix, or cleanup.
- Open a normal, ready-for-review PR into `main` for every repo change after the relevant checks pass.
- Do not default to draft PRs. The current GitHub connector can create, close, and merge PRs, but the draft-to-ready mutation is unreliable. Use draft PRs only when explicitly needed, and record whether conversion requires the GitHub UI or a working `gh` login.
- Record verification performed, skipped checks, risks, and follow-up work in the PR.
- Update `docs/AGENT_LEARNINGS.md` before merge when review findings, recurring bugs, or new verification patterns produce reusable lessons for future agents.
- Merge only after explicit user approval for that PR.

## Feature Slice

Build features as complete vertical slices:

- Surface journey: clinician website or patient PWA screens, states, errors, and copy.
- App contract: request/response shapes, validation, status transitions, and permissions.
- Persistence: records, storage paths, audit events, and retryable outcomes.
- Review/scoring: deterministic scoring, manual review state, and finalization rules.
- Verification: unit tests, browser checks, local Supabase E2E when the flow touches backend behavior.
- Documentation: update `JOURNEY.md` when user-facing journey, backend journey, status, review, scoring, notification, or export behavior changes.
- Documentation: update `docs/AGENT_LEARNINGS.md` when the branch teaches a durable engineering lesson beyond the immediate code diff.

## Provider Boundaries

Use Supabase directly where MVP speed matters, and keep usage behind stable app boundaries:

- Auth: clinician identity, session lookup, and permission checks.
- Database: repository-style reads/writes for cases, sessions, results, reports, reviews, audits, and notifications.
- Storage: private object paths, upload/download, signed URLs, content types, and retention rules.
- Functions/API: Edge Function handlers expose app-level contracts such as `create-session`, `start-session`, `save-audio`, `complete-session`, and review updates.
- Notifications: email/SMS/transcription providers sit behind swappable service functions.

Client code should depend on app concepts rather than database details. Shared scoring, validation, task mapping, and report logic should remain provider-independent whenever practical.

## Surface Boundaries

The product has two frontend surfaces:

- Clinician website: authenticated dashboard for case/session management, review, scoring, finalization, and exports.
- Patient PWA: tablet/phone-first assessment app for test-number start, system check, drawing/audio/task evidence, autosave, and completion.

Read `docs/PATIENT_PWA_ARCHITECTURE.md` before changing patient routes, installability, service-worker behavior, deployment targets, mobile/tablet layout, drawing UX, or cache policy. Read `docs/PATIENT_PWA_DEPLOYMENT.md` before changing surface build scripts, deployment output directories, host fallback rules, or patient PWA cache headers.

Rules:

- Do not redesign patient tasks as desktop website pages.
- Do not expose clinician navigation inside the installed patient PWA.
- Keep PWA caching to static app-shell assets unless a later architecture decision explicitly approves more.
- Keep patient PHI, task evidence, Supabase API responses, signed URLs, PDF exports, and CSV exports out of service-worker caches.
- Verify patient changes in phone and tablet viewports, and in installed PWA/home-screen mode before clinical pilot.

## Verification Tiers

Use the smallest check set that covers the risk:

- Docs-only: link/search verification is enough.
- Frontend-only: unit tests, lint, build, and targeted browser checks.
- Backend/session/storage/review/scoring changes: unit tests, lint, build, Deno checks, Edge Function unit tests, local Supabase functions, scripted Supabase E2E, and Playwright browser E2E.
- Hosted Supabase work: follow `docs/SUPABASE_RECONCILIATION.md`, inspect drift first, get explicit approval before remote-changing commands, and record rollback notes for destructive actions.

GitHub CI runs the stable baseline plus local contract E2E: Deno Edge Function unit tests, scripted Supabase E2E, and Playwright browser E2E. Local clinical-readiness checks are still required when the branch depends on licensed PDFs, uploaded private Storage stimuli, installed PWA behavior, real-device browser behavior, or hosted Supabase configuration.

## Platform Portability

When adding backend behavior, define the app contract first:

- Name the user action and lifecycle transition.
- Specify the request, response, and error cases.
- Decide what data is stored and what is returned to the browser.
- Keep private credentials, bearer tokens, storage object paths, and signed URLs scoped to the smallest necessary surface.
- Put deterministic domain logic in shared modules instead of embedding it in platform glue.
- Keep provider assumptions visible in docs or code names when they are unavoidable.

## Review Checklist

Before asking to merge:

- The branch is current with `origin/main`.
- The diff is focused and understandable.
- The app journey still matches `JOURNEY.md`.
- Patient data handling follows the MVP privacy guardrails.
- Scoring remains deterministic/manual according to the active manual.
- Supabase-specific changes are isolated and documented.
- Verification results and skipped checks are listed in the PR.
