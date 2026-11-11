# 008 — Automation UI, polish, documentation and release

**Status:** Planned
**Module:** WEB
**Branch:** feature/008-automation-ui-polish-and-release

## Goal
Show automation activity on loans and automation health to admins, finish the UX states, and ship
the README, the production note and `v1.0.0`.

## Dependencies
- Depends on: 007
- Depended on by: None

## Requirements
AUT-3 (UI), ADM-4 (UI), UX-1 – UX-3, SEC-5, OPS-1, DEL-3, DEL-4.

## Inputs
- [architecture.md §5.3, §12](../architecture.md#12-failure-handling-and-visibility),
  [ADR-006](../adr/ADR-006-failure-visibility.md) (2026-11-11 amendment),
  [security.md](../security.md).
- The open tech-debt items, for the production note.

## Outputs
- **Loan activity:** loan cards in My requests, Incoming and the admin Loans tab list automation
  activity, for example "Lender notified · 3 min ago", "Overdue reminder sent · 2 days ago" or
  "Reminder failed". Parties see statuses only, and admins also see the redacted detail. Relative
  times update live.
- **Admin Automation tab:**
  - failed deliveries (event type, tool, attempts, last error code, time) with **Retry** and
    **Retry all**;
  - recent workflow errors, under any workflow slug;
  - the last reminder run (time and counts), in three states: **ok**, **stale**, **no run yet**;
  - a navigation badge for failed deliveries, a workflow error in the last 24 h, or a stale run.
- **Test helper:** `dev:backdateLastRun` (guarded), which ages the last run summary by 27 h, so
  the stale state can be checked by hand.
- **UX polish:**
  - loading skeletons, empty states that suggest the next action, and error boundaries;
  - a map from each `ConvexError` code to a plain message, with a generic message for unknown
    errors;
  - a toast for every mutation;
  - consistent status badges and dates;
  - a mobile menu;
  - dialogs that manage focus, labelled inputs, and checked contrast;
  - a 404 page.
- **README:**
  - what LendLoop is, with screenshots;
  - a quickstart: prerequisites, Clerk, local Convex, `npm run setup`, run, `npm run seed` and
    `npm run admin:grant`;
  - testing with two browser profiles;
  - the environment variables;
  - an architecture summary with diagrams;
  - the security and data-minimization summary;
  - the workflows, and how to import, publish and export them;
  - testing and requirements coverage;
  - a short "Running this in production" section (DEL-4);
  - a closing "How this was built" section that links the process and the review records.
- **`docs/production.md`:**
  - hosting: a cloud Convex deployment, and n8n in queue mode on Postgres, reached over a
    private network or a real domain with TLS;
  - secrets: a secrets manager, and rotation that accepts the current and previous secret;
  - email: a provider with SPF, DKIM and DMARC, bounces, unsubscribe, and idempotency keys;
  - identity: Clerk webhooks, and restricted sign-up;
  - operations: alerting on the heartbeat and dead letters, backups, retention and deletion,
    and CI/CD with separate environments;
  - performance: denormalized availability;
  - the open tech-debt items that matter for production.
- **Consistency:** architecture.md and security.md match the final code, and the PRD §9 evidence
  column is complete.
- **Release:** the `v1.0.0` CHANGELOG entry and version bump, in close-block's release commit.

## Acceptance Criteria
- [ ] Loan activity shows on the loan cards. Parties see statuses without error messages or
      emails, and admins see the redacted detail (manual check, recorded; the access and shape
      rules are block 006's tests).
- [ ] Retry and Retry all re-deliver dead letters once n8n is reachable. Failed deliveries, a
      recent workflow error and a stale run each raise the admin badge, and clearing them removes
      it. "No run yet" shows on a fresh setup, and the stale flag appears without a reload when
      `dev:backdateLastRun` ages the last run (manual check, recorded).
- [ ] Every route has loading, empty and error states (checklist, recorded). Every error code maps
      to a plain message, and unknown errors to the generic one (test).
- [ ] Every flow works at 360 px with no horizontal scrolling, and a keyboard-only run through
      request → approve → return succeeds, with dialogs trapping focus and returning it (manual
      check, recorded).
- [ ] Following only the README, a fresh clone gets through sign-in with two profiles, listing a
      tool, request → approve → return with the emails in Mailpit, and an overdue reminder run
      (recorded).
- [ ] The README covers DEL-3 and carries the production summary (DEL-4), and
      `docs/production.md` holds the full note.
- [ ] Every PRD requirement has linked evidence in §9 from blocks 001–007. This block's own links
      are added when it closes.
- [ ] CI, `check:workflows` and `check:ids` are green on this block's last commit before review.

## Known Constraints
None.
