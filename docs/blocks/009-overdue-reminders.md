# 009 — Overdue reminders workflow

**Status:** Planned
**Module:** AUTO
**Branch:** feature/009-overdue-reminders

## Goal
Deliver AUT-2: a daily n8n workflow that reminds borrowers about overdue loans, writes each
result back idempotently, and reports a heartbeat so a silent n8n is noticed.

## Dependencies
- Depends on: 008
- Depended on by: 010

## Requirements
AUT-2, REL-1, REL-2 (heartbeat), BR-20, SEC-3, DEL-2.

## Inputs
- [architecture.md §8, §10, §11](../architecture.md#8-n8n--convex-http-endpoints),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **`n8n/workflows/overdue-reminders.json`:**
  1. Schedule Trigger (daily at 09:00 in `APP_TIMEZONE`) plus a Manual Trigger.
  2. Sign and `POST /n8n/overdue-loans` (retries).
  3. Loop over the loans:
     - email the borrower (retries; errors go to the error output);
     - sign and `POST /n8n/reminders` with `sent` or `failed` (retries).
  4. Aggregate, then sign and `POST /n8n/runs` (heartbeat).

  The error workflow is the error handler.
- **Signing:** one reusable signing step, shared by every call to Convex. Use a sub-workflow if
  n8n 2.47 supports it cleanly; otherwise a single documented Code-node snippet.
- **`scripts/smoke-reminders.ts`** (`npm run smoke:reminders`):
  1. Makes a loan overdue with `dev:makeLoanOverdue`, then triggers the workflow.
  2. Checks there is one email, one `sent` reminder and one run record.
  3. Triggers the workflow again, and checks there is no new email and no new reminder record,
     only a second run record.

## Acceptance Criteria
- [ ] An overdue loan gets one reminder email to the borrower, and the loan shows "Overdue
      reminder sent" activity (manual check, recorded).
- [ ] `smoke:reminders` passes: a second run on the same day sends nothing and creates no duplicate
      reminder records.
- [ ] **With Mailpit stopped:**
  - each reminder is written back as `failed`;
  - the run summary counts the failures;
  - the batch completes.

  With Mailpit back, a re-run upgrades them to `sent`, without duplicates (manual check,
  recorded).
- [ ] Every run posts a summary, even when every reminder fails (shown by the check above).
- [ ] The exported JSON passes `check:workflows`.

## Known Constraints
- How to trigger a run from a script (n8n CLI or API) is decided in this block. If it needs an API
  key, that key is handled like any other secret (security.md §5).

**Release:** `v0.3.0` when this block closes.
