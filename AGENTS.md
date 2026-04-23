# AGENTS.md

## Cursor Cloud specific instructions

### Dependency setup (run from `/workspace`)

Use these commands to install dependencies for both frontend apps:

- `npm install --prefix "client" --legacy-peer-deps`
- `npm install --prefix "Skeleton Front End-2"`

### Preferred development commands

Start each app on a fixed port so parallel agent sessions stay consistent:

- `client` on port `4173`:
  - `npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173`
- `Skeleton Front End-2` on port `4174`:
  - `npm run dev --prefix "Skeleton Front End-2" -- --host 0.0.0.0 --port 4174`

### External service write guardrail (required)

Before running any command that writes to external services, agents must:

1. Show the exact command(s) they plan to run.
2. Explain the expected side effect in one sentence.
3. Wait for explicit user approval before executing.

This guardrail applies to actions that can change remote state, including:

- Supabase (secrets, migrations, function deploys, data writes)
- Twilio / Resend API calls
- GitHub/GitLab write operations (PR edits, labels, releases, etc.)
- Any other third-party API or cloud resource mutation
