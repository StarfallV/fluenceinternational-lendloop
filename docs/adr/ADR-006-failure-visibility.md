# ADR-006 — Failure visibility: dead letters, an error workflow, and a heartbeat

**Status:** Accepted (revised 2026-11-10 after planning review rounds 1, 2 and 3)
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
panel. A navigation badge lights when something needs action: dead letters, workflow errors in
the last 24 h, abandoned reminder claims, reminders missed in the last 24 h, or a stale heartbeat.
Rejected inbound calls are shown, but don't light the badge, because one stray request isn't an
incident.

| Failure point | Mechanism |
| --- | --- |
| Convex → n8n delivery | Outbox retries with backoff, then a dead letter. Only the positive acknowledgement counts as delivered. Admins can retry one dead letter or all of them. A stale tunnel URL is labelled `TUNNEL_STALE`. |
| Workflow step | The n8n error workflow records the failure through `/n8n/errors`, continuing even if that call fails, and then always emails `ADMIN_ALERT_EMAIL` |
| Interrupted reminder run | The sweep marks its unresolved claims `abandoned` within minutes of their lease expiring. Health shows them until a later run takes them over, and that run's summary counts them as `reclaimed`. A claim still open when its day ends becomes `missed`: shown for 24 h, and the loan is reminded the next day. |
| n8n not running | The reminder workflow runs hourly in the daytime and posts a run summary (heartbeat) each run, including runs with nothing to remind. No run summary received within 26 h raises a warning. A fresh setup shows "no run yet". |
| Bad signatures or clock skew | Each rejected inbound call is counted per day and reason, up to 100 each, with the last reason, on the health panel |

Neither email step uses Retry On Fail. Convex owns loan-event retries (ADR-005), and a later
hourly run retries a failed reminder. n8n would re-send every item of a node on a retry, so the
reminder workflow handles one loan at a time, and a failed send affects only its own loan. Calls
from n8n to Convex do retry, because they are idempotent.

Time-based flags ("stale", "errors in the last 24 h", "missed in the last 24 h") are computed
from the `clock` row (ADR-008), which changes every hour and at midnight, so an open admin page
updates without a reload. Abandoned claims don't depend on the clock's hour precision: the sweep
marks them.

**On n8n 2.x an error workflow runs only when it is published.** Setup publishes every workflow in
`n8n/workflows/` by its committed ID, and `check:workflows` verifies that each one except the
handler links to it. Runs started from the editor don't trigger error workflows, so scripted runs
use the signed `run-reminders` webhook instead.

## Rationale

The heartbeat is a dead-man's switch. It turns "n8n quietly stopped" into something visible,
which is the failure mode an error workflow cannot catch. Keeping the records in Convex lets the
same reactive UI show health that shows everything else.

## Consequences

- The reminder workflow must post its run summary even when every reminder fails, and on runs
  with nothing to remind.
- The error workflow uses only error metadata: workflow slug, node, error code, and a redacted,
  truncated message. Never the failed execution's payload. Convex redacts again before storing.
  Parties see only a status; admins see the redacted detail.
- Production would add an external alert on the heartbeat (block 012).
