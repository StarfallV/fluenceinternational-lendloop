# 009 — Overdue reminders workflow

**Status:** Planned
**Module:** AUTO
**Branch:** feature/009-overdue-reminders

## Goal
Deliver AUT-2: an n8n workflow that runs hourly in the daytime, claims overdue loans, reminds each
borrower at most once a day, writes every result back idempotently, and reports a heartbeat every
run. Neither a silent n8n nor an interrupted run goes unnoticed, and an interrupted run delays a
reminder without dropping it.

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
- **`n8n/workflows/overdue-reminders.json`** (stable ID; execution timeout 10 minutes, shorter
  than the 20-minute claim lease; the error workflow is the handler). Triggers:
  - a Schedule Trigger, every hour on the hour from 09:00 to 20:00 in `APP_TIMEZONE`
    (`0 9-20 * * *`);
  - a signed webhook `POST /webhook/lendloop/run-reminders`, verified like loan events;
  - an n8n Trigger on "instance started", to catch up after downtime.

  Steps:
  1. Mint a `runId`.
  2. Sign and `POST /n8n/overdue-loans { runId }`, with retries. Retrying is safe, because the same
     `runId` gets the same claims back.
  3. **If the list is empty**, post the run summary with zero counts.
  4. Otherwise, loop over the loans:
     - email the borrower (Retry On Fail 3 times; errors go to the error output);
     - sign and `POST /n8n/reminders` with the `runId` and `sent`, or `failed` plus an error code
       and a redacted message (retries). A write-back that still fails fails the run, so the error
       workflow fires and the remaining claims are taken over within the hour.
  5. Aggregate, then sign and `POST /n8n/runs` with the counts, including `reclaimed` (heartbeat).
- **Signing:** one reusable signing step, shared by every call to Convex. Use a sub-workflow if
  n8n 2.47 supports it cleanly; otherwise a single documented Code-node snippet. A sub-workflow is
  handled like every other workflow in `n8n/workflows/`: a committed ID, published by setup,
  linked to the error handler, and checked by `check:workflows`.
- **`scripts/smoke-reminders.ts`** (`npm run smoke:reminders`):
  1. Makes a loan overdue with `dev:makeLoanOverdue`.
  2. Triggers a run through the signed webhook.
  3. **Waits** for that run's record, then checks the loan: one reminder email for it in Mailpit,
     and one `sent` record for today.
  4. Triggers again, waits for the second run's record, and checks there is no new email and no
     new reminder record for the loan.

  The checks look at the loan rather than at one run, so a scheduled run that happens to overlap
  doesn't break them.
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
- [ ] **With nothing to remind**, a run still posts a summary with zero counts (recorded run).
- [ ] **With Mailpit stopped:**
  - each reminder is written back as `failed`, with a redacted message;
  - the run summary counts the failures;
  - the batch completes.

  With Mailpit back, the next run claims them again and sends each one once, without duplicates
  (manual check, recorded).
- [ ] **Interrupted run:** with three overdue loans and Mailpit paused, start a run, then restart
      the n8n container while it is sending.
  - The catch-up run on restart skips the still-live claims.
  - After the lease expires, unpause Mailpit and start a run with the signed webhook. The run that
    takes the claims over (that one, or a scheduled run that got there first) counts
    `reclaimed` = 3 in its summary.
  - Each borrower gets exactly one reminder that day.

  (Manual check, recorded.)
- [ ] **Reminder cap:** a loan with 7 reminders sent is no longer claimed (block 006 tests, plus
      one recorded run on a seeded loan).
- [ ] The exported workflow has the hourly schedule and a 10-minute execution timeout (checked in
      the JSON, recorded).
- [ ] The exported JSON passes `check:workflows`, and export → import → export is byte-identical.

## Known Constraints
- Verify on n8n 2.47 ([architecture.md §16](../architecture.md#16-open-verification-items)):
  - the n8n Trigger's "instance started" event;
  - the execution timeout on scheduled and webhook-started runs, including a run waiting in Send
    Email;
  - whether a timed-out run triggers the error workflow. If it doesn't, the abandoned claims in
    health still show it.
- Duplicate emails remain possible only in the cases listed in TD-006.

**Release:** `v0.3.0`, tagged when this block merges into `main`.
