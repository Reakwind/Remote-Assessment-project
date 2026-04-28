# Project Context: Remote Neuropsychological Assessment (Hebrew MoCA)

## 1. Vision & Purpose
A remote assessment platform for cognitive assessment of the 60+ population in Israel. Current `main` is the Pilot MVP baseline.
- **Initial Goal:** Complete digital implementation of the Hebrew MoCA (Montreal Cognitive Assessment).
- **Surface Direction:** Clinician work remains a website; patient assessment is moving to a tablet/phone-first PWA for touch/stylus workflows.
- **Flexibility:** Modular "Playlist Engine" (JSON-driven) with future i18n support for Arabic/Russian/English versions. `react-i18next` is not wired into the current MVP client.
- **Accessibility:** Minimalist, high-contrast Hebrew interface (RTL) with a computer orientation module.

## 2. Technical Stack
- **Frontend:** React, TypeScript, Vite, Tailwind/Radix UI, RTL Hebrew UI. Clinician website and patient PWA should remain explicit surfaces.
- **Drawing:** HTML5 Canvas for Trail Making and Clock Drawing.
- **Backend:** Supabase (Auth, PostgreSQL) - targeting AWS/Google Israel Region.
- **Data Architecture:** 
    - **Raw Scores Table:** Structured for research export (Excel) and clinical reporting (PDF).
    - **UX Metadata Table:** Tracks engagement metrics (time per task, undo counts, retries) for usability analysis.

## 3. Core Requirements
- **Scoring:** Hybrid Engine. Automated math/trails, manual review for drawings. Decoupled JSON-based Scoring Engine with Israeli norms.
- **Access:** Clinician creates a case-ID-only case record and generated test number entered by the patient on the home page.
- **Fallback:** Clinician shares the test number outside the app to keep MVP messaging costs at zero.
- **Reliability:** Per-section auto-save and patient retries for connection loss.
- **Privacy:** Pseudonymization (case IDs only in active MVP workflow).

## 4. MVP Roadmap
1. **Engine Setup:** i18n-ready JSON runner with RTL Layout. (DONE)
2. **Orientation Module:** Basic digital literacy training for older users. (DONE)
3. **MoCA Implementation:** Drawing Canvas + All Core Stimuli (Hebrew word lists/animals/tasks). (DONE)
4. **Scoring Engine + Supabase Schema:** Logic for Israeli norms + full DB design. (DONE)
   - lib/scoring/{index,scorers,norms,utils}.ts — pure functions, TDD'd, 95/95 tests
   - Drawing tasks (cube/clock/trails) → needsReview=true, clinician manual rubric per SPEC 3.6.2
   - Unsupported or malformed rule-scoring payloads → needsReview=true, rawData preserved, never silently zero
   - Norm percentile computed locally from lifshitz-norms.json (no external calls)
   - useScoring hook bridges battery state to scoreSession
   - save-drawing Edge Function: canvas PNG → Supabase Storage only
5. **Clinician Dashboard:** Patient management, export tools (Excel/PDF), and manual review interface. (DONE)
6. **Polishing & Export:** Final UX refinements, PDF generation, and CSV export tools. (MVP BASELINE)

## 5. Current Operating Model
- Active local checkout: `/Users/etaycohen/Projects/Remote-Assessment-project-main`.
- Do not use OneDrive, CloudStorage, or other synced checkouts for repo work.
- `main` is the MVP baseline and integration branch.
- New work starts from latest `origin/main` on a feature branch.
- Changes are reviewed through GitHub PRs and merge only after explicit user approval.
- `JOURNEY.md` must be updated when patient, clinician, backend, scoring, notification, or review behavior changes.
- `docs/PATIENT_PWA_ARCHITECTURE.md` must be updated when patient PWA installability, deployment split, tablet/phone UX, service-worker caching, or clinician/patient surface boundaries change.
