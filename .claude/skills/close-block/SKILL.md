---
name: close-block
description: Closes a delivery block after a passing review — handles review notes, finalizes docs, applies the merge gate, and (only when the developer opens PRs) merges the stack with merge commits and tags milestone releases. The bookend to /run-block.
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
  - Bash(git merge-base *)
  - Bash(git rev-parse *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push -u origin HEAD)
  - Bash(npm version * --no-git-tag-version)
  - Bash(npm run *)
  - Bash(npm test *)
---

Close delivery block `$ARGUMENTS`. Run this after its latest review record says PASS or PASS WITH
NOTES.

## Pre-flight

1. **Latest review.** Read the highest-round `docs/reviews/$ARGUMENTS-review-*.md`. Its verdict
   must be PASS or PASS WITH NOTES. If it isn't, stop.
2. **Bookkeeping only since the review.** Run `git diff --stat <reviewed-sha>..HEAD`, then read
   the diff of every file it lists. Each change must be on the bookkeeping list in
   `.claude/rules/delivery-blocks.md` ("Merge gate"). For example, a spec may change only its
   status line and checkboxes, and `docs/prd.md` only its §9 Evidence column. If anything else
   changed, stop: another review round is needed (`/review-block $ARGUMENTS`).
3. **CI.** CI must be green for the branch's latest push: `gh run list --branch <branch>` if `gh`
   is available, or the GitHub Actions page. If neither is available, run the CI commands locally
   and record the result. (The planning baseline is exempt: CI arrives in block 001.)

## Step 1 — Review notes

For every note in the latest review, choose one:
- **Record it** as a tech-debt item with a reason. A new tech-debt item is bookkeeping.
- **Fix it.** A fix is never bookkeeping, even when it only touches docs. Commit it, update the
  completion log, and run `/review-block $ARGUMENTS` again. That is a new round, with a new
  record. Then restart this skill.

List each note's outcome in the completion log under "Review items addressed".

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

If anything fails, stop and list exactly what needs fixing. Fixing anything outside the
bookkeeping list means another review round.

## Step 3 — Closing commit (on the block branch)

1. Set the spec to `Status: Closed`, tick its acceptance-criteria checkboxes, and update the
   table in `docs/blocks/README.md`.
2. Link the completion log in the Evidence column of `docs/prd.md` §9, for each requirement this
   block delivered.
3. Add `CHANGELOG.md` entries under `Unreleased`.
4. Commit `docs: close block $ARGUMENTS`.
5. **Milestone blocks only** (002, 005, 009, 012): follow the release steps in the
   commit-conventions rule. Move the entries into a version section, run
   `npm version x.y.z --no-git-tag-version`, and commit `chore: release vX.Y.Z`.
6. Push.

The block is now **Closed**: its branch never changes again, and the next block can stack on it.

## Step 4 — Merging (only when the developer opens PRs)

PRs are deferred by default. Do this step only when the developer asks for it. Then work through
every unmerged branch in stack order, one PR at a time, starting with `docs/planning-baseline`:

1. Check the merge gate again for that branch: latest review passes, only bookkeeping since, CI
   green.
2. `gh pr create --base main --head <branch> --title "[NNN] <title>"`. Use a body from the PR
   template that links the branch's review records and completion log. The branch below has
   already merged, so the PR shows only this branch's commits.
3. Once CI is green, run `gh pr merge <n> --merge`. It must be a merge commit: no squash, no
   rebase. Keep the branch: no `--delete-branch`.
4. `git fetch origin`, and confirm `git merge-base --is-ancestor origin/<branch> origin/main`.
5. **If the branch carried a release** (`chore: release vX.Y.Z`), tag that merge commit, which is
   `origin/main` right after the merge: `git tag -a vX.Y.Z <merge-sha> -m "vX.Y.Z"`, then
   `git push origin vX.Y.Z`. For `v1.0.0` only, also run
   `gh release create v1.0.0 --title "v1.0.0" --notes "<CHANGELOG section>"`.
6. Repeat for the next branch.

## Report

```
=== Close Report: $ARGUMENTS ===
Block: <title>
Verdict: CLOSED | BLOCKED
Review: round <n>, <verdict>; notes: <n fixed, n moved to tech debt>
Checklist: log ✓ · spec ✓ · tech debt ✓ · docs ✓ · ADRs ✓ · bugs ✓
Release prepared: <vX.Y.Z, or none>
Merged: <PR # → main, or "deferred (PRs not yet opened)">
Next block: <id and title, by dependency order>
```
