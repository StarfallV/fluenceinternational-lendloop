# 010 — Automation activity and health UI

**Status:** Planned
**Module:** WEB
**Branch:** feature/010-automation-activity-and-health

## Goal
Show automation where people need it: activity on each loan for its parties (the bonus), and an
Automation health panel for admins with retries, stale-run and abandoned-claim warnings, and
rejection counts.

## Dependencies
- Depends on: 009
- Depended on by: 011

## Requirements
AUT-3, ADM-4, REL-2 (visibility), SEC-5 (no emails or raw errors for parties), UX-3.

## Inputs
- `automation:activityForLoan` and `automation:health` from block 006.
- [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **Loan activity:** loan cards in My requests, Incoming and the admin Loans tab show an activity
  list, for example "Lender notified · 3 min ago", "Overdue reminder sent · 2 days ago",
  "Reminder failed".
  - Parties see statuses only; admins also see the redacted error detail.
  - Relative times update live.
- **Admin Automation tab:**
  - delivery counts by status;
  - a dead-letter table (event type, tool, attempts, last error code, time) with **Retry** and
    **Retry all**;
  - recent workflow errors, under any workflow slug;
  - today's rejected integration calls per reason (a capped count shows as "100+"), with the last
    reason and a hint about clock drift;
  - the last reminder run (time and counts, including `reclaimed`), with three states: **ok**,
    **stale**, **no run yet**;
  - abandoned reminder claims, with a note that the next hourly run retries them;
  - a "tunnel stale" hint when the latest failures are `TUNNEL_STALE`;
  - a navigation badge when something needs action: dead letters, errors in the last 24 h,
    abandoned reminder claims, or a stale heartbeat. Rejected calls show on the panel but don't
    raise the badge.

## Acceptance Criteria
- [ ] A loan's activity is visible only to its borrower, its lender and admins. Anyone else gets
      `NOT_FOUND` (test).
- [ ] Activity returned to parties contains no error messages and no email addresses. Activity for
      admins contains only redacted messages (tests on the result shapes).
- [ ] Retry and Retry all move dead letters back to pending, and they are delivered once n8n is
      reachable (manual check, recorded).
- [ ] Dead letters, recent errors, abandoned claims and a stale heartbeat each raise the admin
      badge, and clearing them removes it. Rejections appear on the panel without raising it.
      "No run yet" shows on a fresh setup (manual check, plus the block 006 query tests).
- [ ] Relative times update without a reload, and the stale flag appears on an open page when the
      clock ticks past 26 h (manual check with a test clock, recorded).

## Known Constraints
None. The data and the rules come from block 006.
