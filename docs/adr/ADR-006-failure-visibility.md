# ADR-006 — Failure visibility: dead letters, an error workflow, and a heartbeat

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The brief requires retries and an error workflow (or equivalent), "so failed runs are visible and
never fail silently". Failures happen in three places:
1. Convex fails to reach n8n.
2. A step inside an n8n workflow fails.
3. n8n doesn't run at all: it is down, or its schedule never fires.

An n8n error workflow covers only the second, because it cannot fire when n8n itself is down.

## Options Considered

### n8n error workflow only

- **Pros:** native and simple.
- **Cons:** blind to Convex-side delivery failures, and to n8n being down.

### External monitoring (uptime checks, alerting service)

- **Pros:** it is how production does it.
- **Cons:** another account and service for every reviewer. Out of proportion locally.

### Record every failure in Convex, plus a heartbeat, and show both to admins

- **Pros:** one place to look. It covers all three failure points, and it is testable.
- **Cons:** it alerts only when someone looks at the app, unless the email channel is up too.

## Decision

All three failure points are recorded in Convex and shown on the admin **Automation health**
panel, with a navigation badge when anything needs attention:

| Failure point | Mechanism |
| --- | --- |
| Convex → n8n delivery | Outbox retries with backoff, then a dead letter, which admins can retry |
| Workflow step | The n8n error workflow records the failure through `/n8n/errors` first, then emails `ADMIN_ALERT_EMAIL` |
| n8n not running | The reminder workflow posts a run summary (heartbeat) each run. No run within 26 h raises a warning. |

Node-level retries (`Retry On Fail`) handle transient failures before any of this applies.
Per-item error branches keep one bad reminder from failing the whole run.

## Rationale

The heartbeat is a dead-man's switch. It turns "n8n quietly stopped" into something visible,
which is the failure mode an error workflow cannot catch. Keeping the records in Convex lets the
same reactive UI show health that shows everything else.

## Consequences

- The reminder workflow must post its run summary even when every reminder fails.
- The error workflow uses only error metadata (workflow, node, message, execution ID), never the
  failed execution's payload, so no personal data reaches admin emails.
- Production would add an external alert on the heartbeat (block 012).
