# Hebrew Terminology

This file is the canonical Hebrew UI terminology guide for the Pilot MVP. Use it when writing patient-facing copy, clinician dashboard copy, review rubrics, tests, and documentation. Update it when a product decision changes user-facing language.

## Core Terms

| Concept | Canonical Hebrew | Notes |
|---|---|---|
| Assessment session | מבדק | Use for one patient assessment instance. |
| Clinical case record | תיק | Clinician-facing record container. |
| Pseudonymous case identifier | מזהה תיק | Use case IDs, not patient names or national IDs. |
| Patient start number | מספר מבדק | The 8-digit number the clinician copies and shares outside the app. |
| Dashboard user | קלינאי | Use inside clinician UI and audit views. |
| Referring therapist | המטפל המפנה | Use only in patient-facing completion handoff copy. |
| Patient | מטופל | Keep consistent across UI. |
| Review | סקירה | Use for clinician review; avoid generic בדיקה for review status. |

## Status Labels

| Value | Canonical Hebrew |
|---|---|
| `new` | חדש |
| `pending` | טרם החל |
| `in_progress` | בתהליך |
| `review` | דורש סקירה |
| `awaiting_review` | ממתין לסקירה |
| `completed` | הושלם |

Use `StatusPill` for status display instead of local status dictionaries.

## Task Labels

| Task | Patient label | Clinician label |
|---|---|---|
| Trail Making | חיבור נקודות | חיבור נקודות |
| Cube copy | העתקת קובייה | קובייה |
| Clock drawing | ציור שעון | שעון |
| Naming | שיום | שיום |
| Memory learning | למידת מילים | למידת מילים |
| Digit span | קיבולת זיכרון | קיבולת זיכרון |
| Vigilance | קשב לאות א | קשב לאות א |
| Serial 7s | חיסור 7 | חיסור 7 |
| Language | שפה | שפה |
| Abstraction | הפשטה | הפשטה |
| Delayed recall | שליפה מושהית | שליפה מושהית |
| Orientation | התמצאות | התמצאות |

## CTA Terms

| Action | Canonical CTA |
|---|---|
| Start patient assessment | התחל מבדק |
| Resume patient assessment | המשך מהמקום שעצרת |
| Create case | פתח תיק |
| Open/order assessment | פתח מבדק |
| Create start number | צור מספר מבדק |
| Copy start number | העתק מספר מבדק |
| Review session | סקור |
| View completed session | צפה |
| Export PDF | ייצוא PDF |
| Export CSV | ייצוא CSV |
| Save score | שמור ניקוד |

## Clinical Copy Rules

- Keep patient task instructions neutral. Cognitive testing is not framed as pass/fail.
- Patient-facing task screens should not reveal expected answers, target counts, or scored sequences.
- Patient-visible copy may mention MoCA/version only where current journey docs require traceability.
- Clinician review screens may show expected answers and rubrics when needed for scoring.
- Label provisional or incomplete scores clearly with `(זמני)` or show only final scores.
- Use deterministic/manual scoring language: `נוקד אוטומטית` for rule-scored items, `דורש סקירה` for clinician judgment.
- Do not use native `alert()` in clinician workflows; use inline messages or dialogs.
- Do not render `patients.full_name` as a fallback identity. Use `case_id` or a safe record/session identifier.

## Review Checklist

Flag these in PR review:

- `מבחן` in active UI where `מבדק` is intended.
- `קוד מבחן`, `קוד מבדק`, or `מספר מבחן` where `מספר מבדק` is intended.
- `בבדיקה` as a status label.
- `הוזמן` as a status label.
- Bare `אישור`, `CSV`, or `PDF` buttons where a verb-first CTA is clearer.
- Native `alert()`.
- Patient `full_name` fallback.
- Provisional score shown without a provisional label.
