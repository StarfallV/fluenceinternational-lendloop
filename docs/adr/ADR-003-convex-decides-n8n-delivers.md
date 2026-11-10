# ADR-003 — Convex decides, n8n delivers; loan events leave through a transactional outbox

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

When a borrow request is created or changes status, n8n must notify "the relevant user, using
only the fields it needs". Two questions follow:
1. Where does the logic for **who** is notified, and **with what**, live?
2. How does an event reliably leave Convex when the HTTP call to n8n can fail?

## Options Considered

### Option A — Send rich events and let n8n decide

Send the full loan, both users and the tool; n8n routes and picks the recipient.
- **Pros:** the n8n workflow is self-contained.
- **Cons:** business rules are duplicated outside the codebase and untested. It sends far more
  personal data than needed (both emails on every event).

### Option B — Convex resolves the recipient and sends a minimal payload

Convex decides; n8n formats and sends.
- **Pros:** one place for the rules, and those rules are tested. The payload carries one email
  and display names only.
- **Cons:** changing who gets notified needs a code change. This is intended.

### Delivery: fire-and-forget `fetch` in an action

Simple, but a failed call loses the event. Calling from the mutation itself is impossible,
because Convex mutations cannot do network I/O.

### Delivery: `@convex-dev/workpool` or `action-retrier` components

They provide durable retries, but delivery status would live inside the component. That makes it
harder to show dead letters to admins and to retry them by hand.

### Delivery: transactional outbox table plus scheduled delivery

The mutation inserts an `outbox` row and schedules the delivery action **in the same
transaction**. The action sends; its outcome is recorded; a sweep cron catches anything
stranded.

## Decision

**Option B, with a transactional outbox.** The outbox stores IDs only (`loanId`, `recipientId`,
`type`, `eventId`), and the payload is built at send time. The retry policy, dead letters and the
sweep are specified in architecture.md §7.3.

## Rationale

The outbox gives "no lost events, no events for changes that rolled back" for free, because
Convex makes the insert and the scheduling atomic with the state change. Keeping the outbox as
our own table makes delivery status a first-class, queryable record, which is what the admin
health panel and the "never fail silently" requirement need.

## Consequences

- Every loan transition must enqueue exactly one event. Tests assert this for each transition.
- Convex runs scheduled actions at most once, so the sweep cron is required, not optional.
- Recipient and content rules are TypeScript in `convex/model/automation.ts`; n8n only holds the
  message templates.
