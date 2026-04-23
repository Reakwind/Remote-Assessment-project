---
title: "feat: Clinician Onboarding, Patient Management & Assessment Delivery Flow"
type: feat
status: active
date: 2026-04-23
---

# Clinician Onboarding, Patient Management & Assessment Delivery Flow

## Overview

Three interconnected features that complete the end-to-end clinical workflow: (1) clinician sign-up/sign-in with two-factor authentication via Google Authenticator, (2) patient onboarding with assessment ordering and SMS delivery, and (3) patient assessment completion with clinician notification and results review. The codebase already has partial implementations of each area — this plan fills the gaps, connects the pieces, and hardens the flow.

## Problem Frame

The platform currently has basic email/password auth for clinicians, a session-creation form embedded in the dashboard list, and a patient assessment flow accessed via link tokens. However, the onboarding is incomplete (no TOTP 2FA), patient management is ad-hoc (no dedicated patient records or profiles), assessment ordering lacks explicit battery selection, the SMS message doesn't include a one-time code, and the completion-notification email is functional but the results-review experience needs to display real data. These three features close the loop from clinician sign-up through patient assessment results.

## Requirements Trace

### Feature 1: Clinician Onboarding & 2FA

- R1. Clinician can sign up with email and password (existing, needs polish)
- R2. Clinician can sign in with email and password (existing, needs polish)
- R3. After email/password sign-in, clinician must complete a second factor using Google Authenticator (TOTP)
- R4. Clinician can enroll a TOTP device during first sign-in or from profile settings
- R5. 2FA is required for all subsequent dashboard access

### Feature 2: Patient Onboarding & Assessment Ordering

- R6. Clinician can add a new patient via an "Add New Patient" button in the dashboard, entering patient info including phone number
- R7. A `patients` table stores persistent patient records linked to the clinician
- R8. Clinician can view a patient profile page listing the patient's info and assessment history
- R9. Inside the patient profile, clinician can press "Order Assessment Battery" and select MoCA (the only option for now)
- R10. When the clinician orders an assessment, an SMS is sent to the patient in Hebrew with an introductory message, a link to the app, and a one-time access code
- R11. The one-time code must be entered by the patient before the assessment begins

### Feature 3: Assessment Completion & Results

- R12. When the patient opens the link and enters the code, they begin the assessment (existing flow, adapted for code entry)
- R13. When the assessment is completed, an email is automatically sent to the clinician (existing, verify working)
- R14. The clinician can log in and examine results on the patient profile / dashboard detail page (existing, needs real data binding)
- R15. The clinician can export results as CSV or PDF (existing)

## Scope Boundaries

- Only MoCA assessment battery is supported; no UI for adding other battery types yet
- Google Authenticator specifically means standard TOTP — any TOTP app (Authy, 1Password, etc.) will work
- No patient self-registration; patients are always onboarded by a clinician
- No multi-clinic / team management in this iteration
- No password reset flow (can be deferred to a separate task)

### Deferred to Separate Tasks

- Additional assessment battery types beyond MoCA: future iteration
- Clinician password reset / forgot password flow: separate PR
- Multi-tenancy / clinic-level access control: future iteration
- SMS delivery confirmation webhooks from Twilio: future enhancement

## Context & Research

### Relevant Code and Patterns

- **Auth:** `client/src/app/components/auth/useClinicianAuth.ts` — existing email/password auth hook using Supabase `signInWithPassword` / `signUp`
- **Auth page:** `client/src/app/components/auth/ClinicianAuthPage.tsx` — sign-in/sign-up form with Hebrew UI
- **Protected route:** `client/src/app/components/auth/ClinicianProtectedRoute.tsx` — redirects to `/clinician/auth` if not signed in
- **Dashboard:** `client/src/app/components/ClinicianDashboardList.tsx` — patient list with inline session creation form
- **Detail:** `client/src/app/components/ClinicianDashboardDetail.tsx` — session detail with rubric, drawing playback, export
- **Session creation:** `supabase/functions/create-session/index.ts` — creates session + sends SMS via Twilio
- **Session completion:** `supabase/functions/complete-session/index.ts` — marks complete + emails clinician via Resend
- **Notifications:** `supabase/functions/_shared/notifications.ts` — Twilio SMS + Resend email helpers
- **DB schema:** `supabase/migrations/20260421000001_initial_schema.sql` — sessions, task_results, scoring_reports, drawing_reviews
- **Clinicians table:** `supabase/migrations/20260423000008_clinicians_and_session_contact.sql` — clinicians profile + session contact columns
- **Session validation:** `client/src/app/components/SessionValidation.tsx` — validates link token and starts assessment
- **Patient welcome:** `client/src/app/components/PatientWelcome.tsx` — patient-facing welcome screen
- **Routes:** `client/src/app/routes.tsx` — hash router with patient, dashboard, and auth routes

