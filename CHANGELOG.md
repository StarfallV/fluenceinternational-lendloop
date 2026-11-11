# Changelog

All notable changes to LendLoop are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). How a release is cut is described in
[commit-conventions](.claude/rules/commit-conventions.md#releases).

## [Unreleased]

### Added

- Planning baseline: product requirements, architecture, security model, ADR-001 – ADR-009,
  delivery block specs 001 – 012, the tech-debt and identifier registers, contributor rules, and
  workflow skills.
- Independent review records (`docs/reviews/`) and a read-only reviewer agent. The planning
  baseline was revised after review round 1, which covered delivery state, timeouts, reminder
  claims, the shared clock, redaction, signing details, and the stacked-branch workflow.
- Revised again after review round 2:
  - reminder runs are hourly in the daytime, with retry-safe claims and leases longer than a run
    can last, so an interrupted run delays a reminder instead of dropping it;
  - only a positive acknowledgement counts as a delivered loan event;
  - ordered-delivery gaps are closed;
  - the clock ticks every minute;
  - rejection counters are capped;
  - the merge gate has one definition, and Closed branches are frozen, with fixes going forward;
  - skills pre-approve only the commands they need, and the deny rules are broader and verified.
- Revised again after review round 3:
  - reminders go out one loan at a time, with no send retry and a time budget, under a 30-minute
    lease;
  - the sweep marks abandoned and missed claims, so interrupted runs show within minutes and
    nothing stays open past midnight;
  - n8n's timezone is wired from `APP_TIMEZONE`, and the catch-up trigger is dropped;
  - blocks run in number order, each from the previous block's branch, and the planning baseline
    is Closed before block 001;
  - a PreToolUse hook blocks shell commands that name secret files.
- Planning baseline closed after review round 4 (PASS WITH NOTES). Its notes are recorded as
  TD-009 – TD-012, each aimed at the block that will resolve it.
- Block 001, project scaffold and tooling:
  - a Next.js 16 app (App Router, React 19) with the LendLoop landing page shell, styled with
    Tailwind CSS 4 and shadcn/ui;
  - TypeScript 6 in strict mode, ESLint with zero warnings, Prettier, and Vitest with a `node`
    and an edge-runtime `convex` project;
  - CI on every pushed branch and on pull requests, and a PR template;
  - `npm run check:ids`, which fails on duplicate TD, ADR or BUG identifiers or block numbers;
  - a Claude Code secret guard: file deny rules and a PreToolUse hook that blocks shell commands
    that name secret files or print secrets, with linear-time checks and a size cap;
  - the Node floor set to the toolchain's range (`^22.13.0 || ^24.0.0 || >=26.0.0`), and `shadcn`
    as a dev dependency.

### Changed

- The process, by developer decision after block 001's four review rounds: one review per
  block, fixes for a passing review's notes need no further round, one `v1.0.0` release at
  submission, and no identifier registry (ADR-009 amendment).
