---
name: run-block
description: Executes a delivery block per its spec — pre-flight, settle verification items, implement, verify, commit, tech debt, docs, completion log, PR. Use when starting block NNN.
argument-hint: "[block-id]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

Execute delivery block `$ARGUMENTS`. Follow this sequence exactly. Do not skip steps.

## Pre-flight

Run these checks in order. If one fails, stop and report it.

1. **Spec.** Read `docs/blocks/$ARGUMENTS-*.md`. If it doesn't exist, stop.
2. **Context.** Read `CLAUDE.md`, every rule in `.claude/rules/`, and the architecture sections
   and ADRs the spec links.
3. **Dependencies.** For each block under "Depends on", check that
   `docs/logs/<id>-completion.md` exists on `origin/main` and that its spec says
   `Status: Closed`. If any is missing, stop and list them.
4. **Branch.**
   1. Run `git fetch origin && git switch main && git pull --ff-only`.
   2. Create the branch named in the spec's **Branch** line: `git switch -c <branch>`.
   3. If that branch already exists, stop and suggest `/resume-block $ARGUMENTS`.
5. **Clarity.** If an acceptance criterion is ambiguous, ask the developer before building.
6. **Manual steps.** If the spec lists **Manual Steps** that aren't done yet (missing env
   variables, missing logins), ask the developer to do them, and say exactly what you need.
7. **Start.** Set the spec to `Status: In progress`, and update the table in
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

Write `docs/logs/$ARGUMENTS-completion.md` in the format from the delivery-blocks rule. Every
acceptance criterion needs a result and evidence. Commit it last:
`docs: add block $ARGUMENTS completion log`.

## Step 8 — Open the PR

1. Set the spec to `Status: In review`, update the blocks table, and commit.
2. Push: `git push -u origin HEAD`.
3. Open the PR with `gh pr create --base main --title "[$ARGUMENTS] <block title>"`. Use a body
   that follows `.github/pull_request_template.md`.
4. If `gh` is unavailable, give the developer the compare URL
   `https://github.com/StarfallV/fluenceinternational-lendloop/compare/main...<branch>`.
5. Start `/review-block $ARGUMENTS`.

## Report

- Block ID and title.
- Number of commits.
- Acceptance criteria: how many passed out of the total.
- ADRs created.
- Tech-debt items added.
- PR link.
- Review started: yes or no.