### External References

- Supabase Auth MFA (TOTP) API: `supabase.auth.mfa.enroll()`, `supabase.auth.mfa.challenge()`, `supabase.auth.mfa.verify()`
- Supabase Auth MFA requires the `mfa` feature to be enabled in the Supabase project settings
- TOTP standard (RFC 6238) — compatible with Google Authenticator, Authy, 1Password

## Key Technical Decisions

- **TOTP via Supabase MFA API:** Supabase has built-in TOTP support (`auth.mfa.*`). Use this rather than a custom TOTP implementation. The enrollment flow generates a QR code the clinician scans with Google Authenticator.
- **Separate `patients` table:** Currently patients are modeled implicitly as sessions. Introduce a proper `patients` table so a clinician can have multiple assessments per patient over time. Each session is linked to a patient (not just a case_id string).
- **One-time access code as separate field:** Add an `access_code` column (6-digit numeric) to `sessions`. The SMS includes both the link and the code. The patient must enter the code on the landing page to begin. This replaces the current auto-start behavior where the link token alone grants access.
- **Assessment battery selection:** Add an `assessment_type` column to `sessions` (default `'moca'`). The UI presents a battery picker with MoCA as the only option. This is forward-compatible for future battery types.
- **Patient profile page:** Add a new route `/dashboard/patient/:patientId` that shows patient info + a list of their assessments. The existing `/dashboard/:sessionId` detail view remains for individual session review.

## Open Questions

### Resolved During Planning

- **Q: Should 2FA be enforced on sign-up or first sign-in?** Resolution: On first sign-in. During sign-up the account is created, and on the first successful email/password sign-in the user is prompted to enroll TOTP. Subsequent sign-ins require the TOTP code.
- **Q: Should the one-time code replace or supplement the link token?** Resolution: Supplement. The link token identifies the session, the code provides an additional verification step. Both are required.
- **Q: Where do patients live vs. sessions?** Resolution: A new `patients` table holds persistent patient info (name, phone, ID, notes). Sessions reference `patient_id` in addition to `clinician_id`.

### Deferred to Implementation

- Exact QR code rendering library choice for TOTP enrollment (likely `qrcode.react` or similar)
- Whether `access_code` generation uses crypto-random or sequential digits
- Exact Hebrew copy for SMS messages and email templates — to be refined during implementation

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Clinician Sign-Up & Sign-In Flow:
  1. Clinician fills email/password form → Supabase signUp / signInWithPassword
  2. On successful password auth, check MFA enrollment status via auth.mfa.listFactors()
  3. If no TOTP factor enrolled → show enrollment screen (QR code + verify code)
  4. If TOTP factor enrolled → show TOTP verification screen (enter 6-digit code)
  5. On successful TOTP verification → grant dashboard access
  6. ClinicianProtectedRoute checks both session AND MFA assurance level

Patient Onboarding & Assessment Ordering Flow:
  1. Clinician clicks "Add Patient" → form collects patient info → INSERT into patients
  2. Clinician views patient profile → sees info + assessment history
  3. Clinician clicks "Order Assessment" → selects MoCA → system creates session with:
     - patient_id, clinician_id, assessment_type='moca'
     - Generated access_code (6-digit)
     - Sends SMS: Hebrew intro + link + access code
  4. Session row is created with status='pending'

Patient Assessment & Results Flow:
  1. Patient opens link → SessionValidation page
  2. Patient enters access_code → verified against session record
  3. On match → assessment begins (existing flow)
  4. On completion → complete-session Edge Function fires
  5. Email sent to clinician → clinician logs in → views results
