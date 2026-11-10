# 002 — Identity and roles

**Status:** Planned
**Module:** AUTH
**Branch:** feature/002-identity-and-roles

## Goal
Connect Clerk and Convex, and build the authorization foundation every later block uses: user
records, the function wrappers, error codes, the lint rule that enforces the wrappers, and admin
grants from the CLI.

## Dependencies
- Depends on: 001
- Depended on by: 003, 005, 006, 007

## Requirements
PUB-3, SEC-1 (foundation), BR-16 (display names), BR-18.

## Inputs
- [architecture.md §4 `users`, §5](../architecture.md#5-authorization),
  [ADR-002](../adr/ADR-002-convex-is-the-authorization-authority.md).
- [security-standards](../../.claude/rules/security-standards.md).

## Outputs
- **Convex project:** `convex/` initialized, with `convex/_generated` committed.
- **Auth config:** `convex/auth.config.ts` (Clerk issuer from `CLERK_JWT_ISSUER_DOMAIN`).
- **Schema:** `convex/schema.ts` with `users` and `auditLog`.
- **Libraries:**
  - `convex/lib/functions.ts`: `publicQuery`, `identityMutation`, `userQuery`, `userMutation`,
    `adminQuery` and `adminMutation`, built with `convex-helpers` custom functions
    ([architecture.md §5.1](../architecture.md#51-function-wrappers)).
  - `convex/lib/errors.ts`: error codes.
  - `convex/lib/env.ts`: validated access to environment variables.
- **Functions:**
  - `convex/users.ts`:
    - `ensureUser` (`identityMutation`): upserts the row from the identity's claims;
    - `me`: display name, role and Trusted flag;
    - the internal `grantRole`: by email, written to the audit log.
  - `convex/model/users.ts`, `convex/model/audit.ts`.
- **Lint rule:** ESLint `no-restricted-imports` blocks the raw `query`, `mutation` and `action`
  builders from `_generated/server` everywhere except `convex/lib/functions.ts`.
- **Next.js:**
  - `ClerkProvider` with `ConvexProviderWithClerk`.
  - `proxy.ts` with `clerkMiddleware`, protecting `/tools`, `/listings`, `/requests`, `/incoming`
    and `/admin`.
  - A sign-in route, and a header with Clerk's user button.
  - A `useEnsureUser` hook that calls `ensureUser` once per session.
  - The landing button: **"Sign in to lend or borrow"**, or **"Open LendLoop"** when signed in.
  - The app shell, with navigation placeholders and an Admin link only for admins.
- **Tests:** `convex-test` setup and `convex/test/` helpers (identity and user factories).
- **Docs:** `.env.example` updated; README development section covers the Clerk and Convex setup.

## Acceptance Criteria
- [ ] The first sign-in creates exactly one `users` row. Calling `ensureUser` again updates the
      row and never duplicates it (test). The display name follows "Given F.", with fallbacks for
      missing claims (test).
- [ ] `userQuery`/`userMutation` reject unauthenticated callers with `UNAUTHENTICATED`.
      `adminQuery`/`adminMutation` reject a `user` with `FORBIDDEN` (tests).
- [ ] `users:grantRole`:
  - is internal, so it is absent from `api` (type-level check plus test);
  - changes the role by email and writes an `auditLog` row (test);
  - fails clearly for an unknown email (test).
- [ ] ESLint reports an error when any `convex/` file other than `lib/functions.ts` imports
      `query` or `mutation` from `_generated/server`. Proven by a lint test over a fixture file.
- [ ] Signed out, `/tools` redirects to sign-in. Signed in, the user reaches the app shell. The
      landing button text matches the session state (manual check, recorded).
- [ ] No public function takes a user ID argument for the acting user (review check, recorded).
- [ ] CI stays green without Convex or Clerk secrets: tests run on `convex-test`, and the build
      uses documented placeholder public variables.

## Known Constraints
- Verify Next.js 16 `proxy.ts` together with Clerk 7 `clerkMiddleware`, and which identity claims
  carry the name and email under the Clerk–Convex integration
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Profile changes sync on the next `ensureUser` call. Clerk webhooks are a production note
  (TD-001).
- App routes render their data only after `ensureUser` has resolved, so `userQuery` never runs
  without a user row in the normal flow. If it ever does, it fails with `UNAUTHENTICATED` and the
  UI retries once the row exists.

## Manual Steps
1. Create a Clerk application with email sign-in, and turn on its **Convex integration**. Copy
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `.env.local`.
2. Run `npx convex dev` once to log in and create the dev deployment.
3. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex env. The README's development section gives the
   exact command.

**Release:** `v0.1.0` when this block closes.
