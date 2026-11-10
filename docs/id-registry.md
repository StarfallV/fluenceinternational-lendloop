# Identifier registry

Sequential identifiers (`TD-`, `BUG-`, `ADR-`) are taken in order by the branch that needs them.
While PRs are deferred, blocks run one at a time in number order on stacked branches, so two
branches never take numbers at the same time, and no claims are needed
([ADR-009](adr/ADR-009-repository-workflow.md)). Block numbers never collide, because they are
fixed when the blocks are planned.

**Once everything has merged and work continues from `main` with two branches open at once**,
claim identifiers here before creating the second branch:

1. Add a row for each branch. `TD-` claims take a range of 10. `ADR-` and `BUG-` claims take
   single numbers.
2. Commit the change straight to `main` as `docs: claim <ids> for <branch>`, and cut the branches
   from that commit. Apart from the root commit, this is the only direct commit `main` accepts
   (ADR-009). Claims are serialized through `main`, so two branches cannot hold the same number.
3. Stay inside your range. If it runs out, claim another one. Gaps are expected; never renumber
   to close them.

`npm run check:ids` runs in CI and fails any PR that introduces an identifier already defined
elsewhere in `docs/`. That stops a collision from merging, even if a claim was forgotten.

## TD ranges

| Range | Claimed by | Date | Status |
| --- | --- | --- | --- |

## ADR numbers

| Number | Claimed by | Date | Status |
| --- | --- | --- | --- |

## BUG numbers

| Number | Claimed by | Date | Status |
| --- | --- | --- | --- |

No claims yet. Every branch so far has run on its own.
