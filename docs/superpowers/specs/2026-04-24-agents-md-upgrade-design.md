# Design Spec: AGENTS.md Upgrade

**Date:** 2026-04-24
**Status:** Approved for rewrite

## 1. Vision & Purpose
Upgrade `AGENTS.md` from a minimal setup note into a practical operating guide for coding agents working in this repository. The rewritten file should improve consistency for setup, editing, testing, git workflow, PR hygiene, and cloud-safe execution without becoming so verbose that agents ignore it.

## 2. Goals
- Preserve the existing repository-specific commands that are already useful.
- Add stronger instructions for agent execution in Cursor Cloud and similar environments.
- Make verification expectations clearer by change type.
- Make git and PR behavior explicit enough that agents can follow it without guessing.
- Keep the document readable, skimmable, and focused on repo-specific guidance.

## 3. Non-Goals
- Do not turn `AGENTS.md` into a generic software engineering handbook.
- Do not duplicate large parts of system prompts or tool documentation.
- Do not add instructions for workflows that do not exist in this repository.
- Do not introduce requirements that depend on unavailable infrastructure or secrets.

## 4. Proposed Structure
1. `Purpose`
2. `Repository map`
3. `Environment setup`
4. `Preferred development commands`
5. `Verification matrix by change type`
6. `Coding and editing guardrails`
7. `Git workflow for cloud agents`
8. `PR workflow and description expectations`
9. `Manual testing and walkthrough artifacts`
10. `External service write guardrail`
11. `Quick checklist`

## 5. Content Design

### Environment setup
- Keep the dependency install commands for both frontend apps.
- Keep the fixed dev ports so concurrent sessions remain predictable.
- Clarify that `client/` is the primary app and should be the default target unless the task clearly belongs elsewhere.

### Preferred development commands
- Preserve the existing `npm run dev` commands for both apps.
- Keep path quoting guidance for `"Skeleton Front End-2"`.
- Avoid adding speculative commands that have not already been validated in the repo.

### Verification matrix by change type
- Replace the current short list with clearer routing:
  - `client/` code changes: run `lint`, `test`, and `build` when runtime behavior changes.
  - `"Skeleton Front End-2"` changes: run `build`.
  - docs-only changes: no frontend test run required.
- Frame this as minimum high-signal verification rather than exhaustive testing.

### Coding and editing guardrails
- Preserve focused diffs and no unrelated refactors.
- Preserve the lockfile rule.
- Add a reminder to follow existing file and naming patterns before introducing new ones.
- Add a rule to avoid changing unrelated generated files.

### Git workflow for cloud agents
- Add branch guidance using the `cursor/` prefix when a new branch is needed.
- Instruct agents to keep commits scoped and descriptively named.
- Clarify that agents should not switch branches casually or rewrite history unless explicitly asked.
- Encourage checking `git status` before and after edits to avoid mixing unrelated work.

### PR workflow and description expectations
- Explain that PR descriptions should summarize user-visible changes, validation, and notable risks.
- Note that screenshots or recordings should be attached when UI behavior changes.
- Keep this focused on what should be included, not on a specific hosting provider feature set.

### Manual testing and walkthrough artifacts
- Add guidance that UI changes should be verified in the browser when practical.
- Note that walkthrough artifacts should demonstrate the final working behavior, not setup steps or failed attempts.
- Keep the artifact guidance brief and actionable.

### External service write guardrail
- Preserve the current approval gate.
- Make the sequence explicit: show command, explain side effect, wait for approval.
- Keep the examples for Supabase, transactional APIs, Git hosting writes, and other remote mutations.

### Quick checklist
- Provide a short operational checklist agents can skim before finishing work:
  - confirm target area
  - make minimal diff
  - run the right verification
  - capture artifacts if UI changed
  - avoid remote writes without approval

## 6. Risks & Mitigations
- **Risk:** The document becomes too long and agents ignore it.
  - **Mitigation:** Use concise sections, bullets, and a short checklist.
- **Risk:** Guidance duplicates higher-level agent instructions and drifts over time.
  - **Mitigation:** Keep content repo-specific and operational.
- **Risk:** PR rules imply remote writes can happen automatically.
  - **Mitigation:** Keep the external write guardrail explicit and unambiguous.

## 7. Testing Strategy
- Treat this as a docs-only change.
- Verify the file contents directly after writing.
- No frontend test run is required unless the implementation unexpectedly expands beyond documentation.

## 8. Success Criteria
- `AGENTS.md` is easier to follow for end-to-end repo work.
- The new version preserves the existing useful commands.
- The new version adds clear workflow guidance for editing, testing, git, PRs, and external-write safety.
- The resulting document remains concise enough to scan quickly.
