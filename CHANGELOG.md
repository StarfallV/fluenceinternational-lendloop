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
