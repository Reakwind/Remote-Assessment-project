---
title: "superseded: Clinician Onboarding, Patient Management & Assessment Delivery Flow"
type: feat
status: superseded
date: 2026-04-23
superseded_date: 2026-04-25
---

# Superseded Clinician Flow Plan

This older plan is retained only as project history. Use [../../JOURNEY.md](../../JOURNEY.md) for the current patient and clinician journey.

Current MVP direction:

- Clinician auth uses email/password through Supabase Auth.
- Clinician-only backend access is enforced through authenticated JWT checks.
- Patient sessions are created by clinicians and started by generated link/code.
- Clinicians receive completion notifications, review stored evidence, enter manual scores, finalize, and export.
- Stronger clinician auth, including MFA, SSO, device policy, and richer session controls, belongs in a future security-hardening plan.

The original version of this plan included MFA/2FA as an active requirement. That requirement was removed from MVP scope on 2026-04-25 after local QR enrollment proved too fragile for the current pilot workflow.
