import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AuditAction } from "../lib/validators";

type AuditEntry = {
  /** Empty for CLI and system actions. */
  actorId?: Id<"users">;
  action: AuditAction;
  targetTable: string;
  targetId: string;
  reason?: string;
};

/** Records a role, trust or moderation change (ADR-002, BR-14, BR-17). */
export async function recordAudit(ctx: Pick<MutationCtx, "db">, entry: AuditEntry): Promise<void> {
  await ctx.db.insert("auditLog", { ...entry, at: Date.now() });
}
