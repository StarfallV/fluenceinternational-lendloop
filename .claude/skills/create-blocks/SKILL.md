---
name: create-blocks
description: Decomposes the PRD into sequenced delivery blocks. Generates numbered spec files in docs/blocks/ with goals, dependencies, requirement IDs, acceptance criteria and constraints. Use when planning new scope.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

Decompose scope from the PRD into delivery blocks. Follow this process exactly.

## Step 1 — Read context

1. Read `docs/prd.md`. Note every requirement ID that is not yet mapped in §9, or that the
   developer named for this planning pass.
2. Read `docs/architecture.md`, `docs/security.md` and the ADR index.
3. Read `CLAUDE.md` and `.claude/rules/delivery-blocks.md`.
4. List `docs/blocks/` to find the next free block number. Read the existing specs, so new blocks
   neither duplicate nor contradict them.

## Step 2 — Decompose

Each block must be:
- **Bounded:** completable in one focused session, roughly 1–3 hours of execution.
- **Self-contained:** a clear start state and end state; it never needs another block half done.
- **Sequenced by dependency:** if B needs A's output, A comes first.
- **Cut along seams:** by module or aggregate (for example "the loan state machine"), not by
  layer (for example "the database layer").
- **UX-aware:** error states, feedback and recovery paths that the PRD implies get explicit
  acceptance criteria, or their own block. They must not hide inside a back-end block.

## Step 3 — Write the specs

Write `docs/blocks/NNN-<kebab-slug>.md` using the template in `docs/blocks/README.md`:
- the **Branch** line is `feature/NNN-<kebab-slug>`. A fix block, which carries a bug fix after
  the last planned block (tech-debt-and-bugs rule), uses `fix/BUG-nnn-<slug>` and lists the bug
  report under **Inputs**;
- **Requirements** lists PRD IDs;
- every acceptance criterion is testable, and names its test or its manual check.

## Step 4 — Verify the plan

1. No block depends on a block with a higher number.
2. Every dependency points at a block that exists.
3. Taken together, the blocks cover the requested scope. List any requirement left uncovered.
4. Every block that needs an account or login lists it under **Manual Steps**.

## Step 5 — Update the indexes

- Add the blocks to the table in `docs/blocks/README.md`.
- Add the requirement → block mapping to `docs/prd.md` §9.

## Step 6 — Report

Print a table:

| Block | Module | Title | Depends on | Scope estimate |
| --- | --- | --- | --- | --- |

Then say: "Delivery blocks created. Ready for spec review before execution begins."
