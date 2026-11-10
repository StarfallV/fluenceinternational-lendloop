# 010 — Automation activity and health UI

**Status:** Planned
**Module:** WEB
**Branch:** feature/010-automation-activity-and-health

## Goal
Show automation where people need it: activity on each loan for its parties (the bonus), and an
Automation health panel for admins with retry and stale-run warnings.

## Dependencies
- Depends on: 009
- Depended on by: 011

## Requirements
AUT-3, ADM-4, REL-2 (visibility), UX-3.

## Inputs
- `automation:activityForLoan` and `automation:health` from block 006.
- [ADR-006](../adr/ADR-006-failure-visibility.md).

## Outputs
- **Loan activity:** loan cards in My requests, Incoming and the admin Loans tab show an activity
  list, for example "Lender notified · 3 min ago", "Overdue reminder sent · 2 days ago",
  "Reminder failed". Relative times update live, and no email address is shown.
- **Admin Automation tab:**
  - delivery counts by status;
  - a dead-letter table (event type, tool, attempts, last error code, time) with Retry;
  - recent workflow errors;
  - the last reminder run (time and counts), with a stale warning;
  - a navigation badge when something needs attention (dead letters, errors in the last 24 h, a
    stale heartbeat).

## Acceptance Criteria
- [ ] A loan's activity is visible only to its borrower, its lender and admins. Anyone else gets
      `FORBIDDEN` or `NOT_FOUND` (test).
- [ ] Activity results contain no email addresses (test on the result shape).
- [ ] Retry from the UI moves a dead letter back to pending, and it is delivered once n8n is
      reachable (manual check, recorded).
- [ ] Dead letters and a stale heartbeat raise the admin badge, and clearing them removes it
      (manual check, plus the block 006 query tests).
- [ ] Relative times update without a reload (manual check).
