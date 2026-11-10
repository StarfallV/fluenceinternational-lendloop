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
PUB-2, LST-1 – LST-5, SEC-2 (listings), SEC-5 (public projection), SEC-6 (limits, rate limit),
BR-1 – BR-3, BR-12 (shape only), BR-13 (soft delete only), BR-17 (badge display).

## Inputs
- [architecture.md §4 `tools`](../architecture.md#tools), [prd.md §3.1–3.2, §5.1](../prd.md#5-business-rules).

## Outputs
- **Data and shared rules:**
  - `tools` table and indexes.
  - `convex/lib/domain.ts`: categories, conditions and limits, shared with the UI.
  - `convex/lib/validators.ts`.
- **Functions in `convex/tools.ts`:**
  - `listPublic` (`publicQuery`): `{ _id, name, category }[]` of available tools, with a
    `returns` validator.
  - `list` (`userQuery`, optional category): cards with owner display name, Trusted badge,
    condition, description, and availability.
  - `mine` (`userQuery`).
  - `create`, `update`, `remove` (`userMutation`; owner only; remove is a soft delete).
- **Logic:**
  - `convex/model/tools.ts`.
  - `convex/model/availability.ts`: returns Available until block 004, already shaped for loans.
- **Rate limit:** `@convex-dev/rate-limiter` (in `convex/convex.config.ts`), 20 new listings per
  hour per user.
- **UI:**
  - Landing list: name plus a category chip.
  - `/tools`: browse, with the category filter in the URL (`?category=garden`).
  - Tool cards.
  - `/listings`: create and edit dialogs (react-hook-form and zod, mirroring the server limits),
    and delete with confirmation.
- **Seed data:** the internal `dev:seed` (refuses to run unless `ALLOW_DEV_FUNCTIONS=true`) adds
  demo owners (not Clerk users, `@example.com`) and about 12 tools across the categories.

## Acceptance Criteria
- [ ] `listPublic` works signed out and returns exactly `_id`, `name` and `category` for active
      tools. The test asserts the exact key set.
- [ ] `create` and `update` enforce BR-1 – BR-3 and reject violations with `VALIDATION`.
      Boundary tests: names of 1, 2, 60 and 61 characters; descriptions of 500 and 501;
      whitespace-only fields; categories and conditions outside the enum.
- [ ] `update` and `remove` by anyone but the owner fail with `FORBIDDEN`, including an admin
      using the user endpoints on someone else's listing (tests).
- [ ] Deleted listings disappear from `listPublic`, `list` and `mine`, and the row is kept (test).
- [ ] The 21st listing within an hour fails with `RATE_LIMITED` (test).
- [ ] No tools query ever returns an email address. Tests check the result shapes.
- [ ] `dev:seed` refuses to run without `ALLOW_DEV_FUNCTIONS=true` (test).
- [ ] `/tools?category=garden` shows only garden tools, keeps the filter on reload, and shows an
      empty state for an empty category (manual check, recorded).

## Known Constraints
- Availability is "Available" until block 004 adds loans. BR-13's loan rules (block deletion
  while on loan; cancel pending requests) are finished in 004.
