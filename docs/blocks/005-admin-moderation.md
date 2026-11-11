# 005 — Admin moderation

**Status:** Planned
**Module:** AUTH
**Branch:** feature/005-admin-moderation

## Goal
Give admins the moderation powers in the brief (remove any listing, view all loans, mark Trusted
Lenders), enforced in Convex and recorded in the audit log.

## Dependencies
- Depends on: 004
- Depended on by: 006

## Requirements
ADM-1 – ADM-3, BR-14, BR-17, BR-20 (long-overdue flag), SEC-1, SEC-5 (no emails on admin screens).

## Inputs
- [architecture.md §5.3 permission matrix](../architecture.md#53-permission-matrix),
  [prd.md §3.4](../prd.md#34-administration).

## Outputs
- **Functions in `convex/admin.ts`** (all `adminQuery`/`adminMutation`):
  - `removeListing({ toolId, reason? })` (BR-14);
  - `listLoans({ status?, paginationOpts })`, with a `longOverdue` flag per loan (overdue, with 7
    reminders sent);
  - `listUsers({ paginationOpts })`: display name, Trusted flag, join date and listing count. No
    emails.
  - `setTrustedLender({ userId, trusted })`;
  - `recentAudit()`.
- **Removal (BR-14):** pending requests and future approved loans are cancelled with
  `listing_removed`. A loan already in progress stays, so it can still be returned. Each removal
  writes an audit entry.
- **UI:** `/admin` with tabs for Loans (status filter, paginated, long-overdue flag), Listings
  (remove with a reason), Users (Trusted toggle) and Audit. The admin link shows only for admins;
  the server enforces it either way.

## Acceptance Criteria
- [ ] A table-driven test calls every admin function as a `user` (expects `FORBIDDEN`) and signed
      out (expects `UNAUTHENTICATED`).
- [ ] `removeListing` (test):
  - sets `status: "removed"`, `removedBy`, `removedAt` and `removedReason`;
  - cancels pending requests and future approved loans with `listing_removed`;
  - leaves loans in progress untouched;
  - writes an audit row.
- [ ] `setTrustedLender` toggles the flag and writes a `user.trusted` or `user.untrusted` audit row
      (test). The badge appears on that user's listings in browse (manual check).
- [ ] `listLoans`:
  - returns loans across all users, with display names, tool names, dates and status, and no
    email addresses (test on the result shape);
  - with a `status` filter, returns only loans in that status (test);
  - marks `longOverdue` exactly for overdue loans with 7 reminders sent (test).
- [ ] `listUsers` returns the join date and listing count, and no email (test on the result shape).
- [ ] A `user` visiting `/admin` sees a not-allowed view, and every data call fails on the server
      (manual check plus the tests above).

## Known Constraints
`remindersSent` only starts increasing in block 009. Until then, the long-overdue flag is tested
with seeded values.
