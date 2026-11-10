# 006 — Integration core (Convex side)

**Status:** Planned
**Module:** AUTO
**Branch:** feature/006-integration-core

## Goal
Build the Convex half of the n8n integration: signing, the transactional outbox with ordered,
bounded retries and dead letters, the signed HTTP endpoints, reminder claims, redaction, and
idempotent write-backs. All of it is testable without n8n running.

## Dependencies
- Depends on: 005
- Depended on by: 007, 008

## Requirements
AUT-1 (Convex side), AUT-2 (endpoints), AUT-3 (data), ADM-4 (data and retry), SEC-3 (Convex side),
SEC-5 (payloads, redaction), REL-1, REL-2 (Convex side), BR-19, BR-20.

## Inputs
- [architecture.md §4, §7–§12](../architecture.md#7-convex--n8n-loan-events),
  [ADR-003](../adr/ADR-003-convex-decides-n8n-delivers.md),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **Libraries:**
  - `convex/lib/hmac.ts`: newline-separated canonical string; the key is the UTF-8 of the secret
    string; constant-time comparison. A fixed test vector, which block 008 reuses in n8n.
  - `convex/lib/redact.ts`: replaces email-shaped strings and truncates to 200 characters.
- **Tables:** `outbox`, `automationEvents`, `workflowRuns`, `integrationStats`.
- **`convex/model/automation.ts`:**
  - `enqueueLoanEvent(ctx, loan, type, reason?)`, which resolves the recipient per BR-19;
  - the payload builder (architecture.md §7.2);
  - the outcome classifier (§7.3) and the backoff schedule.
- **Emission:** every loan transition from blocks 004 and 005 enqueues exactly one event through
  `transition()`. That includes auto-declines, expiries, and cancellations from listing deletion
  or removal.
- **Delivery in `convex/automation.ts`** (architecture.md §7.3):
  - `claim`: pending, due, no live lease, oldest of its loan; increments attempts; returns a
    lease token.
  - `deliver` (action): a 30 s timeout; always records an outcome, mapping exceptions to `CONFIG`
    or `INTERNAL`.
  - `recordOutcome`: ignores stale tokens.
  - `sweep` (cron, every 5 minutes): re-schedules due rows, and dead-letters crashed final
    attempts.
  - Admin `retryDelivery` and `retryAllDeliveries`: audited; superseded events become `skipped`.
- **Queries:**
  - admin `health`: counts by status, dead letters, recent errors, today's rejections, the last
    reminder run, and a heartbeat state of `ok`, `stale` or `none`, computed from the clock;
  - `activityForLoan`: the loan's parties see statuses only; admins also see the redacted
    detail; anyone else gets `NOT_FOUND`.
- **`convex/http.ts`:**
  - endpoints `/n8n/overdue-loans` (with claims), `/n8n/reminders`, `/n8n/runs`, `/n8n/errors`;
  - checks run in the order 413 → 401 → 400 → handler;
  - rejection reasons go to the logs and the daily `integrationStats` row;
  - handlers call internal functions only.
- **Smoke-test helper:** `dev:makeLoanOverdue` (guarded), used by block 009.
- **Environment:** `N8N_LOAN_EVENTS_URL`, both signing secrets and `APP_URL`, read through
  `lib/env.ts`.

## Acceptance Criteria
- [ ] **HMAC** (tests):
  - a valid signature verifies;
  - a tampered body, wrong path, wrong method, wrong secret, or a timestamp 301 s off all fail;
  - the fixed vector passes;
  - the canonical string uses newlines.
- [ ] **Redaction:** an SMTP-style message such as
      `550 5.1.1 <sam@example.com>: Recipient address rejected` is stored without the address and
      truncated to 200 characters (test).
- [ ] **Emission:** each transition creates exactly one outbox row with the right recipient. The
      table-driven test covers requested, approved, declined (manual and automatic), cancelled
      (every reason), expired and returned. Outbox rows hold no email or name.
- [ ] **Payload:** contains exactly the fields in architecture.md §7.2, with `loanRole` and no loan
      ID (test on the built object).
- [ ] **Delivery outcomes** with a stubbed `fetch` and fake timers (tests):
  - `200` → `delivered`, plus one `notification:<eventId>` record;
  - `500`, a timeout, `404`, `429` and `530` (`TUNNEL_STALE`) → stay `pending` with the scheduled
    next attempt;
  - `400`, `401` and other `4xx` → `failed` at once;
  - a missing URL or secret → `failed` with `CONFIG`;
  - the sixth failed attempt → `failed`.
- [ ] **Claim rules** (tests):
  - a row that isn't due, is leased, or isn't `pending` cannot be claimed;
  - two concurrent claims → only one gets a token;
  - a later event of a loan waits while an earlier one is `pending`, and proceeds once the earlier
    one is delivered or failed.
- [ ] **Crash paths** (tests):
  - `recordOutcome` with a stale token changes nothing;
  - a `deliver` that dies without recording leaves an expired lease. The sweep re-schedules the
    row (the attempt counts), and after the sixth such attempt dead-letters it.
- [ ] **Admin retry** (tests): `retryDelivery` and `retryAllDeliveries` revive dead letters and
      write audit rows. A dead letter whose loan already has a newer delivered event becomes
      `skipped`. A non-admin gets `FORBIDDEN`.
- [ ] **HTTP endpoints** (tests through `convex-test` HTTP calls):
  - over 64 KiB → `413` even when unsigned (the size check comes first);
  - unsigned, badly signed or expired → `401` with an empty body;
  - invalid body → `400`;
  - valid → `200`;
  - each rejection increments today's `integrationStats` row with its reason.
- [ ] **Overdue claims** (tests):
  - `/n8n/overdue-loans` returns only eligible loans, with exactly the listed fields;
  - it marks each returned loan `sending`;
  - a second call within the lease returns none of them;
  - a loan with a `sent` reminder today, or with 7 reminders sent, is never returned.
- [ ] **Reminder write-backs** (tests):
  - a key that doesn't match the body's `loanId`, has a future date, or has no claim → `400`;
  - `sent` twice → one record, and `remindersSent` + 1 exactly once;
  - `failed` → `sent` upgrades; `sent` → `failed` never downgrades.
- [ ] **Run and error records** (tests): `/n8n/runs` (by `runId`) and `/n8n/errors` (by
      `errorId`, with or without an `executionId`) are idempotent. An unknown `workflow` value is
      stored, not rejected.
- [ ] **Heartbeat state** (tests): `none` before any run; `ok` after a run; `stale` once the clock
      is more than 26 h past the last run's `receivedAt`.

## Known Constraints
- Verify Web Crypto HMAC in Convex actions and HTTP actions, and how `convex-test` calls HTTP
  actions ([architecture.md §16](../architecture.md#16-open-verification-items)).
- `convex-test` is not a real backend, so the concurrency tests here only show that the logic is
  correct. The real proof is `smoke:idempotency` in block 009.
- `N8N_LOAN_EVENTS_URL` gets its real value in block 007. Until then, deliveries fail at once
  with `CONFIG`, are visible as dead letters, and can be re-sent with "Retry all".
