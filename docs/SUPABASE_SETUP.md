# Supabase Setup Instructions

## Prerequisites
- Supabase account at supabase.com
- Supabase CLI installed (see official Supabase CLI install docs for your OS)
- Node.js/npm installed for local frontend validation

## 1. Create Supabase project
1. Create a new project in Supabase.
2. Note:
   - **Project URL**
   - **anon key**
   - **service role key** (keep secret; server-only)

## 2. Initialize and link CLI
Run from repository root (`/workspace`):

```bash
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 3. Run migrations
```bash
supabase db push
```

Current repository migrations:
- `20260421000001_initial_schema.sql`
- `20260421000004_stimuli_storage.sql`
- `20260421000005_audit_logs.sql`
- `20260421000007_audio_storage.sql`

## 4. Set environment variables

Client app:

```bash
cp client/.env.example client/.env.local
```

Then set values in `client/.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 5. Deploy Edge Functions
Deploy the functions used by current `main`:

```bash
supabase functions deploy create-session
supabase functions deploy start-session
supabase functions deploy submit-task
supabase functions deploy save-drawing
supabase functions deploy save-audio
supabase functions deploy complete-session
supabase functions deploy export-csv
supabase functions deploy export-pdf
```

## 6. Verify local flow
1. Start the client app:
   ```bash
   npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173
   ```
2. Create a session via your clinician flow (or insert test data in DB).
3. Open patient link with hash route:
   - `http://localhost:4173/#/session/YOUR_LINK_TOKEN`

## Notes
- Preferred token URL format: `/#/session/{token}`.
- The client still supports `?t={token}` in some flows for backward compatibility.
- Storage buckets currently expected by runtime:
  - `drawings` (used by `save-drawing`)
  - `audio` (used by `save-audio`)
