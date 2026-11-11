import type { UserIdentity } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { DISPLAY_NAME_MAX_LENGTH } from "../lib/domain";
import { appError } from "../lib/errors";
import { codePointLength, stripControlCharacters, type Role } from "../lib/validators";
import { recordAudit } from "./audit";

/** FNV-1a, 32-bit: a small, stable hash that spreads subjects over the "Neighbor" numbers. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** BR-16's fallback name: 4 digits from the identity's subject (the Clerk user ID), never the email. */
export function neighborName(subject: string): string {
  return `Neighbor ${String(fnv1a(subject) % 10_000).padStart(4, "0")}`;
}

function truncate(text: string, maxLength: number): string {
  return Array.from(text).slice(0, maxLength).join("").trimEnd();
}

/**
 * BR-16: "Given F." from the identity's name claims, or "Neighbor ####" without a given name.
 * Control characters are stripped, and the result is at most 40 characters.
 */
export function displayNameFor(
  claims: Pick<UserIdentity, "subject" | "givenName" | "familyName">,
): string {
  const given = stripControlCharacters(claims.givenName ?? "");
  if (given === "") {
    return neighborName(claims.subject);
  }
  const initial = Array.from(stripControlCharacters(claims.familyName ?? "")).at(0);
  const suffix = initial === undefined ? "" : ` ${initial}.`;
  return truncate(given, DISPLAY_NAME_MAX_LENGTH - codePointLength(suffix)) + suffix;
}

/** Emails are stored and looked up in lower case, so the CLI grant matches however it is typed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Creates the user's row on first sign-in, and refreshes the name and email from the identity on
 * later calls. The row is keyed by `tokenIdentifier`; a mutation is serializable, so two
 * concurrent first calls cannot both insert.
 */
export async function upsertUser(ctx: MutationCtx, identity: UserIdentity): Promise<Id<"users">> {
  const claimedEmail = identity.email?.trim() ?? "";
  if (claimedEmail === "") {
    throw appError(
      "VALIDATION",
      "Your sign-in didn't include an email address, so LendLoop can't set up your account. " +
        "The Clerk session token needs an email claim (see the README).",
    );
  }
  const email = normalizeEmail(claimedEmail);
  const displayName = displayNameFor(identity);

  const existing = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (existing === null) {
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      displayName,
      email,
      role: "user",
      isTrustedLender: false,
    });
  }
  if (existing.displayName !== displayName || existing.email !== email) {
    await ctx.db.patch("users", existing._id, { displayName, email });
  }
  return existing._id;
}

/** What a user sees about themselves (`users:me`). */
export function profileOf(user: Doc<"users">) {
  return {
    displayName: user.displayName,
    role: user.role,
    isTrustedLender: user.isTrustedLender,
  };
}

/** BR-18: the CLI's role change, by email, written to the audit log. */
export async function setRoleByEmail(
  ctx: MutationCtx,
  email: string,
  role: Role,
): Promise<{ changed: boolean }> {
  const matches = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .take(2);
  if (matches.length === 0) {
    throw appError(
      "NOT_FOUND",
      "No user with that email has signed in yet. They need to sign in once first.",
    );
  }
  if (matches.length > 1) {
    throw appError("CONFLICT", "More than one user has that email, so no role was changed.");
  }
  const user = matches[0];
  if (user.role === role) {
    return { changed: false };
  }
  await ctx.db.patch("users", user._id, { role });
  await recordAudit(ctx, {
    action: "user.role_changed",
    targetTable: "users",
    targetId: user._id,
    reason: `${user.role} → ${role}, from the CLI`,
  });
  return { changed: true };
}
