# Project Context: Remote Neuropsychological Assessment (Hebrew MoCA)

## 1. Vision & Purpose
A remote, web-based platform for cognitive assessment of the 60+ population in Israel.
- **Initial Goal:** Complete digital implementation of the Hebrew MoCA (Montreal Cognitive Assessment).
- **Flexibility:** Modular "Battery Engine" (JSON-driven) allows swapping tests (Developer-led).
- **Accessibility:** Minimalist, high-contrast Hebrew interface (RTL) with computer orientation for older users.

## 2. Technical Stack
- **Frontend:** React, TypeScript, Vanilla CSS (RTL).
- **Drawing:** HTML5 Canvas for Trail Making (1-א-2-ב...) and Clock Drawing.
- **Backend:** Supabase (Auth, PostgreSQL) - targeting AWS/Google Israel Region for compliance.
- **Norms:** Israeli validation (Lifshitz et al., 2012) using a decoupled JSON-based Scoring Engine.

## 3. Core Requirements
- **Scoring:** Hybrid approach. Automated math/trails, manual clinician review for subjective drawings (Clock/Cube).
- **Fallback:** Manual link sharing (Clinician copies/sends via WhatsApp/Email).
- **Reliability:** Per-section auto-save and patient retries for timed tasks on connection loss.
- **Privacy:** Pseudonymization (Case IDs in database, names only on clinician end).

## 4. MVP Roadmap
1. **Engine Setup:** JSON-driven test runner with RTL Layout.
2. **Orientation Module:** Familiarize older adults with the digital interface.
3. **MoCA Implementation:** Drawing Canvas (Trails/Clock) + Stimuli (Hebrew lists/images).
4. **Scoring Engine:** Logic for Israeli norms and education adjustments.
5. **Clinician Dashboard:** Patient management, link generation, and manual scoring review.
