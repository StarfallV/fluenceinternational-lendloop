# 003 — Tool listings

**Status:** Planned
**Module:** TOOL
**Branch:** feature/003-tool-listings

## Goal
Let neighbors list, edit and delete their tools, and browse everyone's tools by category. Show
visitors the public list. Ownership and data minimization are enforced in Convex.

## Dependencies
- Depends on: 002
- Depended on by: 004

## Requirements
PUB-2 (public list), LST-1 – LST-5 (views; availability arrives in 004), SEC-2 (listings), SEC-5
(public projection), SEC-6 (limits, rate limit), BR-1 – BR-3, BR-13 (soft delete only), BR-17
(badge display).

## Inputs
- [architecture.md §4 `tools`, §6](../architecture.md#6-loan-lifecycle-availability-and-time),
  [prd.md §3.1–3.2, §5.1](../prd.md#5-business-rules).

## Outputs
- **Data and shared rules:**
  - `tools` table and indexes.
  - `convex/lib/domain.ts`: categories, conditions and limits, shared with the UI.
  - Tool-name validation in `convex/lib/validators.ts`: single line, no control characters.
- **Functions in `convex/tools.ts`:**
  - `listPublic` (`publicQuery`): `{ _id, name, category }[]` of available tools, at most 60,
    newest first (read through the `by_status` index), with a `returns` validator. Until block 004
    every active tool counts as available.
  - `list` (`userQuery`, paginated, 20 per page, optional category): cards with owner display name,
    Trusted badge, condition, description, and availability.
  - `mine` (`userQuery`): at most 100 of the user's tools.
  - `create`, `update`, `remove` (`userMutation`; owner only; remove is a soft delete).
- **Logic:**
  - `convex/model/tools.ts`.
  - `convex/model/availability.ts`: returns Available until block 004, already shaped for loans.
- **Rate limit:** `@convex-dev/rate-limiter` (in `convex/convex.config.ts`), 20 new listings per
  hour per user.
- **UI:**
  - Landing list: name plus a category chip.
  - `/tools`: browse, with the category filter in the URL (`?category=garden`) and "Load more"
    pagination.
  - Tool cards.
  - `/listings`: create and edit dialogs (react-hook-form and zod, mirroring the server limits),
    and delete with confirmation.
- **Seed data:** the internal `dev:seed` (refuses to run unless `ALLOW_DEV_FUNCTIONS=true`), run as
  `npm run seed`:
  - by default, adds demo owners (not Clerk users, `@example.com`) and about 12 tools across the
    categories, so the public page isn't empty;
  - with `-- --owner you@example.com`, gives some tools to that signed-in user, so a second
    account can request them.

## Acceptance Criteria
- [ ] `listPublic` works signed out and returns exactly `_id`, `name` and `category` for active
      tools, at most 60, newest first. The test asserts the exact key set, the order and the limit.
- [ ] `create` and `update` enforce BR-1 – BR-3 and reject violations with `VALIDATION`.
      Boundary tests: names of 1, 2, 60 and 61 characters; a name containing a line break;
      descriptions of 500 and 501; whitespace-only fields; categories and conditions outside the
      enum.
- [ ] `update` and `remove` by anyone but the owner fail with `FORBIDDEN`, including an admin
      using the user endpoints on someone else's listing (tests).
- [ ] Deleted listings disappear from `listPublic`, `list` and `mine`, and the row is kept (test).
- [ ] `list` paginates (a test with 25 tools gives pages of 20 and 5) and filters by category
      (test).
- [ ] The 21st listing within an hour fails with `RATE_LIMITED` (test, with the rate-limiter
      component registered in `convex-test`).
- [ ] No tools query ever returns an email address. Tests check the result shapes.
- [ ] `dev:seed` refuses to run without `ALLOW_DEV_FUNCTIONS=true` (test). With `--owner`, it
      gives tools to that user (test).
- [ ] **Browse** (manual check, recorded): `/tools?category=garden` shows only garden tools, keeps
      the filter on reload, shows an empty state for an empty category, and "Load more" works.
- [ ] **My listings** shows the user's own tools, and create, edit and delete all work (manual
      check, recorded).

## Known Constraints
- Availability is "Available" until block 004 adds loans. BR-13's loan rules (block deletion
  while on loan; cancel pending requests) and the exclusion of tools on loan from `listPublic` are
  finished in 004.
- Check how `convex-test` registers components such as the rate limiter
  ([architecture.md §16](../architecture.md#16-open-verification-items)).

## Manual Steps
Set `ALLOW_DEV_FUNCTIONS=true` in the **dev** Convex env, to allow seeding.
