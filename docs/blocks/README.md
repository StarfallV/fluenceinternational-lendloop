# Delivery blocks

LendLoop is built in numbered delivery blocks. Each block is a bounded piece of work with its own
spec, branch, PR, independent review and completion log. The lifecycle and rules are in
[.claude/rules/delivery-blocks.md](../../.claude/rules/delivery-blocks.md).

```
spec (Planned) → /run-block → PR (In review) → /review-block → /close-block → merged (Closed)
```

| Block | Module | Title | Depends on | Status | Release |
| --- | --- | --- | --- | --- | --- |
| [001](001-project-scaffold-and-tooling.md) | PLT | Project scaffold and tooling | — | Planned | |
| [002](002-identity-and-roles.md) | AUTH | Identity and roles | 001 | Planned | v0.1.0 |
| [003](003-tool-listings.md) | TOOL | Tool listings | 002 | Planned | |
| [004](004-borrowing-and-loans.md) | LOAN | Borrowing and loans | 003 | Planned | |
| [005](005-admin-moderation.md) | AUTH | Admin moderation | 004 | Planned | v0.2.0 |
| [006](006-integration-core.md) | AUTO | Integration core (Convex side) | 005 | Planned | |
| [007](007-local-automation-stack.md) | AUTO | Local automation stack | 006 | Planned | |
| [008](008-loan-event-notifications.md) | AUTO | Loan event notifications workflow | 006, 007 | Planned | |
| [009](009-overdue-reminders.md) | AUTO | Overdue reminders workflow | 008 | Planned | v0.3.0 |
| [010](010-automation-activity-and-health.md) | WEB | Automation activity and health UI | 009 | Planned | |
| [011](011-ux-polish.md) | WEB | UX polish | 010 | Planned | |
| [012](012-documentation-and-release.md) | PLT | Documentation and release | 011 | Planned | v1.0.0 |

**Status values:** Planned → In progress → In review → Closed.

## Spec template

```markdown
# NNN — Title

**Status:** Planned
**Module:** PLT | AUTH | TOOL | LOAN | AUTO | WEB
**Branch:** feature/NNN-short-slug

## Goal
One or two sentences: what this block delivers and why it matters.

## Dependencies
- Depends on: block IDs, or None
- Depended on by: block IDs, or None

## Requirements
PRD IDs this block delivers or contributes to.

## Inputs
What must exist or be read first.

## Outputs
What this block produces: functions, tables, UI, scripts, docs.

## Acceptance Criteria
- [ ] Specific, testable criterion (name the test or the manual check).

## Known Constraints
Verification items, open questions, and scope limits.

## Manual Steps
Anything only the developer can do (accounts, logins). Remove if none.
```
