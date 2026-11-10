# ADR-009 — Repository workflow: delivery blocks on a single trunk, SemVer tags

**Status:** Accepted (amended 2026-11-10, and the amendment revised after planning review rounds 2 and 3)
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

- `main` only changes through merged PRs. The exceptions are the root commit, and identifier
  claims once work continues from `main` with parallel branches (see the amendment).
- If the project ever gains deployed environments, re-adding `develop` and a release guard is
  additive.

## Amendment — 2026-11-10: stacked branches, deferred PRs, recorded reviews

The developer prefers to open PRs later rather than block on them ("We can PR later no?").
Planning review round 1 also showed that a review verdict needs a durable place to live.

- **One rule for bases.** Blocks run one at a time, in number order. Block NNN branches from
  block NNN−1's branch, and block 001 from the planning baseline. Once that branch has merged, the
  block branches from `main` instead. The dependency graph is linear, so every dependency is in
  the base.
- **A block starts when its base is Closed:**
  - the latest review passed;
  - its notes are handled, either fixed through another round or recorded as tech debt;
  - the closing bookkeeping is committed.

  The planning baseline has a status row in `docs/blocks/README.md` like a block, and block 001
  waits for it to be Closed.
- **Closed branches are frozen.** No commit lands on a Closed branch, and nothing is merged
  forward. A problem found later is fixed in the block in progress, as `fix:` commits that its
  review covers. After the last planned block, a fix becomes a block of its own. A fix therefore
  never forces a re-review of another branch.
- **Deferred PRs.** PRs are opened later, one at a time in stack order, starting with the planning
  baseline. Each is opened against `main` once the PR below it has merged, so its diff shows only
  its own commits, and is merged with a merge commit.
- **Branches are kept** after merging, so "merged" stays checkable in git: a branch has merged when
  its tip is an ancestor of `origin/main`. No docs table records it, so merging needs no
  bookkeeping commit.
- **Recorded reviews.** Every review round is committed verbatim in `docs/reviews/`, with the
  commit it reviewed. A branch may merge only when its latest review is PASS or PASS WITH NOTES and
  every later commit is bookkeeping only. This replaces "PASS on the latest commit", which could
  not hold once closing commits were added.
- **Bookkeeping is narrow**, and defined once, in the
  [delivery-blocks rule](../../.claude/rules/delivery-blocks.md#merge-gate): review records,
  completion logs, status lines and criteria checkboxes, the §9 evidence column, additions to the
  tech-debt register, new bug reports and their status lines, `CHANGELOG.md`, and the `version`
  fields that `npm version` changes. Any
  other change, including any other docs change, needs a new review round. On the planning
  baseline, the docs are the deliverable, so this matters most there.
- **CI on every pushed branch**, not only on PRs, so each block is checked before its PR exists.
  The planning baseline predates CI, so its PR merges without it.
- **Releases** are tagged when the milestone block merges into `main`. GitHub Releases are created
  only for `v1.0.0`; earlier milestones are tags and CHANGELOG entries.
- **Identifier claims** aren't needed while blocks run one at a time. Once work continues from
  `main` with parallel branches, claims are committed to `main` before the branches are cut.
