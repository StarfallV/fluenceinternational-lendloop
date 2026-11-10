---
name: close-block
description: Closes a delivery block after a passing review — handles review notes, finalizes docs, merges the PR with a merge commit, and tags milestone releases. The bookend to /run-block.
argument-hint: "[block-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

Close delivery block `$ARGUMENTS`. Run this after `/review-block` returns PASS or PASS WITH
NOTES.

## Pre-flight

1. The latest review verdict for this branch is PASS or PASS WITH NOTES. If commits other than
   docs-only closing changes were added after that review, run `/review-block` again first.
2. CI is green: `gh pr checks <n>`.

## Step 1 — Review notes

For every note in the review, either fix it (commit with `(block $ARGUMENTS)`) or record it as a
tech-debt item with a reason. List each note's outcome in the completion log under "Review items
addressed".

## Step 2 — Checklist

Report PASS or FAIL for each item:

- [ ] **Completion log** says `Status: Complete`, and every acceptance criterion has a result and
      evidence.
- [ ] **Spec:** every acceptance criterion is checked, or annotated if it was descoped. The spec
      reflects every deviation.
- [ ] **Tech debt:** the log's "Tech debt recorded" matches `docs/tech-debt.md`.
- [ ] **Docs:** `docs/architecture.md` and `docs/prd.md` reflect any decision that moved the
      design or scope.
- [ ] **ADRs:** decisions in the log that qualify have ADRs, listed in the index.
- [ ] **Bugs:** no open Critical or High bug in `docs/bugs/` references this block.

If anything fails, stop and list exactly what needs fixing.

## Step 3 — Closing commit (on the block branch)

1. Set the spec to `Status: Closed`, and update the table in `docs/blocks/README.md`.
2. Link the completion log in the Evidence column of `docs/prd.md` §9, for each requirement this
   block delivered.
3. Add `CHANGELOG.md` entries under `Unreleased`. If this is a **milestone block**, follow the
   release steps in the commit-conventions rule: move the entries into a version section and bump
   `package.json`.
4. Commit `docs: close block $ARGUMENTS` (and `docs: release vX.Y.Z` at a milestone), push, and
   wait for CI to go green.

## Step 4 — Merge

1. `gh pr merge <n> --merge --delete-branch`. It must be a merge commit: no squash, no rebase.
2. `git switch main && git pull --ff-only`.

## Step 5 — Release (milestone blocks only)

1. `git tag -a vX.Y.Z -m "vX.Y.Z"` on the merge commit, then `git push origin vX.Y.Z`.
2. `gh release create vX.Y.Z --title "vX.Y.Z" --notes "<CHANGELOG section>"`.

## Report

```
=== Close Report: $ARGUMENTS ===
Block: <title>
Verdict: CLOSED | BLOCKED
Review notes: <n fixed, n moved to tech debt>
Checklist: log ✓ · spec ✓ · tech debt ✓ · docs ✓ · ADRs ✓ · bugs ✓
Merged: PR #<n> → main (<merge sha>)
Release: <vX.Y.Z, or none>
Next block: <id and title, by dependency order>
```