```

## Implementation Units

- [ ] **Unit 1: Database — `patients` table and session schema updates**

**Goal:** Create the `patients` table and add `patient_id`, `access_code`, and `assessment_type` columns to `sessions`.

**Requirements:** R7, R10, R11, R9

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/20260423000009_patients_table_and_session_updates.sql`

**Approach:**
- Create `patients` table with columns: `id` (UUID PK), `clinician_id` (FK → auth.users), `full_name`, `phone`, `date_of_birth` (optional), `id_number` (optional), `notes`, `created_at`, `updated_at`
- Add RLS policies: clinicians can CRUD their own patients, service role has full access
- Add `patient_id` (FK → patients, nullable for backward compat) to `sessions`
- Add `access_code` (VARCHAR(6)) to `sessions`
- Add `assessment_type` (VARCHAR(20), default `'moca'`) to `sessions`
- Add index on `patients(clinician_id)` and `sessions(patient_id)`
- Add trigger for `patients.updated_at`

**Patterns to follow:**
- `supabase/migrations/20260423000008_clinicians_and_session_contact.sql` for RLS policy style
- `supabase/migrations/20260421000001_initial_schema.sql` for table/index conventions

**Test scenarios:**
- Happy path: Migration applies cleanly on a fresh database with existing schema
- Happy path: Inserting a patient with all fields succeeds
- Happy path: Inserting a session with `patient_id`, `access_code`, and `assessment_type` succeeds
- Edge case: `access_code` column allows exactly 6 characters
- Edge case: `assessment_type` defaults to `'moca'` when not specified
- Integration: RLS policies prevent clinician A from reading clinician B's patients

**Verification:**
- Migration runs without errors against the existing schema
- All new columns, indexes, and policies are present

---

- [ ] **Unit 2: TOTP 2FA enrollment and verification UI**

**Goal:** Add TOTP enrollment (QR code + verification) and sign-in verification screens to the clinician auth flow.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 1 (for any profile schema if needed, but primarily standalone)

**Files:**
- Create: `client/src/app/components/auth/TotpEnrollment.tsx`
- Create: `client/src/app/components/auth/TotpVerification.tsx`
- Modify: `client/src/app/components/auth/useClinicianAuth.ts`
- Modify: `client/src/app/components/auth/ClinicianAuthPage.tsx`
- Modify: `client/src/app/components/auth/ClinicianProtectedRoute.tsx`

**Approach:**
- After successful `signInWithPassword`, check `supabase.auth.mfa.listFactors()` for enrolled TOTP factors
- If no factors → route to `TotpEnrollment` which calls `supabase.auth.mfa.enroll({ factorType: 'totp' })`, displays the QR code (from `totp.qr_code` data URI), and prompts for a verification code
- If factor exists → route to `TotpVerification` which calls `supabase.auth.mfa.challenge()` then `supabase.auth.mfa.verify()` with the entered code
- Update `useClinicianAuth` to expose MFA state: `mfaRequired`, `mfaEnrolled`, `enrollTotp()`, `verifyTotp()`
- Update `ClinicianProtectedRoute` to check the session's AAL (Authenticator Assurance Level) — require `aal2` for dashboard access
- All UI in Hebrew RTL consistent with existing auth page styling

**Patterns to follow:**
- `client/src/app/components/auth/ClinicianAuthPage.tsx` for form styling, Hebrew labels, RTL layout
- `client/src/app/components/auth/useClinicianAuth.ts` for hook structure

**Test scenarios:**
- Happy path: New clinician signs up, signs in, sees TOTP enrollment QR code, enters valid code, gains dashboard access
- Happy path: Returning clinician signs in, sees TOTP prompt, enters valid code, reaches dashboard
- Error path: Invalid TOTP code shows Hebrew error message and allows retry
- Error path: Expired TOTP challenge shows meaningful error
- Edge case: Clinician who has completed 2FA enrollment but not yet verified their first code is re-prompted
- Integration: `ClinicianProtectedRoute` redirects to TOTP screen when session is `aal1` (password only, no 2FA yet)

**Verification:**
- Sign-up → sign-in → TOTP enrollment → dashboard access works end-to-end
- Direct `/dashboard` navigation without 2FA redirects to verification

---

- [ ] **Unit 3: Patient CRUD — API and UI**

