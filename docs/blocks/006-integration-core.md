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
- **Tables:** `outbox`, `automationEvents`, `workflowRuns` and `integrationStats`, with the
  indexes in architecture.md §4, plus `loans.nextReminderOn` and its index.
- **`convex/model/automation.ts`:**
  - `enqueueLoanEvent(ctx, loan, type, reason?)`, which resolves the recipient per BR-19;
  - the payload builder (architecture.md §7.2);
  - the outcome classifier (§7.3), including the positive acknowledgement, and the backoff
    schedule;
  - the reminder claim and write-back rules (§8).
- **Emission:** every loan transition from blocks 004 and 005 enqueues exactly one event through
  `transition()`. That includes auto-declines, expiries, and cancellations from listing deletion
  or removal. `transition()` also maintains `nextReminderOn`: set on approval, cleared when the
  loan leaves `approved`.
- **Delivery in `convex/automation.ts`** (architecture.md §7.3):
  - `claim`: pending, due, no live lease, `attempts < 6`, oldest open event of its loan;
    increments attempts; returns a lease token. A superseded row becomes `skipped`, and a blocked
    row's `nextAttemptAt` moves behind the event ahead of it.
  - `deliver` (action): aborts its fetch after 30 s; only the positive acknowledgement counts as
    delivered; always records an outcome, mapping exceptions to `CONFIG` or `INTERNAL`.
  - `recordOutcome`: ignores stale tokens. When a row becomes final, the loan's next pending event
    is scheduled at once.
  - `sweep` (cron, every 5 minutes, bounded batches): schedules due rows, and dead-letters crashed
    final attempts.
  - Admin `retryDelivery` and `retryAllDeliveries`: audited; superseded rows become `skipped`, and
    revived rows are scheduled at once.
- **Queries:**
  - admin `health`: counts by status, dead letters, recent errors under any workflow slug (through
    `by_kind_received`), today's rejections per reason, abandoned reminder claims, the last
    reminder run with its counts, and a heartbeat state of `ok`, `stale` or `none`, computed from
    the clock;
  - `activityForLoan`: the loan's parties see statuses only; admins also see the redacted
    detail; anyone else gets `NOT_FOUND`.
- **`convex/http.ts`:**
  - endpoints `/n8n/overdue-loans` (with claims), `/n8n/reminders`, `/n8n/runs`, `/n8n/errors`;
  - checks run in the order 413 → 401 → 400 → handler;
  - rejection reasons go to the logs and, at most 100 times per reason per day, to the daily
    `integrationStats` row. The response is decided first and never depends on that write;
  - handlers call internal functions only.
- **Smoke-test helper:** `dev:makeLoanOverdue` (guarded), used by block 009. It moves a loan's
  dates into the past, and its `nextReminderOn` with them.
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
      (every reason), expired and returned. Outbox rows hold no email or name. Approval sets
      `nextReminderOn` to the day after the end date, and every transition out of `approved`
      clears it.
- [ ] **Payload:** contains exactly the fields in architecture.md §7.2, with `loanRole` and no loan
      ID (test on the built object).
- [ ] **Delivery outcomes** with a stubbed `fetch` and fake timers (tests):
  - `200` with `{"delivered":"<eventId>"}` → `delivered`, plus one `notification:<eventId>`
    record;
  - `200` with any other body, including another event's ID → `pending` with `BAD_ACK`;
  - `500`, a timeout (the fetch is aborted at 30 s), `404`, `429` and `530` (`TUNNEL_STALE`) →
    stay `pending` with the scheduled next attempt;
  - `404` with `X-LendLoop-Edge: denied` → `failed` at once with `CONFIG`;
  - `400`, `401`, `422` and other `4xx` → `failed` at once;
  - a missing URL or secret → `failed` with `CONFIG`;
  - the sixth failed attempt → `failed`.
- [ ] **Claim rules** (tests):
  - a row that isn't due, is leased, isn't `pending`, or already has 6 attempts cannot be
    claimed;
  - two concurrent claims → only one gets a token;
  - a later event of a loan waits while an earlier one is `pending`, and its `nextAttemptAt`
    moves to the earlier event's;
  - once the earlier event is delivered or dead-lettered, the later one is scheduled at once,
    without waiting for the sweep;
  - a revived dead letter becomes `skipped` at claim time when a newer event of its loan has been
    delivered, including one that was still in flight when the dead letter was revived.
- [ ] **Crash paths** (tests):
  - `recordOutcome` with a stale token changes nothing;
  - a `deliver` that dies without recording leaves an expired lease. The sweep re-schedules the
    row (the attempt counts). After the sixth such attempt the sweep dead-letters it, and it is
    never sent a seventh time.
- [ ] **Admin retry** (tests): `retryDelivery` and `retryAllDeliveries` revive dead letters,
      schedule them, and write audit rows. A dead letter whose loan already has a newer delivered
      event becomes `skipped`. A non-admin gets `FORBIDDEN`.
- [ ] **HTTP endpoints** (tests through `convex-test` HTTP calls):
  - over 64 KiB → `413` even when unsigned (the size check comes first);
  - unsigned, badly signed or expired → `401` with an empty body;
  - invalid body → `400`;
  - valid → `200`;
  - each rejection increments today's count for its reason until that count reaches 100; after
    that, nothing more is written for it;
  - the response never depends on the counter: when the counter write fails, a bad signature
    still gets `401` (a test of the rejection path with a failing counter).
- [ ] **Reminder claims** (tests, fake time):
  - `/n8n/overdue-loans` returns only loans due a reminder (approved, `nextReminderOn` today or
    earlier, fewer than 7 sent), with exactly the listed fields, and marks each `sending` with a
    20-minute lease;
  - a call from a **different** `runId` within the lease returns none of them;
  - a repeated call with the **same** `runId` returns the same loans;
  - once the lease has expired, `health` lists the claims as abandoned. Another run then gets
    them: each record's `abandoned` count goes up, and the response counts them in `reclaimed`,
    also when that call is repeated;
  - a loan with a `sent` reminder today, or with 7 reminders sent, is never returned. A `failed`
    one is returned to the next run.
- [ ] **Reminder write-backs** (tests):
  - a key that doesn't match the body's `loanId`, has a future date, or has no record → `400`;
  - `sent` twice → one record; `remindersSent` + 1 exactly once; `nextReminderOn` moves to the
    day after the reminder's date and never backwards, and the 7th reminder clears it;
  - `sent` from a run that has lost its claim is still accepted;
  - `failed` from the run holding the claim → `failed`. `failed` from any other run → ignored
    (`stale`), and the live claim is untouched;
  - `sent` is never downgraded.
- [ ] **Run and error records** (tests): `/n8n/runs` (by `runId`) and `/n8n/errors` (by
      `errorId`, with or without an `executionId`) are idempotent. An unknown `workflow` value is
      stored, not rejected, and an error under it appears in `health`'s recent errors.
- [ ] **Heartbeat state** (tests): `none` before any run; `ok` after a run; `stale` once the clock
      is more than 26 h past the last run's `receivedAt`.

## Known Constraints
- Verify Web Crypto HMAC in Convex actions and HTTP actions, and how `convex-test` calls HTTP
  actions ([architecture.md §16](../architecture.md#16-open-verification-items)).
- `convex-test` is not a real backend, so the concurrency tests here only show that the logic is
  correct. The real proof is `smoke:idempotency` in block 009.
- `N8N_LOAN_EVENTS_URL` gets its real value in block 007. Until then, deliveries fail at once
  with `CONFIG`, are visible as dead letters, and can be re-sent with "Retry all".
