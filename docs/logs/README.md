# Completion logs

There is one log per delivery block, `NNN-completion.md`, committed as the block's last commit
before review. Bug fixes get `BUG-nnn-completion.md`. Each log lists:
- what was built;
- the evidence for every acceptance criterion;
- deviations from the spec;
- decisions made and ADRs created;
- tech debt recorded;
- how each review finding was addressed (the review records are in [../reviews/](../reviews/));
- notes for the next block.

The format is defined in
[.claude/rules/delivery-blocks.md](../../.claude/rules/delivery-blocks.md#completion-log).
