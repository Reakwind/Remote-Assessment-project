# Remote Assessment Project

Remote, web-based cognitive assessment platform (Hebrew MoCA focused) with:

- A main React + TypeScript frontend (`client/`)
- A secondary frontend/reference implementation (`Skeleton Front End-2/`)
- Supabase backend assets (`supabase/` migrations and Edge Functions)

## Repository Structure

```text
.
├── client/                    # Main app (used by CI)
├── Skeleton Front End-2/      # Secondary/reference frontend
├── supabase/                  # DB migrations, config, edge functions
├── docs/                      # Setup and planning docs
├── SPEC.md                    # Product/design specification
├── CONTEXT.md                 # Project context and goals
└── MEMORY.md                  # Session/project memory notes
```

## Prerequisites

- Node.js 20+ and npm
- GitHub account + git installed
- (Optional, backend work) Supabase CLI and a Supabase project

## Quick Start (Local Development)

Run these from the repo root:

```bash
npm install --prefix "client" --legacy-peer-deps
npm install --prefix "Skeleton Front End-2"
```

Start apps on fixed ports:

```bash
# Main app
npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173

# Secondary app (optional)
npm run dev --prefix "Skeleton Front End-2" -- --host 0.0.0.0 --port 4174
```

## Testing and Quality Checks

Main CI checks run against `client/`.

```bash
# Lint
npm run lint --prefix "client"

# Unit tests
npm run test --prefix "client"

# E2E tests (if needed locally)
npm --prefix "client" exec playwright install --with-deps
npm --prefix "client" exec playwright test
```

## Backend (Supabase) Setup

For full backend setup, follow:

- `docs/SUPABASE_SETUP.md`
- `Skeleton Front End-2/BACKEND_README.md` (implementation-oriented guide)

Common first step for frontend integration:

```bash
cp client/.env.example client/.env.local
```

Then fill `client/.env.local` with your Supabase URL and anon key.

## Basic GitHub Workflow (Beginner Friendly)

Use this flow for every change:

```bash
# 1) Make sure main is up to date
git checkout main
git pull origin main

# 2) Create a feature branch
git checkout -b feature/short-description

# 3) Make changes, then commit
git add .
git commit -m "Describe your change clearly"

# 4) Push branch to GitHub
git push -u origin feature/short-description
```

Then open a Pull Request (PR) from your branch into `main` in GitHub.

## Working with Cursor Coding Agents + GitHub

You can treat Cursor agents as a "pair programmer" that works on your branch and opens/updates PRs.

### Suggested Flow

1. **Start from clean `main`**
   - Pull latest changes before giving the agent a task.
2. **Use one branch per task**
   - Example: `feature/fix-naming-task-validation`
3. **Give a concrete prompt**
   - Include goal, scope, and acceptance criteria.
   - Example: "Update naming task validation, add tests, and keep existing UI behavior."
4. **Ask the agent to run checks**
   - Lint and tests before commit.
5. **Review the diff yourself**
   - Check changed files and test coverage.
6. **Push + PR**
   - Agent (or you) pushes branch and opens a PR.
7. **Use GitHub CI as a safety net**
   - Merge only after checks pass and you are comfortable with the code.

### Cursor + GitHub Integration Checklist

Use this when working from GitHub issues:

1. Pick an issue in GitHub and write a short implementation plan in your prompt.
2. Ask Cursor agent to create a branch, implement, test, commit, and open/update PR.
3. In GitHub PR, review:
   - Files changed
   - CI checks
   - Test coverage for behavior changes
4. Add review comments (or request follow-up changes in Cursor).
5. Re-run CI after updates, then merge.

### Prompt Template for Cursor Agents

Copy/paste and customize:

```text
Task: [what you want changed]
Scope: Edit only [paths/files].
Requirements:
- Keep existing behavior unless stated.
- Add or update tests for changed behavior.
- Run lint and tests.
Deliverables:
- Commit changes with a clear message.
- Push branch and open/update PR into main.
```

### Best Practices

- Keep tasks small (one PR per logical change).
- Ask for tests whenever behavior changes.
- Never merge without reading the PR diff.
- Use agent-generated code as a draft you approve.

## Useful Docs

- `SPEC.md`
- `CONTEXT.md`
- `MEMORY.md`
- `docs/SUPABASE_SETUP.md`

---

If you are new to this repository, start by running the main app in `client/` and completing one small PR (for example, improving copy, docs, or a minor UI fix) to learn the flow end-to-end.
