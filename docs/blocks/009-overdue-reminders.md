# 009 — Overdue reminders workflow

**Status:** Planned
**Module:** AUTO
**Branch:** feature/009-overdue-reminders

## Goal
Deliver AUT-2: a daily n8n workflow that claims overdue loans, reminds each borrower once a day,
writes every result back idempotently, and reports a heartbeat every run, so a silent n8n is
noticed.

## Dependencies
- Depends on: 008
- Depended on by: 010

## Requirements
AUT-2, REL-1, REL-2 (heartbeat), BR-20, BR-21, SEC-3, SEC-5, DEL-2.

## Inputs
- [architecture.md §8, §10, §11](../architecture.md#8-n8n--convex-http-endpoints),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **`n8n/workflows/overdue-reminders.json`** (stable ID; the error workflow is the handler).
  Triggers:
  - a Schedule Trigger, daily at 09:00 in `APP_TIMEZONE`;
  - a signed webhook `POST /webhook/lendloop/run-reminders`, verified like loan events;
  - an n8n Trigger on "instance started", to catch up after downtime.

  Steps:
  1. Mint a `runId`.
  2. Sign and `POST /n8n/overdue-loans { runId }` (retries).
  3. **If the list is empty**, post the run summary with zero counts.
  4. Otherwise, loop over the loans:
     - email the borrower (Retry On Fail 3 times; errors go to the error output);
     - sign and `POST /n8n/reminders` with `sent`, or with `failed` plus an error code and a
       redacted message (retries).
  5. Aggregate, then sign and `POST /n8n/runs` (heartbeat).
- **Signing:** one reusable signing step, shared by every call to Convex. Use a sub-workflow if
  n8n 2.47 supports it cleanly; otherwise a single documented Code-node snippet.
- **`scripts/smoke-reminders.ts`** (`npm run smoke:reminders`):
  1. Makes a loan overdue with `dev:makeLoanOverdue`.
  2. Triggers a run through the signed webhook.
  3. **Waits** for that run's record, then checks there is one email, one `sent` reminder and one
     run record.
  4. Triggers again, and checks there is no new email and no new reminder, only a second run
     record.
- **`scripts/smoke-idempotency.ts`** (`npm run smoke:idempotency`): sends 10 concurrent, identical,
  signed write-backs to the dev deployment and checks that exactly one record results. It does
  this for `/n8n/reminders` and for `/n8n/runs`.

## Acceptance Criteria
- [ ] An overdue loan gets one reminder email to the borrower, containing only the BR-21 reminder
      fields. A `reminder:<loanId>:<date>` row with status `sent` exists in `automationEvents`
      (Convex dashboard, recorded).
- [ ] `smoke:reminders` passes: a second run on the same day sends nothing and creates no
      duplicate reminder records.
- [ ] `smoke:idempotency` passes against the dev deployment.
- [ ] **With no overdue loans**, a run still posts a summary with zero counts (recorded run).
- [ ] **With Mailpit stopped:**
  - each reminder is written back as `failed`, with a redacted message;
  - the run summary counts the failures;
  - the batch completes.

  With Mailpit back, a re-run upgrades them to `sent`, without duplicates (manual check,
  recorded).
- [ ] **Reminder cap:** a loan with 7 reminders sent is no longer claimed (block 006 tests, plus
      one recorded run on a seeded loan).
- [ ] Restarting the n8n container triggers the catch-up run, which reminds nobody twice
      (recorded).
- [ ] The exported JSON passes `check:workflows`, and export → import → export is byte-identical.

## Known Constraints
- Verify the n8n Trigger's "instance started" event on 2.47
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Duplicate emails remain possible only in the cases listed in TD-006.

**Release:** `v0.3.0`, tagged when this block merges into `main`.
