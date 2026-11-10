# 004 — Borrowing and loans

**Status:** Planned
**Module:** LOAN
**Branch:** feature/004-borrowing-and-loans

## Goal
Implement the whole loan lifecycle (request, approve, decline, cancel, expire, return), with every
rule enforced inside Convex transactions, plus the borrower and lender views.

## Dependencies
- Depends on: 003
- Depended on by: 005, 006

## Requirements
BRW-1 – BRW-7, LST-3 (finished), SEC-2 (loans), SEC-6 (one open request, rate limit),
BR-4 – BR-13, BR-15, BR-16, UX-3.

## Inputs
- [architecture.md §4 `loans`, §6](../architecture.md#6-loan-lifecycle),
  [prd.md §5.2–5.3](../prd.md#52-requests-and-loans),
  [ADR-008](../adr/ADR-008-calendar-dates-in-one-app-timezone.md).

## Outputs
- **Data and dates:**
  - `loans` table and indexes.
  - `convex/lib/dates.ts`: `todayIn(tz)`, `addDays`, inclusive length, range overlap. Tested.
  - `config:get` (`publicQuery` with `returns`): timezone, today, and the date limits for the UI.
- **Functions in `convex/loans.ts`:**
  - Mutations: `request`, `approve`, `decline`, `cancel`, `markReturned` (`userMutation`).
  - Queries: `myRequests`, `incoming`, `pendingCount` (`userQuery`).
- **Logic:**
  - `convex/model/loans.ts`: a single `transition()` helper that applies guarded state changes.
    Block 006 adds event emission to it, in that one place.
  - Overlap checks; the auto-decline on approval (BR-8); the contact reveal (BR-16).
  - `convex/model/availability.ts`: real availability (BR-12), with "Booked from" and overdue
    shown in owner views.
- **Listing deletion (BR-13):** blocked while the tool is on loan. Otherwise pending requests and
  future approved loans are cancelled with the reason `listing_deleted`.
- **Expiry:** an hourly cron, `expirePendingRequests` (BR-15).
- **Rate limit:** 10 borrow requests per hour per user.
- **UI:**
  - Request dialog on tool cards: a date-range picker limited by `config:get`, showing booked
    ranges, with an optional note.
  - `/requests` (borrower): status badges, cancel, and the counterparty's email once approved.
  - `/incoming` (lender): pending first, with approve and decline; active loans with mark
    returned; overdue highlighted; the borrower's note.
  - A navigation badge with the pending count.

## Acceptance Criteria
- [ ] **Request validation** (tests):
  - own tool → `FORBIDDEN`;
  - deleted or removed tool → `NOT_FOUND`;
  - start before today, start more than 90 days out, end before start, or a 31-day range →
    `VALIDATION`;
  - a 30-day range is accepted.
- [ ] A second open request by the same borrower for the same tool → `CONFLICT` (test).
- [ ] A request overlapping an approved loan → `CONFLICT`. Overlapping only pending requests is
      allowed (tests).
- [ ] **Approve** (tests):
  - only the lender, only from `pending`, only while the start date is today or later;
  - a second overlapping approval fails with `CONFLICT`;
  - overlapping pending requests are auto-declined with `dates_taken`.
- [ ] **Decline** is only for the lender, only from `pending`. **Cancel** follows BR-10 for each
      party and state (tests).
- [ ] **Mark returned** is only for the lender, only for approved loans that have started. It sets
      `returnedAt`, and the tool becomes Available (tests).
- [ ] A table-driven test tries every transition from every disallowed state and expects
      `CONFLICT`, and every non-party caller and expects `FORBIDDEN` or `NOT_FOUND`.
- [ ] The expiry cron expires pending requests whose start date has passed and leaves the rest
      alone (test).
- [ ] **Availability** (tests):
  - On loan once an approved loan starts;
  - overdue derived once the end date is before today;
  - Available after the return;
  - "Booked from" shows the next future approved loan.
- [ ] Deleting a listing that is on loan → `CONFLICT`. Otherwise its pending requests and future
      approved loans are cancelled with `listing_deleted` (tests).
- [ ] The counterparty's email is present only on `approved` loans, in both views (test on result
      shapes).
- [ ] The 11th borrow request within an hour fails with `RATE_LIMITED` (test).
- [ ] "Today" follows `APP_TIMEZONE`. A fake clock at 23:30 UTC with zones ahead of and behind UTC
      gives the right calendar date (test).
- [ ] My requests and Incoming update live when the other party acts (manual check in two
      browsers, recorded).

## Known Constraints
- Verify `Intl.DateTimeFormat` with `timeZone` in the Convex runtime. Record the fallback if it is
  unsupported ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Loan events are not emitted yet. Block 006 adds them through `transition()`.
