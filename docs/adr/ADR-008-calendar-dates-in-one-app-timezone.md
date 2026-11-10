# ADR-008 — Loan dates are calendar dates in one app timezone; queries read a shared clock

**Status:** Accepted (revised 2026-11-10 after planning review rounds 1 and 2)
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
limits from a Convex query, so it uses the server's calendar rather than the browser's.

**A shared clock for queries.** Convex caches a query until the data it read changes, so calling
`Date.now()` inside a query never notices midnight passing. Instead:
- a cron ticks every minute, and writes a single `clock` row (`today`, `now`) only when the date
  or the hour has changed. Queries are invalidated once an hour, and see a new date within a
  minute;
- the tick that writes a new date also runs request expiry;
- queries read the row, so every open view re-runs when the date changes;
- mutations, which are never cached, compute the time directly.

For up to a minute after midnight, an open view can therefore still show yesterday's limits while
mutations already use today's. The server is authoritative: it rejects a date that has just become
invalid with `VALIDATION`, and the UI explains it.

## Rationale

A neighborhood shares a clock. Calendar strings make the rules (BR-5, BR-7, BR-11, BR-12,
BR-15) direct to express and test.

## Consequences

- The n8n schedule uses the same timezone (`GENERIC_TIMEZONE` = `APP_TIMEZONE`).
- `Intl.DateTimeFormat` timezone support in the Convex runtime is verified in block 004.
- Queries see the date change within a minute of midnight, and "now" at hour precision.
- `npm run setup` seeds the clock row. Until it exists (at most a minute after the very first
  deployment), `readClock` computes the time itself; a query that found no row re-runs when it is
  written.
