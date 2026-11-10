# ADR-009 — Repository workflow: delivery blocks on a single trunk, SemVer tags

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The project follows the engineering process of a larger reference codebase:
- numbered delivery blocks with specs and completion logs;
- an adversarial review before merge;
- decision records and a tech-debt register;
- an identifier-claim registry;
- a `develop` → `main` promotion flow with a guarded release log.

This project has one developer, no deployed environments, and a reviewer reading the history.

## Options Considered

### Option A — Adopt the reference process unchanged

- **Pros:** proven, and familiar to its author.
- **Cons:** `develop` and `main` exist to separate "integrated" from "released to production",
  and there is no production here. The release guard protects tag-triggered deploys, and nothing
  deploys from tags here.

### Option B — Keep the principles, drop the parts that serve deployments

- **Pros:** the auditable parts stay (specs, logs, review, decisions, debt register, conventional
  commits, release log, tags), without ceremony that guards nothing.
- **Cons:** it diverges from the reference in visible ways.

### Option C — Plain commits to `main`, no process

- **Pros:** fastest.
- **Cons:** loses the reasoning trail that this project is partly evaluated on.

## Decision

**Option B:**

| Practice | Here |
| --- | --- |
| Delivery blocks, specs, completion logs | Kept: `docs/blocks/`, `docs/logs/` |
| Adversarial review in a fresh agent before merge | Kept: the `review-block` skill. A merge needs PASS or PASS WITH NOTES. |
| Decision records | ADRs only, in `docs/adr/`. Requirements-stage decisions are ADRs too. |
| Tech-debt register, resolved in place | Kept: `docs/tech-debt.md` |
| Branching | `main`, plus `feature/NNN-slug` per block, merged by PR with merge commits. No `develop`. |
| Releases | `CHANGELOG.md` and annotated SemVer tags (`v0.1.0` after 002, `v0.2.0` after 005, `v0.3.0` after 009, `v1.0.0` at submission). No release guard. |
| Identifier claims | Block numbers are fixed at planning. TD, BUG and ADR numbers are claimed in `docs/id-registry.md` only when two branches are open at once. A duplicate-ID check runs in CI. |
| Commits | Conventional commits citing the block, several green commits per block, the completion log last |

## Rationale

Each kept practice produces evidence a reviewer can follow: why something was built, how it was
checked, and what was deferred. Each dropped practice protected a deployment pipeline that does
not exist here.

## Consequences

- `main` only changes through merged PRs, with two exceptions: the root commit, and identifier
  claims in `docs/id-registry.md`, which must land before the branches that use them.
- If the project ever gains deployed environments, re-adding `develop` and a release guard is
  additive.
