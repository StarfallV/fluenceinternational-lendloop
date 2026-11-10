# ADR-005 — At-least-once delivery, idempotent write-backs, claimed reminders

**Status:** Accepted (revised 2026-11-10 after planning review round 1)
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

Networks fail between Convex and n8n in both directions, so both sides retry. The brief requires
write-backs to be idempotent, "so retries do not create duplicate records or reminders". Three
choices follow:
1. When does n8n acknowledge a loan event, and who owns its retries?
2. How does Convex keep write-backs unique when it has no unique indexes?
3. How do we stop two reminder runs from emailing the same borrower twice?

## Options Considered

### Acknowledge on receipt (202), then process asynchronously

- **Pros:** a fast reply; the classic webhook-consumer pattern.
- **Cons:** if n8n fails after replying, the event is gone. n8n's own retries are the only safety
  net, and n8n does not resume crashed executions.

### Acknowledge after sending (200 only once the email is out)

- **Pros:** the Convex outbox is the single retry authority; an event is done only when the email
  has actually gone.
- **Cons:** if the reply is lost after a successful send, the retry sends a second email. If n8n
  also retried internally, its retry budget could outlast Convex's timeout and turn every SMTP
  blip into a duplicate.

### Deduplicate inside n8n (for example the Remove Duplicates node across executions)

- **Pros:** it could suppress the rare duplicate.
- **Cons:** it marks an item as seen before the send succeeds, so a failed send could be dropped
  for good. It also adds state to n8n that is hard to see and test.

### Uniqueness in Convex: an index lookup plus insert inside one mutation

Convex mutations are serializable. Two concurrent duplicates conflict, Convex retries the loser,
and the retry finds the row.

### Reminders: fetch-then-write vs. claim at fetch

If the overdue list is simply read, two overlapping runs both see the same loans before either
writes back. Claiming each loan for the day inside the fetch mutation makes overlapping runs
disjoint.

## Decision

**Loan events: at-least-once, with Convex as the only retry authority.**
- n8n replies 2xx only after the email is sent.
- The loan-event workflow does **not** retry the send, and its execution timeout (20 s) is shorter
  than Convex's fetch timeout (30 s). Invariant: n8n always answers or gives up before Convex does.

**Write-backs are upserts keyed by a natural idempotency key**, unique inside one mutation:

| Key | Notes |
| --- | --- |
| `notification:<eventId>` | |
| `reminder:<loanId>:<YYYY-MM-DD>` | |
| `run:<runId>` | `runId` is a UUID minted per execution in the workflow |
| `error:<errorId>` | `errorId` is a UUID minted per execution in the workflow |

UUIDs are used instead of n8n execution IDs, which restart at 1 whenever the n8n data volume is
recreated.

**Reminders are claimed when they are fetched:**
- `/n8n/overdue-loans` marks each returned loan's key as `sending`, with a 15-minute lease.
- A loan with a `sent` key, or a live `sending` one, is never returned again that day.
- **Status moves forward only:** `sending` → `sent` (final) or `failed`; `failed` → `sent`;
  nothing downgrades.
- Write-backs must match an existing claim.

## Rationale

Duplicate *records* are a correctness bug; the design rules them out. Duplicate *emails* remain
possible only in narrow cases:
- a reply lost after a send;
- a crash between a reminder's send and its write-back;
- a replay of a signed event inside the window.

That is the standard trade-off of webhook systems, and far better than losing notifications. All
three cases are documented.

## Consequences

- Every write-back endpoint returns `200` with `created`, `updated` or `duplicate`, so n8n's
  retries are always safe.
- `convex-test` cannot prove concurrent uniqueness, so a smoke test sends concurrent write-backs
  to the dev deployment.
- The residual duplicate-email cases are listed in security.md §6 and TD-006.
