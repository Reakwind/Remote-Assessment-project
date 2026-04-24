# AGENTS.md Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `AGENTS.md` into a clearer, more operational repo guide for coding agents while preserving the existing useful commands and safety guardrails.

**Architecture:** This is a docs-only change centered on one primary file. Keep the current setup and dev command content, reorganize the document into clearer operational sections, and add concise repo-specific guidance for verification, editing, git workflow, PR expectations, manual testing, and remote-write safety. Verify the result by reading the changed files directly and checking the git diff for scope.

**Tech Stack:** Markdown documentation, git

---

### Task 1: Rewrite `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Read the existing guide and approved spec**

Read:
- `AGENTS.md`
- `docs/superpowers/specs/2026-04-24-agents-md-upgrade-design.md`

Expected: Clear understanding of which content must be preserved and which new sections need to be added.

- [ ] **Step 2: Rewrite `AGENTS.md` with the approved structure**

Update `AGENTS.md` so it contains these sections in concise form:

```md
## Purpose
## Repository map
## Cursor Cloud specific instructions
### Environment setup
### Preferred development commands
### Verification matrix by change type
### Coding and editing guardrails
### Git workflow for cloud agents
### PR workflow and description expectations
### Manual testing and walkthrough artifacts
### External service write guardrail (required)
### Quick checklist
```

Preserve these commands exactly:

```md
- `npm install --prefix "client" --legacy-peer-deps`
- `npm install --prefix "Skeleton Front End-2"`
- `npm run dev --prefix "client" -- --host 0.0.0.0 --port 4173`
- `npm run dev --prefix "Skeleton Front End-2" -- --host 0.0.0.0 --port 4174`
```

Expected: `AGENTS.md` becomes more actionable without becoming a generic handbook.

- [ ] **Step 3: Review the rewritten file for brevity and consistency**

Run:

```bash
git diff -- AGENTS.md
```

Expected: The diff shows a focused rewrite that preserves setup, command, and remote-write guardrail details while adding repo-specific workflow guidance.

- [ ] **Step 4: Commit the docs rewrite**

```bash
git add AGENTS.md
git commit -m "docs: upgrade agents guide"
```

---

### Task 2: Verify supporting docs and change scope

**Files:**
- Create: `docs/superpowers/specs/2026-04-24-agents-md-upgrade-design.md`
- Create: `docs/superpowers/plans/2026-04-24-agents-md-upgrade.md`

- [ ] **Step 1: Re-read the spec and plan files**

Read:
- `docs/superpowers/specs/2026-04-24-agents-md-upgrade-design.md`
- `docs/superpowers/plans/2026-04-24-agents-md-upgrade.md`

Expected: Both files accurately describe the approved design and implementation flow.

- [ ] **Step 2: Check final change scope**

Run:

```bash
git status --short
git diff -- AGENTS.md docs/superpowers/specs/2026-04-24-agents-md-upgrade-design.md docs/superpowers/plans/2026-04-24-agents-md-upgrade.md
```

Expected: Only the intended docs files are changed.

- [ ] **Step 3: Commit the planning docs if they are not yet included**

```bash
git add docs/superpowers/specs/2026-04-24-agents-md-upgrade-design.md docs/superpowers/plans/2026-04-24-agents-md-upgrade.md
git commit -m "docs: add agents guide design artifacts"
```

Expected: The branch contains scoped documentation commits ready for optional push and PR steps once remote-write approval is granted.
