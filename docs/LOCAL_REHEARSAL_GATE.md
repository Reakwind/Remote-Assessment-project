# Local Rehearsal Gate

## Purpose

The local rehearsal gate proves the clinician website and patient PWA work locally on a Mac plus iPad before hosted deployment readiness is discussed. It is the physical-device gate for HTTPS, installed-PWA behavior, local Supabase, Edge Functions, clinician review, finalization, and exports.

Use `docs/LOCAL_REHEARSAL_EVIDENCE.example.json` as the evidence shape template, not as proof of readiness. The runner writes generated evidence under `local-rehearsal-evidence/`; keep those generated files out of Git.

## Modes

- Debug mode preserves local data and is used to reproduce failures.
- Readiness mode resets local Supabase and is the only mode that can certify deployment readiness.

Use `--skip-automated-checks` only while debugging a local failure. A run with skipped automated checks cannot certify readiness.

Generated readiness evidence must include the automated check results. Empty `automatedChecks` evidence is non-certifying.

Use `--skip-licensed-pdf-check` only for non-clinical contract checks. Do not use it for clinical readiness, because clinical readiness must verify the licensed PDFs and private Storage manifests.

## Certificate Setup

Install `mkcert`, then create a certificate that covers loopback, localhost, and the Mac LAN IP reachable from the iPad:

```bash
mkdir -p .certs
mkcert -install
mkcert -cert-file .certs/remote-assessment-local.pem -key-file .certs/remote-assessment-local-key.pem 127.0.0.1 localhost <mac-lan-ip>
```

The `.certs/` directory is local-only and ignored by Git. Do not commit local certificate material.

The mkcert root certificate must be installed and trusted on the iPad before installed-PWA testing. Without the trusted root, Safari may open the page with warnings and installed-PWA behavior is not valid readiness evidence.

## Debug Rehearsal

Run debug mode when reproducing or isolating a failure. It preserves local Supabase data:

```bash
node scripts/local-rehearsal.mjs --mode debug --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem
```

Keep the terminal open while testing. Use the printed patient URL on the iPad and the printed clinician Mac URL on the Mac. Current default ports are patient `https://<mac-lan-ip>:5176` and clinician `https://127.0.0.1:5177`.

## Readiness Rehearsal

Readiness mode resets local Supabase. Run it only when local test data can be discarded:

```bash
node scripts/local-rehearsal.mjs --mode readiness --confirm-reset --https-cert .certs/remote-assessment-local.pem --https-key .certs/remote-assessment-local-key.pem
```

This is the only local rehearsal mode that can certify deployment readiness.

## Manual iPad Evidence

After the runner starts, use the printed patient URL on the iPad. Complete the installed-PWA flow and update the generated JSON evidence file under `local-rehearsal-evidence/`.

Record each manual check result and notes:

1. Installed iPad PWA opens from the home screen and uses the HTTPS patient URL.
2. Microphone permission prompt appears and the permission path works.
3. Hebrew audio playback works on the iPad.
4. Drawing save works and advances without save errors.
5. Refresh and same-device resume work during an in-progress assessment.
6. Offline/retry behavior preserves queued patient evidence and recovers when back online.
7. Patient completion reaches the dead-end completion screen.
8. Clinician finalization works from the Mac clinician URL.
9. CSV/PDF export behavior matches the current finalization rules.

If any manual check fails, leave its result as failed in the generated evidence, add concise notes, keep the run in debug mode for reproduction, and do not claim deployment readiness.
