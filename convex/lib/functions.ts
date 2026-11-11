/**
 * The function builders every Convex module uses (ADR-002, architecture.md §5.1). This is the only
 * file that imports the raw `query`, `mutation` and `action` builders; ESLint enforces it.
 *
 * The acting user always comes from the verified identity, never from an argument.
 */
import type { Auth, UserIdentity } from "convex/server";
import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";

import type { Doc } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "../_generated/server";
import { appError } from "./errors";

async function requireIdentity(ctx: { auth: Auth }): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw appError("UNAUTHENTICATED", "Sign in to continue.");
  }
  return identity;
}

async function requireUser(ctx: Pick<QueryCtx, "auth" | "db">): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  // The row is created by `users:ensureUser` right after sign-in; the UI waits for it.
  if (user === null) {
    throw appError("UNAUTHENTICATED", "Your account is still being set up. Try again in a moment.");
  }
  return user;
}

async function requireAdmin(ctx: Pick<QueryCtx, "auth" | "db">): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw appError("FORBIDDEN", "Only admins can do that.");
  }
  return user;
}

/** No sign-in needed. Only for `tools:listPublic` and `config:get`, which declare `returns`. */
export const publicQuery = query;

/** A verified identity, with no `users` row needed yet. Only for `users:ensureUser`. */
export const identityMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ identity: await requireIdentity(ctx) })),
);

/** A signed-in user with a `users` row, as `ctx.user`. */
export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
);

/** A signed-in user with a `users` row, as `ctx.user`. */
export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
);

/** A signed-in admin, as `ctx.user`. */
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ user: await requireAdmin(ctx) })),
);

/** A signed-in admin, as `ctx.user`. */
export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await requireAdmin(ctx) })),
);

// For n8n (through the HTTP endpoints), crons and the CLI. They are never callable from a client.
export { internalAction, internalMutation, internalQuery };
