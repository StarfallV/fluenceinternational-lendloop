# 009 — Overdue reminders workflow

**Status:** Planned
**Module:** AUTO
**Branch:** feature/009-overdue-reminders

## Goal
Deliver AUT-2: an n8n workflow that runs hourly in the daytime, claims overdue loans, reminds each
borrower at most once a day, writes every result back idempotently, and reports a heartbeat every
run. Neither a silent n8n nor an interrupted run goes unnoticed. An interrupted run delays a
reminder without dropping it, and one failing send affects only its own loan.

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
- **`n8n/workflows/overdue-reminders.json`**: stable ID; the error workflow is the handler; an
  execution timeout of 10 minutes, as a backstop under the 30-minute claim lease.
  Triggers:
  - a Schedule Trigger, every hour on the hour from 09:00 to 20:00 (`0 9-20 * * *`), in n8n's
    timezone, which setup sets to `APP_TIMEZONE` (block 007);
  - a signed webhook `POST /webhook/lendloop/run-reminders`, verified like loan events.

  Steps (architecture.md §11):
  1. Mint a `runId` and note the start time.
  2. Sign and `POST /n8n/overdue-loans { runId }`, with retries. Retrying is safe, because the same
     `runId` gets the same claims back.
  3. **If the list is empty**, post the run summary with zero counts.
  4. Otherwise, handle the loans **one at a time** (Loop Over Items, batch size 1):
     - once 8 minutes have passed since the start, skip the loan without sending;
     - email the borrower, with **no Retry On Fail**; errors go to the error output;
     - sign and `POST /n8n/reminders` straight away, with the `runId` and `sent`, or `failed` plus
       an error code and a redacted message. This call has a 30 s timeout and retries. If it still
       fails, the run fails, so the error workflow fires.
  5. Aggregate, then sign and `POST /n8n/runs` with the counts, including `reclaimed` (heartbeat).
- **Signing:** one documented Code-node snippet, the same in every node that signs a call to
  Convex. A sub-workflow would add a fourth workflow to publish and link, for no gain here.
- **`scripts/smoke-reminders.ts`** (`npm run smoke:reminders`):
  1. Creates a fresh overdue loan with `dev:createOverdueLoan`.
  2. Triggers a run through the signed webhook.
  3. **Waits** for that run's record, then checks the loan: one reminder email for it in Mailpit,
     and one `sent` record for today.
  4. Triggers again, waits for the second run's record, and checks there is no new email and no
     new reminder record for the loan.

  The checks look at the loan rather than at one run, so a scheduled run that happens to overlap
  doesn't break them. Every run uses a new loan, so the script can be re-run on the same day.
- **`scripts/smoke-idempotency.ts`** (`npm run smoke:idempotency`), against the dev deployment:
  - with 5 fresh overdue loans, 10 concurrent signed claim calls with distinct `runId`s: each loan
    is returned to exactly one caller;
  - 10 concurrent, identical, signed `sent` write-backs: one `sent` record, and `remindersSent`
    goes up by exactly one;
  - 10 concurrent, identical, signed run summaries: one `run:<runId>` record.

## Acceptance Criteria
- [ ] An overdue loan gets one reminder email to the borrower, containing only the BR-21 reminder
      fields. A `reminder:<loanId>:<date>` row with status `sent` exists in `automationEvents`
      (Convex dashboard, recorded).
- [ ] `smoke:reminders` passes, twice in a row on the same day: each time, a second run sends
      nothing and creates no duplicate reminder record.
- [ ] `smoke:idempotency` passes against the dev deployment.
- [ ] **With nothing to remind**, a run still posts a summary with zero counts (recorded run).
- [ ] **One failure stays contained:** with three overdue loans and Mailpit set to reject the
      borrower of the loan claimed first (its allowed-recipients option), that loan is written
      back `failed`, and each of the other two borrowers gets exactly one email (manual check,
      recorded).
- [ ] **With Mailpit stopped:** each reminder is written back as `failed` with a redacted message,
      the run summary counts the failures, and the run completes. With Mailpit back, the next run
      claims them again and sends each one once (manual check, recorded).
- [ ] **Out of time:** with Mailpit paused and 20 overdue loans, the run stops sending after
      8 minutes, skips the rest, and still posts its summary. Once their lease expires, health
      shows the skipped claims as abandoned, and the next run takes them over (manual check,
      recorded).
- [ ] **Interrupted run:** with three overdue loans and Mailpit paused, start a run, then restart
      the n8n container while it is sending.
  - Within 5 minutes of the lease expiring, health shows the three claims as abandoned.
  - Unpause Mailpit and start a run with the signed webhook. The run that takes the claims over
    (that one, or a scheduled run that got there first) counts `reclaimed` = 3.
  - Each borrower gets exactly one reminder that day.

  (Manual check, recorded.)
- [ ] **Reminder cap:** a loan with 7 reminders sent is no longer claimed (block 006 tests, plus
      one recorded run on a seeded loan).
- [ ] The exported workflow has the hourly schedule, a 10-minute execution timeout, Loop Over Items
      with batch size 1, and no Retry On Fail on the email step (checked in the JSON, recorded).
- [ ] The exported JSON passes `check:workflows`, and export → import → export is byte-identical.

## Known Constraints
- Verify on n8n 2.47 ([architecture.md §16](../architecture.md#16-open-verification-items)):
  - Loop Over Items with batch size 1, and the elapsed-time check;
  - the execution timeout as a backstop (n8n applies it after the current node finishes), and
    whether a timed-out run triggers the error workflow. If it doesn't, the abandoned claims in
    health still show the run.
- Mailpit's allowed-recipients option, for the containment check, in the pinned version.
- Duplicate emails remain possible only in the cases listed in TD-006.
