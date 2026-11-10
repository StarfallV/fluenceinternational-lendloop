# 006 — Integration core (Convex side)

**Status:** Planned
**Module:** AUTO
**Branch:** feature/006-integration-core

## Goal
Build the Convex half of the n8n integration: signing, the transactional outbox with retries and
dead letters, the signed HTTP endpoints, and idempotent write-backs. All of it is testable
without n8n running.

## Dependencies
- Depends on: 005
- Depended on by: 007, 008, 009, 010

## Requirements
AUT-1 (Convex side), AUT-2 (endpoints), AUT-3 (data), ADM-4 (data and retry), SEC-3 (Convex side),
SEC-5 (payloads), REL-1, REL-2 (Convex side), BR-19.

## Inputs
- [architecture.md §7–§12](../architecture.md#7-convex--n8n-loan-events),
  [ADR-003](../adr/ADR-003-convex-decides-n8n-delivers.md),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **Signing:** `convex/lib/hmac.ts` (sign; verify with the time window and constant-time
  comparison), with a documented test vector that block 008 reuses in n8n.
- **Tables:** `outbox`, `automationEvents`, `workflowRuns`.
- **`convex/model/automation.ts`:**
  - `enqueueLoanEvent(ctx, loan, type, reason?)`, which resolves the recipient per BR-19;
  - the payload builder (architecture.md §7.2);
  - the retry classifier and backoff schedule.
- **Emission:** every loan transition from blocks 004 and 005 enqueues exactly one event through
  `transition()`. That includes auto-declines, expiries, and cancellations from listing deletion
  or removal.
- **`convex/automation.ts`:**
  - internal `claim`, `deliver` (an action), `recordOutcome` and `sweep` (cron every 5 minutes);
  - admin `retryDelivery` (audited) and admin `health` (counts, dead letters, recent errors, last
    reminder run, staleness flag);
  - `activityForLoan` (the loan's parties and admins only).
- **`convex/http.ts`:** `/n8n/overdue-loans`, `/n8n/reminders`, `/n8n/runs`, `/n8n/errors`. Each
  verifies the signature before parsing, caps the body at 64 KiB, validates it, and calls internal
  functions only.
- **Smoke-test helper:** `dev:makeLoanOverdue` (guarded), used by block 009.
- **Environment:** `N8N_LOAN_EVENTS_URL`, both signing secrets and `APP_URL`, read through
  `lib/env.ts`, with clear errors when one is missing.

## Acceptance Criteria
- [ ] **HMAC:** a valid signature verifies. A tampered body, wrong path, wrong method, wrong secret
      or a timestamp 301 s off all fail. The fixed test vector passes (tests).
- [ ] Each transition (requested, approved, declined manually and automatically, cancelled for
      every reason, expired, returned) creates exactly one outbox row with the right recipient.
      Table-driven test.
- [ ] Outbox rows hold no email or name (schema review plus a test on the inserted row).
- [ ] **Delivery** with a stubbed `fetch` and fake timers (tests):
  - `200` → `delivered`, plus one `notification:<eventId>` record;
  - `500`, a timeout, `404` and `429` → stay `pending`, next attempt per the schedule;
  - `400` and `401` → `failed` at once;
  - the sixth failed attempt → `failed` (dead letter).
- [ ] The claim lease prevents a double send when `deliver` runs twice concurrently (test).
- [ ] `sweep` re-schedules stranded pending rows and skips leased or future ones (test).
- [ ] Admin `retryDelivery` revives a dead letter and writes an audit row. A non-admin gets
      `FORBIDDEN` (tests).
- [ ] **HTTP endpoints** (tests through `convex-test` HTTP calls):
  - unsigned, badly signed or expired → `401` with an empty body;
  - over 64 KiB → `413`;
  - invalid body → `400`;
  - valid → `200`.
- [ ] `/n8n/overdue-loans` returns only overdue approved loans, only the listed fields, and leaves
      out loans with a `sent` reminder for today (test).
- [ ] `/n8n/reminders`:
  - sent twice with the same key → one record;
  - `failed` → `sent` upgrades; `sent` → `failed` never downgrades;
  - concurrent duplicates → one record.
  (tests)
- [ ] `/n8n/runs` and `/n8n/errors` are idempotent by key (tests).
- [ ] `health` reports the heartbeat as stale when there is no `overdue-reminders` run in the last
      26 h, including when there has never been one (test).

## Known Constraints
- Verify Web Crypto HMAC in Convex actions and HTTP actions, and `convex-test` support for HTTP
  actions ([architecture.md §16](../architecture.md#16-open-verification-items)).
- `N8N_LOAN_EVENTS_URL` gets its real value in block 007. Until then, deliveries retry and then
  dead-letter, which is the designed behavior.
