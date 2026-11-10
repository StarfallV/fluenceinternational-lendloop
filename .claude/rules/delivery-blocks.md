# Delivery Blocks

LendLoop is built in numbered delivery blocks ([docs/blocks/](../../docs/blocks/),
[ADR-009](../../docs/adr/ADR-009-repository-workflow.md)).

## Lifecycle

| Step | Skill | Result |
| --- | --- | --- |
| Plan | `/create-blocks` | Spec in `docs/blocks/`, with `Status: Planned` |
| Execute | `/run-block NNN` | Branch, commits, completion log and PR. `Status: In review`. |
| Review | `/review-block NNN` | Verdict from a fresh, isolated agent: PASS, PASS WITH NOTES or NEEDS WORK |
| Close | `/close-block NNN` | Review notes handled, closing commit, merge. `Status: Closed`, plus a release tag at milestones. |

- One block at a time, unless identifiers were claimed for parallel work
  ([docs/id-registry.md](../../docs/id-registry.md)).
- A block starts only when every block it depends on is Closed, meaning its PR is merged.
- **NEEDS WORK:** fix on the same branch, update the completion log, and run `/review-block`
  again.

## When the spec is wrong

If implementation shows the spec is wrong, update the spec first, on the same branch, and then
build against the updated spec. Record the change under "Deviations from spec" in the completion
log.

## Completion log

Path: `docs/logs/NNN-completion.md`. It is the block's last commit before review.

```markdown
# Completion Log — NNN <Title>

**Date:** YYYY-MM-DD
**Status:** Complete
**Branch / PR:** feature/NNN-slug · #<n>

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
  same PR.
- If scope or a business rule changed, update `docs/prd.md`.
- When a block closes:
  - link its completion log in the Evidence column of `docs/prd.md` §9;
  - set `Status: Closed` in the spec and in the `docs/blocks/README.md` table;
  - add `Unreleased` entries to `CHANGELOG.md`.
