---
name: report-bug
description: Structured bug report via guided questions. Gathers expected vs. actual behavior, reproduction steps, severity and the related block, then writes docs/bugs/BUG-nnn-<slug>.md.
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

Create a structured bug report. Ask the developer only for what you cannot find out yourself.

## Step 1 — Gather facts

1. **What happened**, and **what should have happened**. Quote the error message or output if
   there is one.
2. **Steps to reproduce**, plus the environment: browser, local stack, or tests.
3. **Severity** (definitions in `.claude/rules/tech-debt-and-bugs.md`). Suggest one and confirm
   it.
4. **Related block:** find it from the code area (`git log` on the affected files), and confirm
   it.

## Step 2 — Investigate

Read the relevant code and tests. Form a root-cause hypothesis that points at specific files and
functions. If you can reproduce the bug with a failing test, write down the test you would add.
Don't commit it yet.

## Step 3 — Write the report

Take the next free `BUG-` number. Claim it first in `docs/id-registry.md` if branches run in
parallel. Write `docs/bugs/BUG-nnn-<slug>.md`:

```markdown
# BUG-nnn: <short description>

**Severity:** Critical | High | Medium | Low
**Related block:** NNN
**Date identified:** YYYY-MM-DD
**Status:** Open

## Symptom
What is observed: errors, wrong output, wrong state.

## Expected behavior
What should happen, citing the PRD rule or acceptance criterion it breaks.

## Steps to reproduce
1. …

## Root cause
The suspected or confirmed cause, with file and function references.

## Fix approach
- What will change, and why.
- The files expected to change.
- The test that will fail before the fix and pass after it.
- Risks and side effects.
```

## Step 4 — Report

Print the bug ID, title, severity and file path. Then suggest the branch name
`fix/BUG-nnn-<slug>` and the next step: fix, test, then the completion log, as described in the
tech-debt-and-bugs rule.