**Goal:** Allow clinicians to create, view, and manage patient records from the dashboard.

**Requirements:** R6, R7, R8

**Dependencies:** Unit 1

**Files:**
- Create: `client/src/app/components/PatientForm.tsx`
- Create: `client/src/app/components/PatientProfilePage.tsx`
- Modify: `client/src/app/components/ClinicianDashboardList.tsx`
- Modify: `client/src/app/routes.tsx`

**Approach:**
- Replace the current inline session-creation form in `ClinicianDashboardList` with a two-step flow: first add a patient, then order assessments from the patient profile
- `PatientForm` is a modal/panel for creating a new patient with fields: full name, phone, date of birth (optional), ID number (optional), notes
- Dashboard list now queries `patients` table (with joined session data for status/scores) instead of showing raw sessions
- Add route `/dashboard/patient/:patientId` → `PatientProfilePage`
- `PatientProfilePage` shows patient info header, an "Order Assessment" button, and a list of the patient's sessions with status and scores
- Clicking a session navigates to the existing `/dashboard/:sessionId` detail view
- Patient CRUD uses direct Supabase client queries (RLS-protected), no Edge Function needed

**Patterns to follow:**
- `client/src/app/components/ClinicianDashboardList.tsx` for list layout, search, virtualizer
- `client/src/app/components/ClinicianDashboardDetail.tsx` for detail page structure

**Test scenarios:**
- Happy path: Clinician creates a patient with name and phone, patient appears in dashboard list
- Happy path: Clinician clicks patient row, navigates to patient profile with correct info
- Error path: Creating a patient without required fields (name, phone) shows validation error
- Edge case: Dashboard list shows patients with zero assessments (no sessions yet)
- Edge case: Patient with multiple completed assessments shows all in profile
- Integration: RLS prevents clinician from seeing another clinician's patients

**Verification:**
- New patient creation → appears in list → profile page loads with correct data
- Patient list reflects assessment count and latest status per patient

---

- [ ] **Unit 4: Assessment ordering — battery selection, session creation, SMS with code**

**Goal:** Allow clinician to order an assessment for a patient, generating a session with a one-time code and sending an SMS.

**Requirements:** R9, R10, R11

**Dependencies:** Unit 1, Unit 3

**Files:**
- Create: `client/src/app/components/OrderAssessmentModal.tsx`
- Modify: `client/src/app/components/PatientProfilePage.tsx`
- Modify: `supabase/functions/create-session/index.ts`

**Approach:**
- "Order Assessment" button on `PatientProfilePage` opens `OrderAssessmentModal`
- Modal shows battery selection (MoCA is the only option, pre-selected, with a visual card)
- Modal also collects session metadata: age band, education years (pre-filled from patient if available)
- On submit, calls the `create-session` Edge Function with `patientId`, `assessmentType`, `ageBand`, `educationYears`
- Modify `create-session` to:
  - Accept `patientId` parameter and set `patient_id` on the session
  - Generate a 6-digit `access_code` (crypto-random)
  - Look up patient phone from `patients` table (or accept it in the request)
  - Include the access code in the SMS message: "Remote Check: כדי להתחיל את המבחן, הכנסו לקישור {url} והקלידו את הקוד {code}"
  - Set `assessment_type` on the session row
- Show success confirmation with the session link and code (and copy button)

**Patterns to follow:**
- `supabase/functions/create-session/index.ts` for Edge Function structure
- `client/src/app/components/ClinicianDashboardList.tsx` `handleCreateSession` for client-side session creation call

**Test scenarios:**
- Happy path: Clinician selects MoCA, submits → session created, SMS sent with link + code, success message shown
- Happy path: Session row has correct `patient_id`, `assessment_type='moca'`, and a 6-digit `access_code`
- Error path: Edge Function returns error if patient phone is missing
- Error path: SMS failure is logged and displayed but session is still created
- Edge case: Code is exactly 6 digits, numeric only
- Integration: Created session appears in the patient's profile assessment list

**Verification:**
- Order assessment → session created in DB with all fields → SMS sent → confirmation displayed
- Session is queryable from the patient profile

---

- [ ] **Unit 5: Patient-side access code entry**

**Goal:** Modify the patient-facing flow to require entering the one-time access code before starting the assessment.

