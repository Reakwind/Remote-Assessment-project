# Agent Learnings

This file captures durable engineering rules for future agents. Keep it short:
add a lesson only when a PR, review finding, or repeated failure exposes a
reusable rule. Put raw history in PRs or archived notes, not here.

## Current Rules

| Area | Rule | Required verification |
| --- | --- | --- |
| Patient session lifecycle | Model start, resume, autosave, invalid-session, and completion states together before changing any one of them. Completion must stop on known save errors. | Resume after refresh, invalid or expired session handling, completion routing, touched mobile viewports. |
| Edge Function boundaries | Threat-model `create-session`, `start-session`, `get-session`, media access, review, export, and notification changes before implementation. Service-role functions must enforce app-level auth. | One test per abuse or ownership boundary, Deno check for touched functions, local Supabase/browser E2E when session or storage contracts change. |
| Escaped regressions | Convert real QA or review regressions into permanent focused tests in the same branch. | Re-run the exact escaped bug coverage plus nearby patient or clinician flow regressions. |
| Scoring authority | Keep client preview scoring aligned with server scoring. Inspect both client and Supabase shared scoring modules when deterministic rules change. | Client and server scoring tests, plus manual-review fallback checks for unsupported or ambiguous inputs. |
| Edge Function naming | Keep one canonical Edge Function route per app contract. Do not preserve aliases without a documented compatibility window. | `rg` for removed aliases, helper-driven Deno checks, browser/local E2E through the canonical route. |
| Hebrew copy | Treat Hebrew clinical copy as product behavior. Use `docs/HEBREW_TERMINOLOGY.md` before changing patient copy, dashboard labels, status labels, task names, or rubrics. | Updated text assertions and search for avoided terms in touched surfaces. |
| Patient PWA surface | Patient work is tablet/phone-first PWA work, not desktop website work. Cache only static app-shell assets. | Phone portrait, tablet portrait or landscape, installed PWA/home-screen mode before clinical pilot, local Supabase E2E for contract changes. |
| Stimulus manifest | Keep the MoCA stimulus manifest visual-only. Memory learning uses generated Hebrew browser speech, not a licensed MP3. | `node scripts/verify-stimuli.mjs --all-versions` after assets are uploaded; browser checks for Hebrew audio preflight and memory recording. |
| Clinician signup | Treat email-confirmation signup as unauthenticated until Supabase returns a browser session. Avoid client profile writes without a session. | Unit test no-session signup behavior and migration smoke for Auth-created clinician profile rows. |
| Hosted readiness | Hosted shell smoke is not hosted backend readiness. Verify Edge Function CORS from real hosted patient and clinician origins. | Hosted smoke with `HOSTED_SUPABASE_URL`, `PATIENT_STAGING_URL`, and `CLINICIAN_STAGING_URL`. |
| Licensed assets in CI | Keep full local E2E in CI, but use `--skip-licensed-pdf-check` only where licensed PDFs are intentionally unavailable. | Deno tests, CI local E2E with skipped PDF check, browser E2E, and local clinical-readiness checks without the skip when needed. |
| Bulk QA | Keep bulk success-flow QA separate from abuse/rate-limit probes. Use unique batch prefixes and clean them up. | Small bulk preflight, `--report-batch`, and `--cleanup-batch` for the same batch. |
| Hosted Supabase | Use Supabase MCP or CLI fallback for read-only hosted inspection before hosted deploys. Remote-changing commands require explicit approval. | Record migration, function, secret-name, storage, and advisor/lint summaries in PRs or handoffs. |
| Supabase hardening | Do not leave legacy public RPCs, views, or trigger helpers directly callable by browser roles. Privileged functions need explicit `search_path`; private buckets need repo-defined MIME and size limits. | Migration list, DB lint, targeted function/storage inspection, and Deno CORS tests for touched Edge Function helpers. |
| CI/CD orchestration | Use `docs/CI_CD_AGENT_RUNBOOK.md` for GitHub, Netlify, and Supabase delivery. Keep Edge Function lists in `scripts/edge-functions.mjs`. | Helper-driven Deno checks and hosted smoke after hosted frontend or Supabase changes. |
| Documentation authority | Keep the default read-first path short. Archive historical plans, remove stale setup notes, and replace copied command lists with checked-in helpers. | Broken-link check, stale-term search, `git diff --check`, and no duplicated Edge Function command lists in active docs. |

## Update Rule

Update this file before merge only when a branch:

- fixes a recurring bug class,
- addresses a review finding that creates a reusable engineering rule,
- adds a new required verification pattern, or
- exposes a repeated failure mode across PRs.

Keep each lesson as a rule plus verification. Do not add full retrospectives.
