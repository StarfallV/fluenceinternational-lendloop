# Architecture Decision Records

Each ADR records one decision: its context, the options that were considered, the choice, and
what it costs. Create an ADR when a decision would be questioned later, involved several viable
options, constrains future work, or goes against the expected approach
([delivery-blocks rule](../../.claude/rules/delivery-blocks.md)).

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-001](ADR-001-local-topology-convex-cloud-n8n-tunnel.md) | Local topology: Convex cloud dev deployment, n8n in Docker behind a filtered tunnel; amended to a local Convex deployment | Accepted (amended) |
| [ADR-002](ADR-002-convex-is-the-authorization-authority.md) | Convex is the authorization authority | Accepted |
| [ADR-003](ADR-003-convex-decides-n8n-delivers.md) | Convex decides, n8n delivers; loan events leave through a transactional outbox | Accepted |
| [ADR-004](ADR-004-hmac-request-signing.md) | HMAC request signing in both directions | Accepted (revised) |
| [ADR-005](ADR-005-delivery-semantics-and-idempotent-write-backs.md) | At-least-once delivery, idempotent write-backs; amended to daily reminders without claims | Accepted (amended) |
| [ADR-006](ADR-006-failure-visibility.md) | Failure visibility: dead letters, an error workflow, and a heartbeat; amended to a leaner health view | Accepted (amended) |
| [ADR-007](ADR-007-email-via-smtp-mailpit-locally.md) | Email over SMTP, caught locally by Mailpit | Accepted |
| [ADR-008](ADR-008-calendar-dates-in-one-app-timezone.md) | Loan dates are calendar dates in one app timezone; queries read a shared clock | Accepted (revised) |
| [ADR-009](ADR-009-repository-workflow.md) | Repository workflow: delivery blocks on a single trunk; stacked branches, deferred PRs, one review per block, one release | Accepted (amended) |

## Template

```markdown
# ADR-NNN — Decision title

**Status:** Proposed | Accepted | Superseded by ADR-NNN
**Date:** YYYY-MM-DD
**Block:** NNN

## Context
What situation or problem prompted this decision.

## Options Considered
### Option A — Name
Description, pros, cons.

## Decision
Which option was chosen.

## Rationale
Why, and which trade-offs were accepted.

## Consequences
What becomes easier or harder, what is constrained, what debt is introduced.
```
