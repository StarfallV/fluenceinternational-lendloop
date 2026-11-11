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
2. **Base branch** (commit-conventions rule). Blocks run one at a time, in number order:
   - the base is block $ARGUMENTS−1's branch (the Branch line of its spec), or
     `docs/planning-baseline` for block 001. A fix block's spec exists only on its own branch, so
     if that spec isn't in this checkout, find the commit that has it and its path with
     `git log --all --format=%H --name-only -1 -- "docs/blocks/<NNN−1>-*.md"`, and read its
     Branch line with `git show <sha>:<path>`;
   - if that branch has merged (`git merge-base --is-ancestor origin/<branch> origin/main`), the
     base is `main` instead.
3. **The base is Closed.** Read the base's state from the base itself, never from the current
   checkout, because status lines differ between branches:
   - `git show origin/<base>:docs/blocks/README.md`: the previous block's row (for block 001, the
     planning-baseline row) and the row of every block under this spec's "Depends on" must say
     Closed;
   - the previous block's highest-round review record (for block 001,
     `docs/reviews/planning-baseline-review-*.md`), listed with
     `git ls-tree --name-only origin/<base> docs/reviews/`, must say PASS or PASS WITH NOTES.

   If not, stop and list what is missing.
4. **Branch.** If the spec's branch already exists, locally or on `origin`, stop and suggest
   `/resume-block $ARGUMENTS`. Otherwise run
   `git switch -c <branch from the spec's Branch line> origin/<base>`. For a fix block, run this
   from a checkout of the base, where create-blocks wrote the uncommitted spec, bug report and
   index rows: `git switch` carries changes to tracked files only when they are the same in the
   current checkout and in the base, and refuses otherwise.
5. **Spec and context.** On the new branch, read `docs/blocks/$ARGUMENTS-*.md`, `CLAUDE.md`, every
   rule in `.claude/rules/`, and the architecture sections and ADRs the spec links.
6. **Clarity.** If an acceptance criterion is ambiguous, ask the developer before building.
7. **Manual steps.** If the spec lists **Manual Steps** that aren't done yet (missing env
   variables, missing logins), ask the developer to do them, and say exactly what you need. Check
   variables only through scripts that report "set" or "missing", never by printing values.
8. **Start.** Set the spec to `Status: In progress`, and update the table in
   `docs/blocks/README.md`. Commit: `docs: start block $ARGUMENTS`. This commit also adds any bug
   report waiting for this block and, for a fix block, its spec and index rows. They were left
   uncommitted (report-bug, create-blocks), and `git switch -c` carried them onto the new branch.

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
