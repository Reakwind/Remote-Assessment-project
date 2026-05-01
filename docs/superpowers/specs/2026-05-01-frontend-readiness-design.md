# Frontend Readiness Design

## Status

Approved design for implementation planning. This document defines the frontend readiness plan for the patient PWA, clinician operations app, and shared frontend foundation.

## Context

The product has two frontend surfaces:

- clinician website: authenticated case, session, review, finalization, and export workflow;
- patient PWA: tablet/phone-first assessment flow for test-number start, preflight, task completion, drawing/audio evidence, autosave, resume, and completion.

Recent work improved surface builds, mobile/tablet hardening, desktop density, local smoke coverage, and the local review server. The remaining frontend problem is that UI work can still happen as scattered fixes instead of a coherent pilot-readiness plan.

This design is separate from the local rehearsal gate. The rehearsal gate proves the stack works locally on Mac plus iPad. This frontend plan defines what the patient and clinician experiences should become before that gate is trusted for pilot readiness.

## Goal

Make the frontend ready for real pilot validation.

Priorities:

1. pilot usability;
2. reliability and debuggability;
3. agent-proof frontend structure.

The plan uses three coordinated tracks:

1. Patient PWA readiness.
2. Clinician operations app readiness.
3. Shared frontend foundation.

Implementation should happen in focused slices. This is not a single large rewrite.

## Non-Goals

- Do not change the clinical MoCA task order in this plan.
- Do not change backend contracts unless a later implementation slice explicitly requires it.
- Do not turn the patient PWA into a desktop website.
- Do not turn the clinician website into an installed PWA.
- Do not do a refactor-first rewrite before addressing pilot blockers.
- Do not evaluate hosting or backend provider alternatives in this frontend plan.

## Track 1: Patient PWA Readiness

The patient track is a moderate redesign. It keeps the clinical flow and backend contracts stable while improving the shell, task layouts, save states, and recovery paths.

Keep stable:

- 8-digit test-number start;
- current MoCA task order;
- current start, save, and complete Edge Function contracts;
- same-device resume model;
- local retry/autosave model;
- tablet/phone-first PWA direction.

Design target:

- A consistent task shell with clear header, MoCA version, progress, task title, concise instructions, main interaction area, and safe navigation.
- Drawing tasks with a stable canvas size, clear saved/saving/failed states, reduced accidental scroll or zoom, and recoverable upload failures.
- Audio tasks with explicit microphone permission, recording, saved, and retry states.
- Simple response tasks with compact instructions and obvious primary action.
- Failed saves that identify what failed and what the patient can do next.
- Resume that is visible and explicit without weakening one-time test-number semantics.
- Completion that clearly says the test was sent and no further patient action is needed.
- Phone fallback that remains usable and records device context for clinician interpretation.

Success criteria:

- A real iPad user can complete the full installed-PWA test without clipped controls, hidden save failures, or unclear recovery paths.
- The patient can recover from retryable save failures without guessing.
- The patient flow remains focused and free of clinician navigation.

## Track 2: Clinician Operations App Readiness

The clinician track should become an admin-grade clinical operations app. It should not stop at visual cleanup.

Core workflow areas:

- Cases: create and maintain complete pseudonymous patient profiles, with clear completeness status before test ordering.
- Tests: create a test, select version/language, copy/share the test number, and see whether it has been started.
- Work queue: separate pending patient start, in-progress, awaiting-review, and completed work from background history.
- Review workbench: show evidence, drawing review, audio evidence, manual scoring items, clinician notes, pending review count, and finalization state in one coherent workflow.
- Finalization and exports: make final vs provisional state, CSV warning, PDF availability, and export feedback obvious.

UI direction:

- Desktop/laptop-first.
- Information-dense but not cramped.
- One clear primary action per screen.
- No duplicate create/copy/finalize actions in the same context.
- Stable tables, filters, and status pills.
- Evidence and scoring should feel like a workbench, not a long form.

Success criteria:

- A clinician can create a case, create a test, monitor completion, review evidence, finalize, and export without hunting through oversized cards, duplicate actions, or unclear state.
- The dashboard makes actionable review work easier to find than passive history.
- Export and finalization rules are visible before the clinician clicks.

## Track 3: Shared Frontend Foundation

The shared foundation should prevent future one-off UI fixes without forcing a broad refactor before pilot blockers are handled.

Define:

- design tokens for spacing, typography, button heights, form density, status colors, surface backgrounds, and focus states;
- responsive rules for patient tablet/phone surfaces and clinician laptop/desktop surfaces;
- route and surface boundaries so patient builds do not expose clinician navigation and clinician builds do not ship patient PWA assets;
- reusable UI states for loading, empty, blocked, retryable error, saved, queued, offline, and completed;
- consistent autosave language and state mapping across drawing, audio, and simple task submission;
- component boundaries that remove real duplication without inventing a large design-system rewrite;
- frontend test coverage expectations for patient save/retry states, clinician workbench states, surface routing, and viewport behavior.

Success criteria:

- Future agents can find the frontend rules before making patient or clinician UI changes.
- New UI slices use shared state language and responsive rules.
- Shared components are extracted only where they simplify real repeated behavior.

## Implementation Slices

Suggested implementation order:

1. Patient shell and save-state language.
2. Patient drawing/audio recovery states.
3. Patient resume/completion/phone fallback polish.
4. Clinician information architecture and work queue.
5. Clinician review workbench and finalization/export clarity.
6. Shared tokens, responsive rules, and reusable state components as they are needed by the slices above.
7. Frontend documentation and test matrix updates.

Each slice should be independently reviewable and should list the patient, clinician, and shared-foundation impact.

## Verification And Evidence

Automated frontend checks:

- `cd client && npm test`;
- `cd client && npm run lint`;
- `cd client && npm run build`;
- `cd client && npm run build:surfaces`;
- `cd client && npm run verify:surface-builds`;
- `cd client && npm run e2e:browser`;
- `cd client && npm run e2e:patient-pwa` against a local patient preview when patient PWA routing, installability, or task flow changes.

Add targeted tests for:

- patient save/retry state components;
- patient drawing and audio failure recovery;
- clinician workbench states;
- clinician finalization/export state;
- surface routing and route hiding;
- responsive behavior for patient tablet/phone and clinician laptop layouts.

Manual and visual checks:

- patient iPad installed-PWA walkthrough;
- patient iPad Safari browser fallback;
- phone portrait fallback;
- clinician laptop/desktop walkthrough;
- screenshot or note evidence for task shell, drawing, audio, retry, resume, completion, review workbench, finalization, and exports.

Record skipped checks and why.

## Pass Criteria

Frontend readiness passes when:

- patient installed-PWA pilot path completes on iPad;
- save/retry states are visible, understandable, and recoverable;
- clinician operations workflow completes from case creation through final export;
- no obvious clipped controls, duplicate primary actions, misaligned headers, or oversized layouts remain in the pilot path;
- automated frontend checks pass;
- manual device and desktop evidence is recorded;
- future agents can find this plan and the related verification expectations.

## Relationship To Local Rehearsal Gate

The local rehearsal gate proves the full stack locally. This frontend plan defines the frontend quality bar that the rehearsal should exercise.

If the frontend plan and local rehearsal gate conflict, prefer the stricter pilot-readiness requirement and update both docs in the same implementation branch.

Deployment remains out of scope until the local rehearsal gate and frontend readiness evidence both pass.