**Requirements:** R11, R12

**Dependencies:** Unit 1, Unit 4

**Files:**
- Create: `client/src/app/components/AccessCodeEntry.tsx`
- Modify: `client/src/app/components/SessionValidation.tsx`
- Modify: `client/src/app/routes.tsx`
- Modify: `supabase/functions/start-session/index.ts`

**Approach:**
- When patient opens the link (`/session/:token`), `SessionValidation` validates the link token as before
- Instead of auto-navigating to `/patient/welcome`, navigate to a new `AccessCodeEntry` screen
- `AccessCodeEntry` shows a Hebrew-language screen with a 6-digit code input (large, mobile-friendly)
- Patient enters the code → client calls a modified `start-session` Edge Function that validates both the link token AND the access code
- If code matches → session is marked started, patient proceeds to `/patient/welcome` and the assessment
- If code is wrong → show error in Hebrew, allow retry (with rate limiting consideration noted for implementation)
- Add route `/session/:token/code` for the code entry screen

**Patterns to follow:**
- `client/src/app/components/SessionValidation.tsx` for patient-facing screen styling
- `client/src/app/components/PatientWelcome.tsx` for patient-facing Hebrew UI

**Test scenarios:**
- Happy path: Patient opens link → enters correct code → assessment begins
- Error path: Patient enters wrong code → sees Hebrew error → can retry
- Error path: Patient uses an already-used link token → sees "already used" message
- Edge case: Code input accepts exactly 6 digits, no letters
- Edge case: Leading zeros in the code are preserved
- Integration: After code verification, the assessment flow proceeds identically to the current flow

**Verification:**
- Full flow: open link → enter code → welcome screen → first task loads
- Wrong code shows error, correct code on retry succeeds

---

- [ ] **Unit 6: Assessment completion notification and results binding**

**Goal:** Ensure the completion email is sent correctly and the clinician dashboard detail page displays real scoring data.

**Requirements:** R13, R14, R15

**Dependencies:** Unit 1, Unit 3, Unit 4

**Files:**
- Modify: `supabase/functions/complete-session/index.ts`
- Modify: `client/src/app/components/ClinicianDashboardDetail.tsx`
- Modify: `client/src/app/components/PatientProfilePage.tsx` (from Unit 3)

**Approach:**
- Verify `complete-session` Edge Function correctly: marks session complete, recalculates score, sends email to clinician with patient/case info
- Enhance the email to include more context: patient name (from `patients` table), assessment type, link to dashboard
- In `ClinicianDashboardDetail`, replace the hardcoded `SUMMARY` array with real data from `scoring_reports.subscores` and `scoring_reports.total_score`
- Show real task-level data: scores per subsection, actual duration from `started_at` to `completed_at`
- `PatientProfilePage` shows assessment status badges (pending, in progress, completed) with scores where available
- Ensure CSV and PDF export still work with the updated data model

**Patterns to follow:**
- `supabase/functions/complete-session/index.ts` for completion logic
- `client/src/app/components/ClinicianDashboardDetail.tsx` for detail page structure

**Test scenarios:**
- Happy path: Assessment completes → email sent to clinician → clinician sees updated status and real scores in dashboard detail
- Happy path: CSV and PDF export include real scores from the completed session
- Error path: If clinician email lookup fails, completion still succeeds (email is best-effort)
- Edge case: Session with no scoring report yet shows placeholder/loading state
- Edge case: Session with `needs_review=true` shows the correct badge
- Integration: End-to-end from assessment completion through email notification to dashboard data display

**Verification:**
- Complete an assessment → verify email sent → verify dashboard shows real scores
- Export CSV/PDF → verify data matches database records

---

- [ ] **Unit 7: Route updates and navigation polish**

**Goal:** Wire up all new routes, ensure navigation between patient list → patient profile → session detail → back works smoothly.

**Requirements:** R6, R8, R14

**Dependencies:** Unit 2, Unit 3, Unit 4, Unit 5, Unit 6

**Files:**
- Modify: `client/src/app/routes.tsx`
- Modify: `client/src/app/components/ClinicianDashboardLayout.tsx`
- Modify: `client/src/app/components/ClinicianDashboardList.tsx`
- Modify: `client/src/app/components/ClinicianDashboardDetail.tsx`

