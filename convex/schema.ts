import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { auditActionValidator, roleValidator } from "./lib/validators";

// architecture.md §4. Later blocks add their tables here.
export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    displayName: v.string(),
    email: v.string(),
    role: roleValidator,
    isTrustedLender: v.boolean(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  auditLog: defineTable({
    // Empty for CLI and system actions.
    actorId: v.optional(v.id("users")),
    action: auditActionValidator,
    targetTable: v.string(),
    targetId: v.string(),
    reason: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),
});
