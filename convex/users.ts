import { v } from "convex/values";

import { identityMutation, internalMutation, userQuery } from "./lib/functions";
import { roleValidator } from "./lib/validators";
import { profileOf, setRoleByEmail, upsertUser } from "./model/users";

/** Called by the client right after sign-in, and on every later sign-in (architecture.md §5.2). */
export const ensureUser = identityMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await upsertUser(ctx, ctx.identity);
    return null;
  },
});

/** The signed-in user's own profile. No email: the user already knows it, and the UI needs none. */
export const me = userQuery({
  args: {},
  returns: v.object({
    displayName: v.string(),
    role: roleValidator,
    isTrustedLender: v.boolean(),
  }),
  handler: async (ctx) => profileOf(ctx.user),
});

/** BR-18: internal, so only the CLI can call it (`npm run admin:grant -- <email>`). */
export const grantRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args) => await setRoleByEmail(ctx, args.email, args.role),
});