**Approach:**
- Add route `/dashboard/patient/:patientId` under the protected dashboard layout
- Update breadcrumbs in `ClinicianDashboardDetail` to show patient name and link back to patient profile
- Update `ClinicianDashboardList` row clicks to navigate to patient profile (not directly to session detail)
- Ensure all dashboard routes are under `ClinicianProtectedRoute` with AAL2 enforcement
- Ensure the TOTP flow routes are accessible without AAL2

**Patterns to follow:**
- `client/src/app/routes.tsx` for route structure

**Test scenarios:**
- Happy path: Navigate patient list → patient profile → session detail → back to profile → back to list
- Happy path: Direct URL access to `/dashboard/patient/uuid` loads correctly when authenticated with 2FA
- Error path: Unauthenticated access to any `/dashboard/*` route redirects to auth page
- Edge case: Browser back/forward buttons work correctly through the navigation stack

**Verification:**
- Full navigation flow works without broken links or missing components
- All protected routes enforce 2FA

## System-Wide Impact

- **Interaction graph:** Auth state change (AAL upgrade from `aal1` to `aal2`) affects `ClinicianProtectedRoute`, which guards all dashboard routes. The `create-session` Edge Function now depends on the `patients` table. The `start-session` Edge Function now validates `access_code`.
- **Error propagation:** SMS failures in `create-session` are non-fatal (session still created, error reported to UI). Email failures in `complete-session` are non-fatal (logged, completion proceeds). TOTP verification failures keep the user on the verification screen.
- **State lifecycle risks:** The `access_code` is set once at session creation and never changes. The `patient_id` foreign key on sessions may be null for backward compatibility with sessions created before the `patients` table existed.
- **API surface parity:** The `create-session` Edge Function gains new parameters (`patientId`, `assessmentType`). The `start-session` Edge Function gains `accessCode` validation. Both remain backward-compatible (new params are additive).
- **Integration coverage:** End-to-end flow from clinician sign-up → 2FA → patient creation → assessment ordering → SMS → patient code entry → assessment → completion email → results review requires integration testing across all units.
- **Unchanged invariants:** Existing sessions without `patient_id` or `access_code` continue to work. The assessment task flow (trail-making through orientation) is unchanged. Scoring logic is unchanged. Export functions are unchanged except for reading from real data.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase MFA/TOTP feature must be enabled in project settings | Document as a prerequisite; verify in implementation |
| Existing sessions lack `patient_id` — migration must be backward-compatible | `patient_id` column is nullable; existing data unaffected |
| Twilio SMS delivery to Israeli numbers may have formatting requirements | Test with `+972` prefix; existing SMS code already handles this |
| Rate limiting on TOTP verification to prevent brute force | Supabase MFA has built-in rate limiting; document for awareness |
| QR code rendering dependency needs to be added to client | Use `qrcode.react` or the base64 data URI from Supabase's `totp.qr_code` response |

## Phased Delivery

### Phase 1: Database + Auth (Units 1–2)
Schema migration and 2FA — can be landed first. Sets the foundation.

### Phase 2: Patient Management (Units 3–4)
Patient CRUD and assessment ordering — depends on Phase 1 schema.

### Phase 3: Patient Flow + Results (Units 5–6–7)
Patient-side code entry, completion notification, results binding, and navigation — depends on Phase 2.

## Documentation / Operational Notes

- Supabase project must have MFA enabled (Project Settings → Auth → Multi-Factor Authentication)
- Twilio and Resend API keys must be configured in Edge Function environment
- The `access_code` generation in `create-session` should use `crypto.getRandomValues` for security
- Hebrew SMS message copy should be reviewed by a native speaker before production
- Consider adding a "Resend SMS" button on the patient profile for cases where the original SMS wasn't received

## Sources & References

- Related code: `client/src/app/components/auth/useClinicianAuth.ts`
- Related code: `supabase/functions/create-session/index.ts`
- Related code: `supabase/functions/complete-session/index.ts`
- Existing schema: `supabase/migrations/20260421000001_initial_schema.sql`
- Existing schema: `supabase/migrations/20260423000008_clinicians_and_session_contact.sql`
- Supabase MFA docs: https://supabase.com/docs/guides/auth/auth-mfa
