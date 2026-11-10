---
name: resume-block
description: Resumes a partially complete delivery block from a prior session. Assesses committed work against the spec, reports progress, then continues the /run-block sequence.
argument-hint: "[block-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

Resume delivery block `$ARGUMENTS`. Don't start implementing straight away; assess the current
state first.

## Step 1 — Gather context

1. Read the spec `docs/blocks/$ARGUMENTS-*.md`, `CLAUDE.md`, and every file in `.claude/rules/`.
2. Read the architecture sections and ADRs the spec links.
3. If a partial completion log exists at `docs/logs/$ARGUMENTS-completion.md`, read it.
4. Check `docs/tech-debt.md` for items that reference this block.
5. **Branch:** find it with `git branch --list "feature/$ARGUMENTS-*"`.
   - If you are on it, continue.
   - If it exists but you are elsewhere, switch to it (`git switch <branch>`) and say so.
   - If it doesn't exist, stop and suggest `/run-block $ARGUMENTS`.

## Step 2 — Assess

1. `git log --oneline origin/main..HEAD` and `git diff --stat origin/main...HEAD`.
2. Map what was built against each acceptance criterion.
3. Run `npm run typecheck`, `npm run lint` and `npm test`, and note what passes, what fails, and
   what is missing.

## Step 3 — Status report

```
=== Resume Report: $ARGUMENTS ===
Spec: <title>

Completed:
- <criteria or outputs that are done, with evidence>

Remaining:
- <criteria or outputs that are not yet satisfied>

Checks: typecheck <ok/fail> · lint <ok/fail> · tests <n passed / n failed>
Missing tests:
- <criteria that have no test yet>

Issues found:
- <broken tests, divergence from the spec, half-finished work>

Plan:
- <the next steps, in order>
```

## Step 4 — Continue

Continue the `/run-block` sequence from the first incomplete step: implement, verify, commit, tech
debt, docs, completion log, PR. If a partial completion log exists, **replace** it with the final
version. A completion log describes the end state, not the history.
