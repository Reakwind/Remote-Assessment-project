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
