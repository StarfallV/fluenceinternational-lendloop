# 008 — Loan event notifications and error handler

**Status:** Planned
**Module:** AUTO
**Branch:** feature/008-loan-event-notifications

## Goal
Deliver AUT-1 end to end. n8n verifies Convex's signed loan events and turns them into plain-text
emails to the right person. The error-handler workflow records every workflow failure in Convex
and alerts the admin, and it is proven to be live after a fresh import.

## Dependencies
- Depends on: 006, 007
- Depended on by: 009

## Requirements
AUT-1, SEC-3 (n8n verification), SEC-4, SEC-5, REL-2, BR-19, BR-21, DEL-2.

## Inputs
- [architecture.md §7, §9, §11](../architecture.md#11-n8n-workflows),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md),
  [ADR-007](../adr/ADR-007-email-via-smtp-mailpit-locally.md).

## Outputs
- **`n8n/workflows/loan-event-notifications.json`** (stable ID; execution timeout 20 s):
  1. Webhook (raw body).
  2. Verify signature (Code node: newline canonical string, ±300 s window, constant-time
     comparison). If it fails, respond `401`.
  3. Switch on `type`, with a fallback branch for an unknown type: respond `422`, then stop with
     an error so the error workflow records it.
  4. Plain-text subject and body for every event type and reason, using only the BR-21 fields.
  5. Send the email over SMTP, with **no Retry On Fail**.
  6. Respond `200` with the positive acknowledgement `{"delivered":"<eventId>"}`
     (architecture.md §7.3).

  The workflow's settings name the error handler as its error workflow.
- **`n8n/workflows/error-handler.json`** (stable ID):
  1. Error Trigger.
  2. Mint an `errorId`, then build the error fields: workflow slug, node, error code, and a
     redacted, truncated message. Never the payload.
  3. Sign and `POST /n8n/errors`, with retries and "On Error: Continue".
  4. **Always** send the alert email to `ADMIN_ALERT_EMAIL`.
- **`scripts/smoke-notifications.ts`** (`npm run smoke:notifications`):
  - sends a signed synthetic event through the tunnel, checks that the answer is exactly the
    positive acknowledgement, and checks Mailpit's API for the email;
  - checks that a bad signature, a stale timestamp, and a request signed for a different path
    (sent to the loan-events URL) each get `401` and produce no email;
  - sends a signed event with an unknown `type` and checks for `422` and no email.
- **Runbook:** a table of email subjects per event in `docs/runbooks/local-setup.md`, and the note
  that runs started from the editor don't trigger the error workflow.

## Acceptance Criteria
- [ ] In the app, request → approve → return produces Mailpit emails to the lender (request) and
      the borrower (approve, return). Each event has a `notification:<eventId>` row with status
      `sent` in `automationEvents` (checked in the Convex dashboard, recorded with timestamps).
- [ ] `smoke:notifications` passes: the valid event is acknowledged with exactly
      `{"delivered":"<eventId>"}` and arrives exactly once; the three invalid requests each get
      `401` with no email; the unknown type gets `422` with no email.
- [ ] The unknown-type execution triggers the error handler, and a `/n8n/errors` record appears in
      Convex (manual check, recorded).
- [ ] **With Mailpit stopped:**
  - the webhook returns an error status;
  - Convex keeps the event `pending` and retries it per the schedule;
  - the error handler creates a `/n8n/errors` record in Convex.

  After Mailpit restarts, the next retry sends exactly one email (manual check, recorded).
- [ ] **With Mailpit paused** (`docker compose pause mailpit`, a hanging SMTP connection): the
      workflow ends within its 20 s timeout, and Convex records a retryable error status, not its
      own 30 s timeout. Checked from `lastStatusCode`/`lastErrorCode` (manual check, recorded).
- [ ] **Fresh import:** after recreating the n8n volume and running `npm run setup`, a forced
      failure in the notification workflow triggers the error handler. A `/n8n/errors` record
      appears in Convex, and an alert email in Mailpit (manual check, recorded).
- [ ] With Convex unreachable from n8n (for example a wrong `CONVEX_SITE_URL`), the alert email is
      still sent (manual check, recorded).
- [ ] The block 006 test vector verifies inside the n8n Code node (recorded).
- [ ] Emails are plain text and contain only the BR-21 fields (Mailpit message source checked and
      recorded).
- [ ] The exported JSON passes `check:workflows`: secrets appear only as `$env` references, there
      is no pinned data, and the error-workflow link is present. Export → import → export of the
      real workflows is byte-identical.

## Known Constraints
Verify on n8n 2.47 ([architecture.md §16](../architecture.md#16-open-verification-items)):
- how to read the raw webhook body now that in-memory binary mode is gone;
- the workflow execution timeout on webhook executions;
- the status code returned when a workflow fails or times out before its Respond node. Only the
  positive acknowledgement counts as delivered, so this decides the error class, not correctness.
