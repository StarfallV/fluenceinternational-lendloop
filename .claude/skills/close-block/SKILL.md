---
name: close-block
description: Closes a delivery block after a passing review — handles review notes, finalizes docs, applies the merge gate, and (only when the developer opens PRs) merges the stack with merge commits and tags the v1.0.0 release. The bookend to /run-block.
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
2. **Only bookkeeping and note fixes since the review.** Run
   `git diff --stat <reviewed-sha>..HEAD`, then read the diff of every file it lists. Each change
   must be bookkeeping (`.claude/rules/delivery-blocks.md`, "Merge gate"), or a fix for a note of
   the latest review that the completion log lists under "Review items addressed". If anything
   else changed, stop: another review round is needed (`/review-block $ARGUMENTS`).
3. **CI.** CI must be green for the branch's latest push: `gh run list --branch <branch>` if `gh`
   is available, or the GitHub Actions page. If neither is available, run the CI commands locally
   and record the result. (The planning baseline is exempt: CI arrives in block 001.)

## Step 1 — Review notes

Handle every note in the latest review once (delivery-blocks rule, "Review policy"):
- **Fix it** on the branch, with green checks. After a PASS or PASS WITH NOTES, no new review
  round is needed.
- **Or record it** as a tech-debt item with a reason. Prefer this for Minor notes that would take
  real work, or that only widen best-effort tooling.

List each note's outcome in the completion log under "Review items addressed", with the fixing
commit or the TD number.

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

If anything fails, stop and list exactly what needs fixing. Fixing anything that is neither
bookkeeping nor a fix for a review note means another review round.

## Step 3 — Closing commit (on the block branch)

1. Set the spec to `Status: Closed`, tick its acceptance-criteria checkboxes, and update the
   table in `docs/blocks/README.md`.
2. Link the completion log in the Evidence column of `docs/prd.md` §9, for each requirement this
   block delivered.
3. Add `CHANGELOG.md` entries under `Unreleased`.
4. Commit `docs: close block $ARGUMENTS`.
5. **The last planned block only:** follow the release steps in the commit-conventions rule. Move
   the entries into a `[1.0.0]` section, run `npm version 1.0.0 --no-git-tag-version`, and commit
   `chore: release v1.0.0`.
6. Push.

The block is now **Closed**: its branch never changes again, and the next block can stack on it.

## Step 4 — Merging (only when the developer opens PRs)

PRs are deferred by default. Do this step only when the developer asks for it. Then work through
every unmerged branch in stack order, one PR at a time, starting with `docs/planning-baseline`:

1. Check the merge gate again for that branch: latest review passes, only bookkeeping and note
   fixes since, CI green.
2. `gh pr create --base main --head <branch> --title "[NNN] <title>"`. Use a body from the PR
   template that links the branch's review records and completion log. The branch below has
   already merged, so the PR shows only this branch's commits.
3. Once CI is green, run `gh pr merge <n> --merge`. It must be a merge commit: no squash, no
   rebase. Keep the branch: no `--delete-branch`. The planning baseline has no CI, because CI
   arrives in block 001. Merge it before `main` requires status checks, or ask the developer to
   merge it with admin rights.
4. `git fetch origin`, and confirm `git merge-base --is-ancestor origin/<branch> origin/main`.
5. **If the branch carried the release** (`chore: release v1.0.0`), tag that merge commit, which
   is `origin/main` right after the merge: `git tag -a v1.0.0 <merge-sha> -m "v1.0.0"`, then
   `git push origin v1.0.0`, and run
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
