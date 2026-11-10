# ADR-002 — Convex is the authorization authority

**Status:** Accepted
**Date:** 2026-11-10
**Block:** Planning baseline

## Context

The brief requires two roles (`admin`, `user`) with RBAC "enforced in Convex functions, not only
in the UI". Every public Convex function can be called directly by anyone who has the deployment
URL, so any check that exists only in the UI is not a check. We need to decide:
1. where the role lives;
2. how the first admin is created;
3. how to make it hard to forget a check.

## Options Considered

### Option A — Role in Clerk `publicMetadata`, read from JWT claims

- **Pros:** one identity system; the role is visible in Clerk's dashboard.
- **Cons:** the role reaches Convex through a token. Revoking it takes effect only when the
  session token refreshes. It needs custom session-token claims, and splits the "who can do
  what" logic across two systems.

### Option B — Role in the Convex `users` table, granted by an internal function

- **Pros:** the enforcement point owns the data, so a change takes effect on the next call.
  Internal functions can only be called with the deploy key (CLI or dashboard), so there is no
  self-service escalation path.
- **Cons:** granting a role is a CLI step rather than a click.

### Option C — Admin email allowlist in an environment variable

- **Pros:** trivial to set up.
- **Cons:** an email in an env var is a weak identity link. Changing it means a redeploy. It is
  hard to audit.

## Decision

**Option B**, with three enforcement mechanisms:
1. `convex/lib/functions.ts` builds every public function with `convex-helpers` custom
   functions:
   - `publicQuery`;
   - `identityMutation`, used only by `users:ensureUser`, which creates the user row;
   - `userQuery`, `userMutation`, `adminQuery` and `adminMutation`.

   The user wrappers inject `ctx.user`, loaded from the identity, never from arguments.
2. An ESLint rule forbids importing the raw `query`, `mutation` and `action` builders anywhere
   else.
3. Resource-level checks (`assertToolOwner`, `assertLender`, `assertBorrower`,
   `assertLoanParty`) live in `convex/model/*`, and tests cover each one.

The first admin is created with `npm run admin:grant -- you@example.com`. The script calls the
internal `users:grantRole` through the Convex CLI, and builds the JSON argument itself, so it works
in Windows PowerShell too.

## Rationale

Enforcement and the data it depends on live in one place, and one transaction. The lint rule
turns the most common RBAC bug (a new function without a check) into a build failure.

## Consequences

- Clerk is used for identity only. Its dashboard does not show roles.
- A user exists in Convex only after their first `ensureUser` call. Admins can only be granted
  to users who have signed in at least once.
- Changes to roles and trust are written to `auditLog`.
