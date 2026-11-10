---
name: resume-block
description: Resumes a partially complete delivery block from a prior session. Assesses committed work and review records against the spec, reports progress, then continues the /run-block sequence.
argument-hint: "[block-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(git fetch *)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git show *)
  - Bash(git ls-tree *)
  - Bash(git branch *)
  - Bash(git merge-base *)
  - Bash(git rev-parse *)
  - Bash(git switch *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push -u origin HEAD)
  - Bash(npm run *)
  - Bash(npm test *)
---

Resume delivery block `$ARGUMENTS`. Don't start implementing straight away; assess the current
state first.

## Step 1 — Gather context

1. Run `git fetch origin`, then find the branch with `git branch -a --list "*feature/$ARGUMENTS-*"`.
   - If you are on it, continue.
   - If it exists but you are elsewhere, switch to it (`git switch <branch>`) and say so.
   - If it doesn't exist, stop and suggest `/run-block $ARGUMENTS`.
2. Read the spec `docs/blocks/$ARGUMENTS-*.md`, `CLAUDE.md`, and every file in `.claude/rules/`.
3. Read the architecture sections and ADRs the spec links.
4. If they exist, read:
   - the partial completion log, `docs/logs/$ARGUMENTS-completion.md`;
   - the review records, `docs/reviews/$ARGUMENTS-review-*.md`.
5. Check `docs/tech-debt.md` for items that reference this block.
6. Work out the base branch the same way `/run-block` does. Closed branches never change, so there
   is nothing to merge in. If the base did gain non-bookkeeping commits, stop and tell the
   developer: that breaks the fix-forward rule.

## Step 2 — Assess

1. `git log --oneline <base>..HEAD` and `git diff --stat <base>...HEAD`.
2. Map what was built against each acceptance criterion.
3. Run `npm run typecheck`, `npm run lint` and `npm test`, and note what passes, what fails, and
   what is missing.
4. If there is a review record, list its findings and which of them are still open.

## Step 3 — Status report

```
=== Resume Report: $ARGUMENTS ===
Spec: <title> · Base: <base> · Status: <spec status>

Completed:
- <criteria or outputs that are done, with evidence>

Remaining:
- <criteria or outputs not yet satisfied; open review findings>

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
debt, docs, completion log, review and its record, then `/close-block`. If a partial completion
log exists, **replace** it with the final version. A completion log describes the end state, not
the history.
