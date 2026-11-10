# ADR-005 — At-least-once delivery, idempotent write-backs

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

Networks fail between Convex and n8n in both directions, so both sides retry. The brief requires
write-backs to be idempotent, "so retries do not create duplicate records or reminders". Two
choices follow:
1. When does n8n acknowledge a loan event?
2. How does Convex keep write-backs unique when it has no unique indexes?

## Options Considered

### Acknowledge on receipt (202), then process asynchronously

- **Pros:** a fast reply; the classic webhook-consumer pattern.
- **Cons:** if n8n fails after replying, the event is gone. Its own retries are the only safety
  net, and n8n does not resume crashed executions.

### Acknowledge after sending (200 only once the email is out)

- **Pros:** the Convex outbox is the single retry authority; an event is done only when the
  email has actually gone.
- **Cons:** if the reply is lost after a successful send, the retry sends a second email.

### Deduplicate inside n8n (for example the Remove Duplicates node across executions)

- **Pros:** it could suppress the rare duplicate.
- **Cons:** it marks an item as seen before the send succeeds, so a failed send could be dropped
  for good. It also adds state to n8n that is hard to see and test.

### Uniqueness in Convex: an index lookup plus insert inside one mutation

Convex mutations are serializable. Two concurrent duplicates conflict, Convex retries the loser,
and the retry finds the row.

## Decision

- **Loan events:** at-least-once. n8n replies 2xx only after the email has been sent.
- **Write-backs** (reminder status, run summaries, errors, notification records): upserts keyed by
  a natural idempotency key, unique inside one mutation:
  - `notification:<eventId>`
  - `reminder:<loanId>:<YYYY-MM-DD>`
  - `run:<workflow>:<executionId>`
  - `error:<workflow>:<executionId>`
- **Reminder status only moves forward:** `failed` → `sent` is an upgrade, and nothing downgrades
  a `sent` reminder.
- **Duplicate sends are prevented at the source:** `/n8n/overdue-loans` leaves out loans that
  already have a `sent` reminder for today. Re-running the workflow, by hand or after an outage,
  sends nothing new.

## Rationale

Duplicate *records* are a correctness bug; the design rules them out. A duplicate *email* is
possible only in the narrow case of a reply lost after a send. That is the standard trade-off of
webhook systems, and far better than losing notifications.

## Consequences

- Every write-back endpoint returns `200` with `created`, `updated` or `duplicate`, so n8n's
  retries are always safe.
- Idempotency is tested by sending the same write-back twice, and concurrently.
- The residual duplicate-email risk is documented in security.md §6.
