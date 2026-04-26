# Security And Reliability Backlog

This backlog distills the useful findings from `CODE_REVIEW_2026-04-26.md`. The root review file is not a source of truth; keep durable decisions here, in `JOURNEY.md`, and in code.

## First Implementation Slice

Branch used for the first slice: `codex/security-reliability-hardening`

Scope:

- Add patient test-number start rate limiting and attempt auditing.
- Consolidate Edge Function CORS behavior on the shared allowed-origin helper.
- Clamp client preview scoring where the server already clamps.
- Record durable notification failure outcomes when completion notification code throws.
- Keep full offline autosave hardening as the next dedicated branch.

## Prioritized Backlog

| Priority | Item | Reason | Status |
|---|---|---|---|
| P0 | Rate-limit and audit `start-session` attempts | Protects active patient test numbers from brute-force starts and forged evidence. | First slice |
| P0 | Reliable autosave queue for task results and drawings | Prevents silent data loss on flaky patient connections. | Next branch |
| P1 | Hosted Supabase storage/security verification | Confirms remote audio/drawing/stimuli buckets match private local policy. | Backlog |
| P1 | Unify Edge Function CORS | Reduces accidental broad-origin exposure and keeps hosted config explicit. | First slice |
| P1 | Notification failure durability | Keeps completion notification failures observable and retry-ready. | First slice |
| P1 | Patient data schema guardrails | Enforce pseudonymous case ID behavior at the database boundary while preserving approved clinical fields. | Backlog |
| P2 | Migration baseline cleanup after hosted reconciliation | Reduces replay complexity after remote schema drift is understood. | Backlog |
| P2 | Drop dead legacy security-definer functions/indexes | Removes unused privileged schema surface from historical migrations. | Backlog |
| P2 | Stimulus manifest lookup optimization | Reduces per-session storage round trips as assets grow. | Backlog |
| P3 | Setup-screen fallback for missing Vite Supabase env | Avoids blank app screen in misconfigured local/dev environments. | Backlog |

## Autosave Follow-Up Scope

Use a separate branch because this changes patient flow behavior and needs more browser testing.

- Add a per-task pending/saved/error state in the assessment store.
- Retry failed `submit-task`, `save-drawing`, and `save-audio` calls with bounded backoff.
- Persist unsent task payloads locally so refresh does not lose evidence.
- Block final completion while required evidence is still unsynced.
- Surface clear patient-facing retry copy when sync is failing.

## Notes

- Phone, date of birth, gender, language, dominant hand, and education years are approved MVP clinical context fields.
- Licensed MoCA assets remain outside Git and are verified through the existing stimulus runbook.
- Hosted Supabase changes still follow `docs/SUPABASE_RECONCILIATION.md`.
