# ADR-008 — Loan dates are calendar dates in one app timezone

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

Users borrow "from Nov 12 to Nov 14": calendar days, not instants. "Overdue" means the end date
is before *today*, which depends on a timezone. Storing instants (epoch milliseconds) invites
off-by-one bugs: a date picked at local midnight becomes the previous day in UTC.

## Options Considered

### Option A — Epoch milliseconds for start and end

- **Pros:** one numeric type everywhere.
- **Cons:** every comparison has to pick a timezone, and conversions leak into the UI.

### Option B — `YYYY-MM-DD` strings, with "today" computed in one configured timezone

- **Pros:** strings sort and compare correctly, so overlap and overdue checks are plain string
  comparisons. No conversion happens on the way in or out.
- **Cons:** one timezone serves the whole neighborhood.

### Option C — A timezone per user

- **Pros:** correct for users in different zones.
- **Cons:** "overdue" becomes ambiguous between the two parties of one loan. Unnecessary for a
  single neighborhood.

## Decision

**Option B.** `APP_TIMEZONE` (an IANA name, default `UTC`) sets the app's calendar.
`convex/lib/dates.ts` is the only place that computes "today". The UI reads today's date and the
limits from a Convex query, so client and server cannot disagree.

## Rationale

A neighborhood shares a clock. Calendar strings make the rules (BR-5, BR-7, BR-11, BR-12,
BR-15) direct to express and test.

## Consequences

- The n8n schedule uses the same timezone (`GENERIC_TIMEZONE` = `APP_TIMEZONE`).
- `Intl.DateTimeFormat` timezone support in the Convex runtime is verified in block 004.
- A Convex query reading "today" doesn't re-run when midnight passes on its own. This is accepted
  in security.md §6.
