# 002 — Identity and roles

**Status:** In progress
**Module:** AUTH
**Branch:** feature/002-identity-and-roles

## Goal
Connect Clerk and Convex, and build the authorization foundation every later block uses: user
records, the function wrappers, error codes, the lint rule that enforces the wrappers, and admin
grants from the CLI.

## Dependencies
- Depends on: 001
- Depended on by: 003

## Requirements
PUB-3, SEC-1 (foundation), BR-16 (display names), BR-18.

## Inputs
- [architecture.md §4 `users`, §5](../architecture.md#5-authorization),
  [ADR-002](../adr/ADR-002-convex-is-the-authorization-authority.md).
- [security-standards](../../.claude/rules/security-standards.md).

## Outputs
- **Convex project:** `convex/` initialized against an anonymous local deployment
  ([ADR-001](../adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md), 2026-11-11 amendment),
  with `convex/_generated` committed.
- **Auth config:** `convex/auth.config.ts` (Clerk issuer from `CLERK_JWT_ISSUER_DOMAIN`).
- **Schema:** `convex/schema.ts` with `users` and `auditLog`.
- **Libraries:**
  - `convex/lib/functions.ts`: `publicQuery`, `identityMutation`, `userQuery`, `userMutation`,
    `adminQuery` and `adminMutation`, built with `convex-helpers` custom functions
    ([architecture.md §5.1](../architecture.md#51-function-wrappers)).
  - `convex/lib/errors.ts`: error codes.
  - `convex/lib/env.ts`: validated access to environment variables.
  - `convex/lib/validators.ts`: a single-line text validator that rejects control characters.
- **Functions:**
  - `convex/users.ts`:
    - `ensureUser` (`identityMutation`): upserts the row from the identity's claims;
    - `me`: display name, role and Trusted flag;
    - the internal `grantRole`: by email, written to the audit log.
  - `convex/model/users.ts`, `convex/model/audit.ts`.
- **Display names (BR-16):**
  - "Given F." from the claims;
  - otherwise "Neighbor ####", 4 digits from a hash of the user ID, never from the email;
  - control characters stripped, at most 40 characters.
- **Admin grant script:** `scripts/admin-grant.ts`, run as `npm run admin:grant -- you@example.com`.
  It builds the JSON argument itself and starts the Convex CLI through its Node entry point, not
  `npx`. That avoids Windows PowerShell's quoting problems.
- **Lint rule:** ESLint `no-restricted-imports` blocks the raw `query`, `mutation` and `action`
  builders from `_generated/server` everywhere except `convex/lib/functions.ts`.
- **Next.js:**
  - `ClerkProvider` with `ConvexProviderWithClerk`.
  - `proxy.ts` with `clerkMiddleware`, protecting `/tools`, `/listings`, `/requests`, `/incoming`
    and `/admin`.
  - A sign-in route, and a header with Clerk's user button.
  - A `useEnsureUser` hook. App routes render their data only after `ensureUser` resolves.
  - The landing button: **"Sign in to lend or borrow"**, or **"Open LendLoop"** when signed in.
  - The app shell, with navigation placeholders and an Admin link only for admins.
- **Tests:** `convex-test` setup and `convex/test/` helpers (identity and user factories).
- **Docs:** `.env.example` updated; the README development section covers the Clerk and Convex
  setup, and the admin grant.

## Acceptance Criteria
- [ ] The first sign-in creates exactly one `users` row. Calling `ensureUser` again updates the
      row and never duplicates it (test).
- [ ] **Display names** (tests):
  - given and family name present → "Given F.";
  - no name claims → "Neighbor ####", and the result contains no part of the email;
  - a name containing a line break is stripped of it;
  - a long name is capped at 40 characters.
- [ ] `userQuery`/`userMutation` reject unauthenticated callers with `UNAUTHENTICATED`.
      `adminQuery`/`adminMutation` reject a `user` with `FORBIDDEN` (tests).
- [ ] `users:grantRole`:
  - is internal, so it is absent from `api` (type-level check plus test);
  - changes the role by email and writes an `auditLog` row (test);
  - fails clearly for an unknown email (test).
- [ ] `npm run admin:grant -- you@example.com` works in Windows PowerShell 5.1 and in Git Bash
      (manual check, recorded).
- [ ] ESLint reports an error when any `convex/` file other than `lib/functions.ts` imports
      `query` or `mutation` from `_generated/server`. Proven by a lint test over a fixture file.
- [ ] Signed out, `/tools` redirects to sign-in. Signed in, the user reaches the app shell. The
      landing button text matches the session state (manual check, recorded).
- [ ] No public function takes a user ID argument for the acting user (review check, recorded).
- [ ] CI stays green without Convex or Clerk secrets: tests run on `convex-test`, and the build
      uses documented placeholder public variables.

## Known Constraints
- Verify Next.js 16 `proxy.ts` together with Clerk 7 `clerkMiddleware`
  ([architecture.md §16](../architecture.md#16-open-verification-items)).
- Verify Clerk auth on the local Convex deployment, and which identity claims carry the name and
  email under the Clerk–Convex integration. If they are missing, customize the Clerk session token
  claims. Never give Convex the Clerk secret key.
- Verify `ClerkProvider` and the Convex client provider under Cache Components, or turn Cache
  Components off and record why.
- Profile changes sync on the next `ensureUser` call. Clerk webhooks are a production item
  (TD-001).
- If `userQuery` ever runs before the user row exists, it fails with `UNAUTHENTICATED`, and the UI
  retries once the row exists.

## Manual Steps
1. Create a Clerk application with email sign-in. Turn on its **Convex integration**, and make
   **first and last name required**. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
   `CLERK_SECRET_KEY` into `.env.local`.
2. Give the Clerk **Frontend API URL** for `CLERK_JWT_ISSUER_DOMAIN` (it is public), or set it
   yourself with the command in the README's development section. No Convex account or login is
   needed: `npx convex dev` provisions an anonymous local deployment.
