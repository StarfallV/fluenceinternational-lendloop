# 006 — Integration core (Convex side)

**Status:** Planned
**Module:** AUTO
**Branch:** feature/006-integration-core

## Goal
Build the Convex half of the n8n integration: signing, the transactional outbox with bounded
retries and dead letters, the signed HTTP endpoints for reminders, runs and errors, redaction, and
idempotent write-backs. All of it is testable without n8n running.

## Dependencies
- Depends on: 005
- Depended on by: 007

## Requirements
AUT-1 (Convex side), AUT-2 (endpoints), AUT-3 (data), ADM-4 (data and retry), SEC-3 (Convex side),
SEC-5 (payloads, redaction), REL-1, REL-2 (Convex side), BR-19, BR-20.

## Inputs
- [architecture.md §4, §7–§12](../architecture.md#7-convex--n8n-loan-events),
  [ADR-003](../adr/ADR-003-convex-decides-n8n-delivers.md),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md) and
  [ADR-006](../adr/ADR-006-failure-visibility.md), with their 2026-11-11 amendments.
- [security-standards](../../.claude/rules/security-standards.md) (Integration).

## Outputs
- **Libraries:**
  - `convex/lib/hmac.ts`: newline-separated canonical string, the UTF-8 of the secret string as
    the key, constant-time comparison, and a fixed test vector that block 007 reuses in n8n.
  - `convex/lib/redact.ts`: replaces email-shaped strings and truncates to 200 characters.
- **Tables:** `outbox`, `automationEvents` and `workflowRuns`, with the indexes in
  architecture.md §4.
- **`convex/model/automation.ts`:** `enqueueLoanEvent(ctx, loan, type, reason?)`, which resolves
  the recipient per BR-19; the payload builder (§7.2); the outcome classifier and backoff (§7.3);
  the due-reminder and reminder-result rules (§8).
- **Emission:** every loan transition from blocks 004 and 005 enqueues exactly one event through
  `transition()`, including auto-declines, expiries, and cancellations from listing deletion or
  removal, and schedules its first delivery attempt.
- **Delivery** (§7.3): the `deliver(outboxId, attempt)` action (30 s abort; only the positive
  acknowledgement counts; always records an outcome, mapping exceptions to `CONFIG` or
  `INTERNAL`); `recordOutcome`, which applies only to the row's current attempt; backoff of
  30 s, 2 min, 10 min and 1 h (5 attempts); the 10-minute sweep cron; and admin
  `retryDelivery` and `retryAllDeliveries`, both audited.
- **`convex/http.ts`** (§8): `/n8n/reminders/due`, `/n8n/reminders/result`, `/n8n/runs` and
  `/n8n/errors`; checks in the order 413 → 401 → 400 → handler; rejections logged as codes;
  handlers call internal functions only.
- **Queries:**
  - admin `health`: failed deliveries, recent workflow errors under any slug, and the last
    reminder run with its counts and a heartbeat state of `ok`, `stale` or `none`, computed from
    the clock;
  - `activityForLoan`: the loan's parties see statuses only, admins also see the redacted detail,
    and anyone else gets `NOT_FOUND`.
- **Smoke-test helper:** `dev:createOverdueLoan` (guarded), used by block 007. It creates a fresh
  approved loan between two demo users with dates in the past.
- **Environment:** `N8N_LOAN_EVENTS_URL`, both signing secrets and `APP_URL`, read through
  `lib/env.ts`.

## Acceptance Criteria
- [ ] **HMAC** (tests): a valid signature verifies; a tampered body, wrong path, wrong method,
      wrong secret, or a timestamp 301 s off all fail; the fixed vector passes; the canonical
      string uses newlines.
- [ ] **Redaction** (test): `550 5.1.1 <sam@example.com>: Recipient address rejected` is stored
      without the address and truncated to 200 characters.
- [ ] **Emission** (table-driven test): each transition creates exactly one outbox row with the
      right recipient: requested, approved, declined (manual and automatic), cancelled (every
      reason), expired and returned. Outbox rows hold no email or name.
- [ ] **Payload** (test): exactly the fields in architecture.md §7.2, with `loanRole` and no loan
      ID.
- [ ] **Delivery outcomes** (tests, stubbed `fetch`, fake timers):
  - `200` with `{"delivered":"<eventId>"}` → `delivered`, plus one `notification:<eventId>`
    record;
  - `200` with any other body, including another event's ID → the next attempt, with `BAD_ACK`;
  - `500`, a timeout (aborted at 30 s), `404` and `429` → the next attempt, scheduled;
  - `400`, `401`, `422` and other `4xx` → `failed` at once;
  - a missing URL or secret → `failed` with `CONFIG`;
  - the 5th failed attempt → `failed`.
- [ ] **Attempt guard** (tests): a `deliver` scheduled for an attempt that isn't the row's current
      one does nothing; a stale `recordOutcome` changes nothing; the sweep counts a `pending` row
      more than 10 minutes overdue as a failed attempt and schedules the next, and dead-letters it
      after the 5th.
- [ ] **Admin retry** (tests): `retryDelivery` and `retryAllDeliveries` revive dead letters at
      attempt 1, schedule them, and write audit rows. A non-admin gets `FORBIDDEN`.
- [ ] **HTTP endpoints** (tests through `convex-test` HTTP calls): over 64 KiB → `413` even when
      unsigned; unsigned, badly signed or expired → `401` with an empty body; an invalid body →
      `400`; valid → `200`. A rejection writes nothing.
- [ ] **Due reminders** (tests, fake time): only approved loans past their end date, with fewer
      than 7 reminders and no `sent` record today, with exactly the listed fields, at most 50. A
      loan whose reminder failed today is returned again.
- [ ] **Reminder results** (tests): a key that doesn't match the body's `loanId`, a future date,
      or an unknown loan → `400`; `sent` twice → one record, and `remindersSent` + 1 exactly
      once; `failed` after `sent` changes nothing; `sent` after `failed` → `sent`, counted once;
      after the 7th reminder the loan is long overdue and no longer due.
- [ ] **Run and error records** (tests): `/n8n/runs` and `/n8n/errors` are idempotent by their
      IDs; an unknown workflow slug is stored, and its errors appear in `health`.
- [ ] **Heartbeat state** (tests): `none` before any run, `ok` after one, `stale` once the clock is
      more than 26 h past the last run's `receivedAt`.
- [ ] **Activity** (tests): visible only to the loan's parties and admins, others get
      `NOT_FOUND`; parties see no error messages or emails; admins see only redacted messages.

## Known Constraints
- Verify Web Crypto HMAC in Convex actions and HTTP actions, and how `convex-test` calls HTTP
  actions ([architecture.md §16](../architecture.md#16-open-verification-items)).
- `N8N_LOAN_EVENTS_URL` gets its value from block 007's setup. Until then, deliveries fail at once
  with `CONFIG`, show as dead letters, and can be re-sent with Retry all.
