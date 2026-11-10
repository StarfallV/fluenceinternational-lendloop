---
name: run-block
description: Executes a delivery block per its spec — pre-flight, base-branch selection (stacked while PRs are deferred), settle verification items, implement, verify, commit, tech debt, docs, completion log, then independent review and its record. Use when starting block NNN.
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

Execute delivery block `$ARGUMENTS`. Follow this sequence exactly. Do not skip steps.

## Pre-flight

Run these checks in order. If one fails, stop and report it.

1. **Refresh.** Run `git fetch origin`.
2. **Spec.** Read `docs/blocks/$ARGUMENTS-*.md` and note its "Depends on" list and its Branch line.
   Every branch carries every spec, but status lines differ between branches, so read the
   dependencies' state from their own branches (next step), never from this checkout. If the spec
   exists nowhere, stop.
3. **Dependencies.** For each block under "Depends on", read its state from its own branch,
   `origin/<its Branch line>` (branches are kept after merging):
   - `git show origin/<branch>:docs/blocks/<id>-<slug>.md` must say `Status: Closed`;
   - its highest-round review record, listed by
     `git ls-tree --name-only origin/<branch> docs/reviews/`, must say PASS or PASS WITH NOTES
     (`git show origin/<branch>:docs/reviews/<id>-review-<round>.md`).

   If not, stop and list what is missing.
4. **Base branch** (commit-conventions rule):
   - if every dependency has merged (`git merge-base --is-ancestor origin/<branch> origin/main`),
     the base is `main`;
   - otherwise, the base is the branch of the highest-numbered dependency;
   - for block 001, the base is `docs/planning-baseline` until that branch has merged.
5. **Base review.** For block 001 on the planning baseline, the highest-round
   `docs/reviews/planning-baseline-review-*.md` on `origin/docs/planning-baseline` must say PASS or
   PASS WITH NOTES. Any other base was already checked in step 3.
6. **Branch.** If the spec's branch already exists, locally or on `origin`, stop and suggest
   `/resume-block $ARGUMENTS`. Otherwise run
   `git switch -c <branch from the spec's Branch line> origin/<base>`.
7. **Context.** On the new branch, read `CLAUDE.md`, every rule in `.claude/rules/`, and the
   architecture sections and ADRs the spec links.
8. **Clarity.** If an acceptance criterion is ambiguous, ask the developer before building.
9. **Manual steps.** If the spec lists **Manual Steps** that aren't done yet (missing env
   variables, missing logins), ask the developer to do them, and say exactly what you need. Check
   variables only through scripts that report "set" or "missing", never by printing values.
10. **Start.** Set the spec to `Status: In progress`, and update the table in
    `docs/blocks/README.md`. Commit: `docs: start block $ARGUMENTS`.

## Step 1 — Settle verification items

Resolve this block's items from `docs/architecture.md` §16 **before** building anything. Read the
installed packages' types and docs, or run a small experiment. If an outcome changes the design,
update the spec and architecture first, and record it for the completion log.

## Step 2 — Implement

- Follow the architecture and the rules.
- If the spec doesn't cover a decision, make a reasoned choice and record it for the completion
  log.
- If the spec turns out to be wrong, update it first, then build against it.

## Step 3 — Verify

- Run `npm run typecheck && npm run lint && npm test` before every commit. Add `npm run build`
  when the UI or configuration changed.
- For each acceptance criterion, collect evidence: a test name, or a manual check with what you
  observed.
- Don't continue to the next step until everything is green.

## Step 4 — Commit

Commit at natural boundaries with conventional commits ending in `(block $ARGUMENTS)`. Follow the
commit-conventions rule.

## Step 5 — Tech debt

Add a tech-debt item for anything deferred (tech-debt-and-bugs rule). If nothing was deferred,
add nothing; no placeholders.

## Step 6 — Keep the docs true

- Update `docs/architecture.md` and `docs/prd.md` if the design or scope moved.
- Create ADRs for decisions that qualify, and add them to `docs/adr/README.md`.

## Step 7 — Completion log

1. Write `docs/logs/$ARGUMENTS-completion.md` in the format from the delivery-blocks rule. Every
   acceptance criterion needs a result and evidence. Leave "Review items addressed" as "Pending
   review."
2. In the same commit, set the spec and the blocks table to `Status: In review`.
3. Commit: `docs: add block $ARGUMENTS completion log`.
4. Push: `git push -u origin HEAD`. CI runs on the pushed branch.

## Step 8 — Independent review

1. Run `/review-block $ARGUMENTS`. It runs in a fresh, read-only `block-reviewer` agent.
2. When the report returns, record it **verbatim** in
   `docs/reviews/$ARGUMENTS-review-<round>.md`, with the header from `docs/reviews/README.md`:
   - the reviewed commit is `git rev-parse --short HEAD`, taken when the review started;
   - the range is `<base>...<sha>`.
3. Commit as `docs: record block $ARGUMENTS review round <n>`, then push.
4. **If the verdict is NEEDS WORK:** fix on the branch, update the completion log, commit, push,
   and repeat this step. That is the next round.
5. **If the verdict is PASS or PASS WITH NOTES:** continue with `/close-block $ARGUMENTS`.

PRs are not opened here. The developer opens them later, in stack order (close-block "Merging").

## Report

- Block ID and title.
- Base branch.
- Number of commits.
- Acceptance criteria: how many passed out of the total.
- ADRs created.
- Tech-debt items added.
- Review rounds and the final verdict.
- Next step.
