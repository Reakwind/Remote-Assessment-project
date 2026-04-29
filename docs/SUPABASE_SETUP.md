# Supabase Local Setup

This file is for local developer setup only.

For hosted Supabase drift checks, migration pushes, Edge Function deploys,
storage changes, or remote E2E, read
[SUPABASE_RECONCILIATION.md](SUPABASE_RECONCILIATION.md) before changing remote
state.

## Prerequisites

- Supabase CLI installed and authenticated.
- Node.js/npm available for the React client.
- Docker Desktop or another Docker daemon available to the Supabase CLI.

## Local Stack

From the active repository root:

```bash
supabase start
```

If Docker socket mounts fail with Colima or local analytics services, use:

```bash
supabase start -x vector,logflare
```

Create the client env file from the local Supabase values:

```bash
cp client/.env.example client/.env.local
supabase status
```

Set these in `client/.env.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

Serve the current Edge Function set through the checked-in helper:

```bash
supabase functions serve $(node scripts/edge-functions.mjs serve-args) --env-file /dev/null
```

Run the client:

```bash
cd client
npm run dev
```

## Verification

Use [LOCAL_E2E_VERIFICATION.md](LOCAL_E2E_VERIFICATION.md) for the full local
browser/Supabase checklist.

The current MVP patient start flow uses the clinician-generated 8-digit test
number. Internal `linkToken` values are returned only after `start-session` and
must not be shared as patient-facing links.

## Hosted Deploys

Do not deploy functions from this setup note. Print the current deploy commands
only after reading [SUPABASE_RECONCILIATION.md](SUPABASE_RECONCILIATION.md),
inspecting hosted drift, and getting explicit user approval:

```bash
node scripts/edge-functions.mjs deploy-commands
```
