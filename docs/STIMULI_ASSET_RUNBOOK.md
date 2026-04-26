# Licensed Stimuli Asset Runbook

This runbook explains how to prepare and verify licensed MoCA stimulus assets without committing licensed content to Git.

## Policy

- Keep licensed MoCA PDFs and images outside the repository.
- Store runtime stimulus assets in the private Supabase Storage bucket named `stimuli`.
- Use one versioned path per task asset.
- Validate all required assets before any clinical pilot.
- Treat missing assets as a development-only state. The patient UI shows explicit placeholders when assets are missing.

## Required Paths

The canonical manifest lives in `supabase/functions/_shared/stimulus-manifest-data.json`.

For each supported version (`8.1`, `8.2`, `8.3`), upload these private Storage objects:

| Task | Asset | Content type | Storage path pattern |
|---|---|---|---|
| Trail Making | Visual template | `image/png` | `{version}/moca-visuospatial/trail-template.png` |
| Cube copy | Cube stimulus | `image/png` | `{version}/moca-cube/cube-stimulus.png` |
| Naming | Item 1 image | `image/png` | `{version}/moca-naming/item-1.png` |
| Naming | Item 2 image | `image/png` | `{version}/moca-naming/item-2.png` |
| Naming | Item 3 image | `image/png` | `{version}/moca-naming/item-3.png` |

Memory learning uses generated Hebrew speech in the browser rather than a licensed MP3 asset.

## Local Verification

Start local Supabase, then set the local secret key from `supabase status`:

```bash
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SECRET_KEY="<local Secret value from supabase status>"
node scripts/verify-stimuli.mjs --all-versions
```

To extract the visual stimuli from the licensed local PDFs and upload them to the private local bucket:

```bash
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SECRET_KEY="<local Secret value from supabase status>"
node scripts/upload-stimuli-from-pdfs.mjs --all-versions --upload
node scripts/verify-stimuli.mjs --all-versions
```

The extraction script writes temporary PNGs under `/tmp/moca-stimuli` and does not commit licensed content to Git.

To print the expected manifest without contacting Supabase:

```bash
node scripts/verify-stimuli.mjs --all-versions --print-manifest
```

## Hosted Verification

Use the hosted project URL and service-role key. Keep the key out of shell history when possible.

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"
node scripts/verify-stimuli.mjs --all-versions
```

The script exits non-zero when any required asset is missing.

## Upload Checklist

1. Prepare licensed assets outside this repository.
2. Convert visual stimuli to PNG with `scripts/upload-stimuli-from-pdfs.mjs` or an equivalent licensed-asset process.
3. Upload each object to the private `stimuli` bucket using the exact versioned path.
4. Run `node scripts/verify-stimuli.mjs --all-versions`.
5. Run local E2E with `node scripts/local-e2e.mjs --all-versions`.
6. Record verification in the PR or release note before clinical testing.
