# Delivery Blocks

LendLoop is built in numbered delivery blocks ([docs/blocks/](../../docs/blocks/),
[ADR-009](../../docs/adr/ADR-009-repository-workflow.md)).

## Lifecycle

| Step | Skill | Result |
| --- | --- | --- |
| Plan | `/create-blocks` | Spec in `docs/blocks/`, with `Status: Planned` |
| Execute | `/run-block NNN` | Branch (from `main` or the dependency branch), commits, and a completion log committed together with `Status: In review` |
| Review | `/review-block NNN` | A fresh, read-only `block-reviewer` agent reports PASS, PASS WITH NOTES or NEEDS WORK. The main session records the report in `docs/reviews/NNN-review-<round>.md`, with the reviewed commit. |
| Close | `/close-block NNN` | Review notes handled (any code fix means a new review round), closing commit, `Status: Closed` |
| Merge | When the developer opens PRs | One PR per branch in stack order, merge commits, a tag at each milestone |

- **One block at a time,** unless identifiers were claimed for parallel work
  ([docs/id-registry.md](../../docs/id-registry.md)).
- **A block starts** when everything it depends on is **Closed**: review passed and docs final.
  Merged or not doesn't matter, because branches stack.
- **NEEDS WORK:** fix on the same branch, update the completion log, and run `/review-block` again.
  That is the next round, with a new record.

## Merge gate

A branch may merge only when all of these hold:
- its latest review record says PASS or PASS WITH NOTES;
- every commit after the reviewed commit is bookkeeping only: files under `docs/`,
  `CHANGELOG.md`, and the `version` fields that `npm version` changes;
- CI is green.

Any other change after the review needs another review round.

## When the spec is wrong

If implementation shows the spec is wrong, update the spec first, on the same branch, and then
build against the updated spec. Record the change under "Deviations from spec" in the completion
log.

## Completion log

Path: `docs/logs/NNN-completion.md`. It is committed together with the spec's switch to
`Status: In review`, as the block's last commit before review.

```markdown
# Completion Log — NNN <Title>

**Date:** YYYY-MM-DD
**Status:** Complete
**Branch:** feature/NNN-slug (base: <main or dependency branch>)

## What was built
A short description of what now exists.

## Acceptance criteria
| Criterion | Result | Evidence |
| --- | --- | --- |
| <criterion text> | PASS | `describe › it` test name, or "Manual: <what was done> → <what was observed>" |

## Deviations from spec
Each difference and its reason, or "None".

## Decisions made
Decisions not covered by the spec: the alternatives and why one was chosen. Link ADRs.

## ADRs created
"ADR-NNN — title", or "None".

## Tech debt recorded
"TD-nnn — title", or "None".

## Verification items resolved
Items from architecture.md §16 this block settled, and what was found.

## Review items addressed
Filled in after review: each finding from docs/reviews/NNN-review-*.md, and whether it was
fixed (commit) or recorded (TD-nnn). "None" if the first review passed without notes.

## Notes for the next block
Anything the next session needs to know.
```

## ADRs

Create an ADR when a decision would be questioned later, picked between viable options,
constrains future work, or goes against the expected approach. Don't create one for a routine
choice that follows an existing pattern.

To create one: take the next free number (claim it if branches run in parallel), use the template
in `docs/adr/README.md`, and add it to the index there.

## Keeping docs true

- If the architecture or the integration contract changed, update `docs/architecture.md` in the
  same branch.
- If scope or a business rule changed, update `docs/prd.md`.
- When a block closes:
  - link its completion log in the Evidence column of `docs/prd.md` §9;
  - set `Status: Closed` in the spec and in the `docs/blocks/README.md` table;
  - add `Unreleased` entries to `CHANGELOG.md`.
