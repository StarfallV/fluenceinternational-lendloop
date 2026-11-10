# Delivery blocks

LendLoop is built in numbered delivery blocks. Each block is a bounded piece of work with its own
spec, branch, independent review, completion log and, eventually, PR. The lifecycle and rules are
in [.claude/rules/delivery-blocks.md](../../.claude/rules/delivery-blocks.md).

```
spec (Planned) → /run-block (In progress) → completion log (In review) → /review-block
  → review record in docs/reviews/ → /close-block (Closed) → PR merged into main, later
```

Blocks run one at a time, in number order, on stacked branches while PRs are deferred
([ADR-009 amendment](../adr/ADR-009-repository-workflow.md)). The planning baseline is at the
bottom, and each block branches from the one before it. A Closed branch never changes again;
fixes go into the block in progress. Whether a branch has merged lives in git: branches are kept
after merging, and a merged branch is an ancestor of `origin/main`.

The first row is the planning baseline itself. It has a status like a block, and block 001 starts
only once it is Closed.

| Block | Module | Title | Depends on | Status | Release |
| --- | --- | --- | --- | --- | --- |
| — | — | Planning baseline: requirements, architecture, ADRs, specs and process ([reviews](../reviews/README.md)) | — | Closed | |
| [001](001-project-scaffold-and-tooling.md) | PLT | Project scaffold and tooling | — | In progress | |
| [002](002-identity-and-roles.md) | AUTH | Identity and roles | 001 | Planned | v0.1.0 |
| [003](003-tool-listings.md) | TOOL | Tool listings | 002 | Planned | |
| [004](004-borrowing-and-loans.md) | LOAN | Borrowing, loans and the clock | 003 | Planned | |
| [005](005-admin-moderation.md) | AUTH | Admin moderation | 004 | Planned | v0.2.0 |
| [006](006-integration-core.md) | AUTO | Integration core (Convex side) | 005 | Planned | |
| [007](007-local-automation-stack.md) | AUTO | Local automation stack | 006 | Planned | |
| [008](008-loan-event-notifications.md) | AUTO | Loan event notifications and error handler | 006, 007 | Planned | |
| [009](009-overdue-reminders.md) | AUTO | Overdue reminders workflow | 008 | Planned | v0.3.0 |
| [010](010-automation-activity-and-health.md) | WEB | Automation activity and health UI | 009 | Planned | |
| [011](011-ux-polish.md) | WEB | UX polish | 010 | Planned | |
| [012](012-documentation-and-release.md) | PLT | Documentation and release | 011 | Planned | v1.0.0 |

**Status values:** Planned → In progress → In review → Closed. Closed means the review passed and
the docs are final. A Closed block may still be waiting for its PR.

## Spec template

```markdown
# NNN — Title

**Status:** Planned
**Module:** PLT | AUTH | TOOL | LOAN | AUTO | WEB
**Branch:** feature/NNN-short-slug (a fix block after block 012: fix/BUG-nnn-short-slug)

## Goal
One or two sentences: what this block delivers and why it matters.

## Dependencies
- Depends on: block IDs, or None
- Depended on by: block IDs that list this block directly, or None

## Requirements
PRD IDs this block delivers or contributes to.

## Inputs
What must exist or be read first.

## Outputs
What this block produces: functions, tables, UI, scripts, docs.

## Acceptance Criteria
- [ ] Specific, testable criterion (name the test or the manual check).

## Known Constraints
Verification items, open questions, and scope limits, or "None".

## Manual Steps
Anything only the developer can do (accounts, logins, env values), or remove the section.
```
