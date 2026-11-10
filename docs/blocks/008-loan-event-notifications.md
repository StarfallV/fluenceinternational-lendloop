# 008 — Loan event notifications workflow

**Status:** Planned
**Module:** AUTO
**Branch:** feature/008-loan-event-notifications

## Goal
Deliver AUT-1 end to end. n8n verifies Convex's signed loan events and turns them into plain-text
emails to the right person. The error-handler workflow catches failures and records them in
Convex.

## Dependencies
- Depends on: 006, 007
- Depended on by: 009

## Requirements
AUT-1, SEC-3 (n8n verification), SEC-4, SEC-5, REL-2, BR-19, BR-21, DEL-2.

## Inputs
- [architecture.md §7, §9, §11](../architecture.md#11-n8n-workflows),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-006](../adr/ADR-006-failure-visibility.md),
  [ADR-007](../adr/ADR-007-email-via-smtp-mailpit-locally.md).

## Outputs
- **`n8n/workflows/loan-event-notifications.json`:**
  1. Webhook (raw body).
  2. Verify signature (Code node: ±300 s window, constant-time comparison). If it fails, respond
     `401`.
  3. Switch on `type`.
  4. Plain-text subject and body for every event type and reason.
  5. Send the email (SMTP credential; Retry On Fail 3 times, 5 s apart).
  6. Respond `200`.

  The workflow's settings name the error handler as its error workflow.
- **`n8n/workflows/error-handler.json`:**
  1. Error Trigger.
  2. Sign and `POST /n8n/errors`, with retries. This runs first, so the failure is recorded even
     when SMTP is down.
  3. Alert email to `ADMIN_ALERT_EMAIL` (workflow, node, message, execution link; never payload
     data).
- **`scripts/smoke-notifications.ts`** (`npm run smoke:notifications`):
  - sends a signed synthetic event through the tunnel and checks Mailpit's API for the email;
  - checks that a bad signature, a stale timestamp and a wrong path each get `401` and produce no
    email.
- **Runbook:** a table of email subjects per event in `docs/runbooks/local-setup.md`.

## Acceptance Criteria
- [ ] In the app, request → approve → return produces Mailpit emails to the lender (request) and
      the borrower (approve, return). Each loan shows "notification sent" activity (manual check
      with timestamps, recorded).
- [ ] `smoke:notifications` passes: the valid event arrives exactly once, and the three invalid
      requests each get `401` with no email.
- [ ] **With Mailpit stopped:**
  - the webhook returns `5xx`;
  - Convex keeps the event pending and retries it per the schedule;
  - the error handler records the failure in Convex (visible in admin health data).

  After Mailpit restarts, the next retry sends exactly one email (manual check, recorded).
- [ ] The block 006 test vector verifies inside the n8n Code node (recorded).
- [ ] Emails are plain text and contain only the BR-21 fields (Mailpit message source checked and
      recorded).
- [ ] The exported JSON passes `check:workflows`: secrets appear only as `$env` references, and
      there is no pinned data.

## Known Constraints
- Verify the status code n8n returns when a workflow fails before its Respond node
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
