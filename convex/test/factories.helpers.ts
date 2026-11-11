// Identity and record factories for the convex-test suites. The two-dot file name keeps Convex
// from deploying it.
import type { UserIdentity } from "convex/server";

import type { Doc } from "../_generated/dataModel";
import type { Test } from "./setup.helpers";

export const TEST_ISSUER = "https://clerk.lendloop.test";

/**
 * The identity Convex derives from a Clerk session token with LendLoop's claims (README): the
 * subject is the Clerk user ID, and the name and email claims are added in Clerk's dashboard.
 */
export function clerkIdentity(subject: string, claims: Partial<UserIdentity> = {}) {
  return {
    issuer: TEST_ISSUER,
    subject,
    tokenIdentifier: `${TEST_ISSUER}|${subject}`,
    name: "Alex Parker",
    givenName: "Alex",
    familyName: "Parker",
    email: `${subject}@example.com`,
    ...claims,
  } satisfies Partial<UserIdentity>;
}

type UserFields = Omit<Doc<"users">, "_id" | "_creationTime" | "tokenIdentifier">;

let userCount = 0;

/** Inserts a `users` row, and returns its ID with an accessor signed in as that user. */
export async function makeUser(t: Test, fields: Partial<UserFields> = {}) {
  userCount += 1;
  const identity = clerkIdentity(`user_test_${userCount}`);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      displayName: "Alex P.",
      email: identity.email,
      role: "user",
      isTrustedLender: false,
      ...fields,
    }),
  );
  return { userId, identity, asUser: t.withIdentity(identity) };
}
