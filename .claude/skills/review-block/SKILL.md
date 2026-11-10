---
name: review-block
description: Adversarial review of a delivery block against its spec, architecture, security rules and acceptance criteria, run in a fresh isolated agent with no memory of the implementation. Returns PASS / PASS WITH NOTES / NEEDS WORK.
argument-hint: "[block-id]"
context: fork
agent: general-purpose
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

Perform an adversarial review of delivery block `$ARGUMENTS`. Your job is to find problems.
Assume they exist.

You did not write this code. You owe nothing to the implementation. You owe everything to the
spec, the architecture, the security rules and the acceptance criteria.

**You are read-only.** Do not edit, create, stage or commit files. Bash is only for `git log`,
`git diff`, `git show`, and running checks (`npm run typecheck`, `npm run lint`, `npm test`).

## Pre-flight

1. The spec `docs/blocks/$ARGUMENTS-*.md` exists. If it doesn't, stop: "No spec for
   $ARGUMENTS."
2. The completion log `docs/logs/$ARGUMENTS-completion.md` exists on the current branch. If it
   doesn't, stop: "Block not executed yet; run /run-block first."

## Step 1 — Load the baseline

Read:
- the spec;
- `docs/architecture.md`;
- `docs/security.md`;
- the ADRs the spec links;
- `CLAUDE.md`;
- every file in `.claude/rules/`;
- the completion log.

## Step 2 — Identify the change

Run `git diff --stat origin/main...HEAD` and `git log --oneline origin/main..HEAD`. Then read
every changed file in full, not just the diff hunks.

## Step 3 — Acceptance criteria

For each criterion:
1. Find the code that satisfies it, and the evidence the log cites.
2. Check that the code really fulfils it, not just that something related exists. Open the cited
   tests and confirm they assert the right thing.
3. Probe the edge cases: empty or extreme input, boundary values, concurrency (two calls racing),
   wrong caller, wrong state, retries.
4. If it isn't satisfied, mark it **FAIL** and say exactly why.

## Step 4 — Architecture and rules

- Module boundaries and code layout follow architecture.md §3.
- Every public Convex function uses a `lib/functions.ts` wrapper, and model code applies the
  ownership and party checks.
- Loan status changes go only through `transition()`.
- The coding, testing and commit conventions are followed. That includes commit message format
  and granularity.

## Step 5 — Security and privacy (always)

- **Authorization:** can a user act on someone else's data? Does any argument let a caller choose
  who "I" am? Are admin paths enforced on the server?
- **Data exposure:** do any results, payloads, logs or errors contain emails or other personal
  data beyond BR-16 and architecture.md §7.2?
- **Integration:** is the signature verified on the raw body before parsing, in constant time,
  with the window and path? Are write-backs idempotent?
- **Secrets:** are there secrets or secret-shaped strings in code, tests, docs or workflow JSON?
  Do the scripts print secrets?
- **Input:** are there unvalidated inputs, missing length limits, or injection paths?

## Step 6 — Quality

- **Errors:** handled and surfaced; no bare catches and no swallowed errors.
- **Tests:** the acceptance criteria are covered, and so are the obvious untested paths.
- **Clarity:** names and structure make sense without reading the spec.
- **Checks:** run `npm run typecheck`, `npm run lint` and `npm test`, and report the results.

## Step 7 — Spec drift and bookkeeping

- Every deviation listed in the log is really in the code, and nothing changed without being
  recorded.
- The tech-debt items listed in the log exist in `docs/tech-debt.md`.
- The docs were updated where the design or scope moved.

## Report

```
=== Review: $ARGUMENTS ===

Verdict: PASS | PASS WITH NOTES | NEEDS WORK

Checks: typecheck <ok/fail> · lint <ok/fail> · tests <n passed / n failed>

Acceptance criteria:
- <criterion>: PASS | FAIL — <why, if FAIL>

Architecture and rules:
- <finding, or "No violations found">

Security and privacy:
- <finding, or "No issues found">

Issues:
1. [Critical | Major | Minor] <description>
   Location: <file:line>
   Recommendation: <specific fix>

Undocumented deviations:
- <list, or "None found">

Positive observations:
- <what was done well>
```

## Verdict criteria

- **PASS:** every criterion met, and no Critical or Major issues.
- **PASS WITH NOTES:** every criterion met, with Minor issues only.
- **NEEDS WORK:** any criterion failed, or any Critical or Major issue.
