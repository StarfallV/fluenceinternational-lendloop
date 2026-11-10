# Review records

Before a delivery block can close, a fresh, read-only agent reviews it adversarially. The
planning baseline was reviewed the same way
([ADR-009](../adr/ADR-009-repository-workflow.md)). Each round's report is committed here
verbatim, together with the commit it reviewed, so the verdict that gates a merge is on record
and readable later.

**File names:** `NNN-review-<round>.md` for blocks, and `planning-baseline-review-<round>.md` for
the planning baseline.

**Header** at the top of every record:

```markdown
**Reviewed commit:** <sha> · **Range:** <base>...<sha> · **Date:** YYYY-MM-DD
**Reviewer:** fresh read-only agent (`block-reviewer`) · **Verdict:** PASS | PASS WITH NOTES | NEEDS WORK
```

The report follows the header unchanged. The answer to each finding goes in the block's
completion log under "Review items addressed". For the planning baseline, the answers are
appended to the review record under "Author response".

**Merge gate:** a branch may merge only when its latest review has verdict PASS or PASS WITH
NOTES, and every commit after the reviewed commit is bookkeeping only. The gate and the exact
list of bookkeeping changes are defined once, in the
[delivery-blocks rule](../../.claude/rules/delivery-blocks.md#merge-gate). Anything else needs
another review round.
