# Client App (`client/`)

Main frontend application for Remote Assessment.

## Tech Stack

- React + TypeScript
- Vite
- React Router
- Vitest + Playwright

## Development

From repository root:

```bash
npm install --prefix "client" --legacy-peer-deps
npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173
```

## Scripts

Run from repo root with `--prefix "client"`:

```bash
# Lint
npm run lint --prefix "client"

# Unit tests
npm run test --prefix "client"

# Build
npm run build --prefix "client"
```

## Session Route

The patient entry route uses a token path parameter:

```text
/#/session/:token
```

Example:

```text
http://localhost:4173/#/session/YOUR_LINK_TOKEN
```

## More Documentation

- Root onboarding and workflow: `../README.md`
- Supabase setup: `../docs/SUPABASE_SETUP.md`
