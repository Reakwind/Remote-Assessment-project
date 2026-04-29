# UX Copy And Terminology Audit Backlog

Date: 2026-04-26

Source: Claude extended UX/UI audit supplied by the user. This backlog preserves the useful findings without making the raw chat transcript the source of truth.

## High-Confidence Fixes

These items are approved for normal feature branches because they align with current MVP guardrails and do not require a product decision.

| Area | Backlog item | Status |
|---|---|---|
| Hebrew terminology | Use `מבדק`, `מספר מבדק`, canonical task labels, and canonical lifecycle labels from `docs/HEBREW_TERMINOLOGY.md`. | Started |
| Status display | Use `StatusPill` instead of duplicated local status maps. | Started |
| PII display | Remove `patients.full_name` as a UI fallback; show case ID or a safe record/session identifier. | Started |
| Patient task validity | Remove copy that leaks expected answers or promises behavior that does not exist. | Started |
| Clinician rubric wording | Tighten rubrics for Trail Making, cube, vigilance, sentence repetition, and fluency threshold. | Started |
| Provisional scores | Hide or label provisional scores instead of showing them as final. | Started |
| Clinician alerts | Replace native `alert()` with inline feedback/dialog patterns. | Started |

## Product Decisions Needed

These findings are plausible, but they conflict with existing journey decisions or need explicit clinical/product direction before implementation.

| Topic | Decision needed |
|---|---|
| Patient visibility of MoCA/version | `JOURNEY.md` currently says the selected MoCA version is visible in the assessment header for traceability. The audit recommends hiding MoCA/version from patient chrome. Decide before changing. |
| Full i18n adoption | `CONTEXT.md` mentions future `react-i18next`, but the package is not currently installed. Decide whether to add i18n now or keep copy centralized through docs/constants first. |
| Gender-aware Hebrew copy | Patient profile stores gender, but the active UI uses mostly masculine singular. Decide whether to implement gender-aware copy in MVP or defer. |
| Patient completion task count | Current completion can mention completed tasks; the audit recommends avoiding numeric completion language. Decide based on patient reassurance vs score-anxiety risk. |

## Deferred Refactors

| Area | Deferred work |
|---|---|
| Clinician detail decomposition | `ClinicianDashboardDetail.tsx` remains a large component. Split only when touching review workflow deeply. |
| Central copy constants | After terminology stabilizes, move task labels/status labels to a small shared copy module or i18n resources. |
| Copy drift checks | Add a lightweight CI/script check for forbidden terms once the terminology file has been exercised across one or two PRs. |
