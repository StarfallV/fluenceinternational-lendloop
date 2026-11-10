# 004 — Borrowing, loans and the clock

**Status:** Planned
**Module:** LOAN
**Branch:** feature/004-borrowing-and-loans

## Goal
Implement the whole loan lifecycle (request, approve, decline, cancel, expire, return), with every
rule enforced inside Convex transactions, plus the borrower and lender views. Introduce the shared
clock, so availability and overdue state update live when the date changes.

## Dependencies
- Depends on: 003
- Depended on by: 005

## Requirements
PUB-2 (exclusion of tools on loan), LST-3 (finished), LST-4 and LST-5 (availability and pending
counts), BRW-1 – BRW-7, SEC-2 (loans), SEC-6 (one open request, rate limit), BR-4 – BR-13, BR-15,
BR-16, UX-3.

## Inputs
- [architecture.md §4 `loans` and `clock`, §5.1, §6](../architecture.md#6-loan-lifecycle-availability-and-time),
  [prd.md §5.2–5.3](../prd.md#52-requests-and-loans),
  [ADR-008](../adr/ADR-008-calendar-dates-in-one-app-timezone.md).

## Outputs
- **Data, dates and clock:**
  - `loans` table and indexes; `remindersSent` starts at 0.
  - `clock` table, and an hourly cron in `convex/clock.ts` that writes `today` and `now`.
  - `convex/lib/dates.ts`, tested:
    - `todayIn(tz)`, `addDays`, inclusive length, range overlap;
    - `readClock(ctx)` for queries, which computes the time itself if the clock row is missing.
  - `config:get` in `convex/config.ts` (`publicQuery` with `returns`): timezone, today, and the
    date limits for the UI.
- **Functions in `convex/loans.ts`:**
  - Mutations: `request`, `approve`, `decline`, `cancel`, `markReturned` (`userMutation`).
  - Queries: `myRequests`, `incoming` (pending first), `pendingCount` (`userQuery`).
- **Logic:**
  - `convex/model/loans.ts`: a single `transition()` helper that applies guarded state changes.
    Block 006 adds event emission to it, in that one place.
  - Overlap checks; the auto-decline on approval (BR-8); the contact reveal (BR-16).
  - `convex/model/availability.ts`: real availability (BR-12).
- **Availability in the tools queries:**
  - `listPublic` leaves out tools that are on loan.
  - `list` returns each card's availability ("On loan until …", "Booked from …").
  - `mine` returns each tool's availability and its pending-request count (LST-5).
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
  - `/listings`: each tool's status and pending count.
  - A navigation badge with the pending count.

## Acceptance Criteria
- [ ] **Request validation** (tests):
  - own tool → `FORBIDDEN`;
  - deleted or removed tool → `NOT_FOUND`;
  - start yesterday → `VALIDATION`; start today → accepted;
  - start today + 90 → accepted; start today + 91 → `VALIDATION`;
  - end before start → `VALIDATION`; end = start (a 1-day loan) → accepted;
  - a 30-day range → accepted; a 31-day range → `VALIDATION`.
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
      `CONFLICT`. A caller who isn't a party to the loan gets `NOT_FOUND` from every loan
      function.
- [ ] The expiry cron expires pending requests whose start date has passed and leaves the rest
      alone (test).
- [ ] **Availability** (tests):
  - On loan once an approved loan starts;
  - overdue derived once the end date is before today;
  - Available after the return;
  - "Booked from" shows the next future approved loan.
- [ ] **Public page** (test): a tool leaves `listPublic` when an approved loan starts, comes back
      after it is returned, and the key set stays exactly `{_id, name, category}`.
- [ ] `tools:list` returns each card's availability, and `tools:mine` returns availability plus
      the pending-request count (tests). The browse badges and the My listings counts are checked
      by hand (recorded).
- [ ] `incoming` lists pending requests first. `pendingCount` returns the number of pending
      requests on the caller's tools, and 0 for someone else's (tests).
- [ ] Deleting a listing that is on loan → `CONFLICT`. Otherwise its pending requests and future
      approved loans are cancelled with `listing_deleted` (tests).
- [ ] The counterparty's email is present only on `approved` loans, in both views (test on result
      shapes).
- [ ] The 11th borrow request within an hour fails with `RATE_LIMITED` (test).
- [ ] **Clock** (tests): with a fake clock at 23:30 UTC, `todayIn` gives the right calendar date
      for zones ahead of and behind UTC. A query that reads the clock re-runs when the hourly tick
      changes `today`.
- [ ] My requests and Incoming update live when the other party acts (manual check in two browser
      profiles, recorded).

## Known Constraints
- Verify `Intl.DateTimeFormat` with `timeZone` in the Convex runtime. Record the fallback if it is
  unsupported ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Loan events are not emitted yet. Block 006 adds them through `transition()`.
- Mark TD-005 resolved once the clock ships.
