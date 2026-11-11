import { describe, expect, expectTypeOf, it } from "vitest";

import { api, internal } from "./_generated/api";
import { displayNameFor, neighborName } from "./model/users";
import { clerkIdentity, makeUser } from "./test/factories.helpers";
import { expectAppError, newTest, type Test } from "./test/setup.helpers";
import { grantRole } from "./users";

async function allUsers(t: Test) {
  return await t.run(async (ctx) => ctx.db.query("users").collect());
}

async function allAuditRows(t: Test) {
  return await t.run(async (ctx) => ctx.db.query("auditLog").collect());
}

describe("users.ensureUser", () => {
  it("creates exactly one users row on the first sign-in", async () => {
    const t = newTest();
    const identity = clerkIdentity("user_alex");

    await t.withIdentity(identity).mutation(api.users.ensureUser);

    const users = await allUsers(t);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      tokenIdentifier: identity.tokenIdentifier,
      displayName: "Alex P.",
      email: "user_alex@example.com",
      role: "user",
      isTrustedLender: false,
    });
  });

  it("updates the row on a later call and never duplicates it", async () => {
    const t = newTest();
    await t.withIdentity(clerkIdentity("user_alex")).mutation(api.users.ensureUser);
    const [created] = await allUsers(t);
    const changed = clerkIdentity("user_alex", {
      givenName: "Alexandra",
      familyName: "Quinn",
      email: "alexandra@example.com",
    });

    await t.withIdentity(changed).mutation(api.users.ensureUser);
    await t.withIdentity(changed).mutation(api.users.ensureUser);

    const users = await allUsers(t);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      _id: created._id,
      displayName: "Alexandra Q.",
      email: "alexandra@example.com",
    });
  });

  it("creates one row when two first calls run at the same time", async () => {
    const t = newTest();
    const asAlex = t.withIdentity(clerkIdentity("user_alex"));

    await Promise.all([
      asAlex.mutation(api.users.ensureUser),
      asAlex.mutation(api.users.ensureUser),
    ]);

    expect(await allUsers(t)).toHaveLength(1);
  });

  it("keeps the role and Trusted flag when it refreshes a row", async () => {
    const t = newTest();
    const { userId, identity } = await makeUser(t, { role: "admin", isTrustedLender: true });

    await t.withIdentity(identity).mutation(api.users.ensureUser);

    const user = await t.run(async (ctx) => ctx.db.get("users", userId));
    expect(user).toMatchObject({ role: "admin", isTrustedLender: true });
  });

  it("stores the email in lower case", async () => {
    const t = newTest();

    await t
      .withIdentity(clerkIdentity("user_alex", { email: " Alex.Parker@Example.COM " }))
      .mutation(api.users.ensureUser);

    const [user] = await allUsers(t);
    expect(user.email).toBe("alex.parker@example.com");
  });

  it.each([
    { state: "missing", email: undefined },
    { state: "blank", email: "  " },
  ])("rejects an identity whose email claim is $state with VALIDATION", async ({ email }) => {
    const t = newTest();

    await expectAppError(
      t.withIdentity(clerkIdentity("user_alex", { email })).mutation(api.users.ensureUser),
      "VALIDATION",
    );
    expect(await allUsers(t)).toHaveLength(0);
  });

  it("rejects a caller who isn't signed in with UNAUTHENTICATED", async () => {
    const t = newTest();

    await expectAppError(t.mutation(api.users.ensureUser), "UNAUTHENTICATED");
  });

  it("names a user without name claims 'Neighbor ####', never after the email", async () => {
    const t = newTest();
    const identity = clerkIdentity("user_zoe", {
      name: undefined,
      givenName: undefined,
      familyName: undefined,
      email: "zoe.quint@mailbox.test",
    });

    await t.withIdentity(identity).mutation(api.users.ensureUser);

    const [user] = await allUsers(t);
    expect(user.displayName).toMatch(/^Neighbor \d{4}$/);
    for (const part of ["zoe", "quint", "mailbox"]) {
      expect(user.displayName.toLowerCase()).not.toContain(part);
    }
  });
});

describe("users.me", () => {
  it("returns only the display name, role and Trusted flag", async () => {
    const t = newTest();
    const { asUser } = await makeUser(t, { displayName: "Sam K.", isTrustedLender: true });

    const me = await asUser.query(api.users.me);

    expect(me).toStrictEqual({ displayName: "Sam K.", role: "user", isTrustedLender: true });
  });

  it("rejects a caller who isn't signed in with UNAUTHENTICATED", async () => {
    const t = newTest();

    await expectAppError(t.query(api.users.me), "UNAUTHENTICATED");
  });

  it("rejects a signed-in caller before ensureUser has created the row, with UNAUTHENTICATED", async () => {
    const t = newTest();

    await expectAppError(
      t.withIdentity(clerkIdentity("user_new")).query(api.users.me),
      "UNAUTHENTICATED",
    );
  });
});

describe("users.grantRole", () => {
  it("is internal, so it is absent from the public api", () => {
    expectTypeOf(api.users).not.toHaveProperty("grantRole");
    expectTypeOf(internal.users).toHaveProperty("grantRole");
    expect(grantRole.isInternal).toBe(true);
    expect("isPublic" in grantRole).toBe(false);
  });

  it("changes the role by email and writes an auditLog row", async () => {
    const t = newTest();
    const { userId } = await makeUser(t, { email: "sam@example.com" });

    const result = await t.mutation(internal.users.grantRole, {
      email: "sam@example.com",
      role: "admin",
    });

    expect(result).toEqual({ changed: true });
    const user = await t.run(async (ctx) => ctx.db.get("users", userId));
    expect(user?.role).toBe("admin");
    const audit = await allAuditRows(t);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "user.role_changed",
      targetTable: "users",
      targetId: userId,
      reason: "user → admin, from the CLI",
    });
    expect(audit[0]).not.toHaveProperty("actorId");
  });

  it("finds the user whatever the case and spacing of the email", async () => {
    const t = newTest();
    const { userId } = await makeUser(t, { email: "sam@example.com" });

    await t.mutation(internal.users.grantRole, { email: "  Sam@Example.com ", role: "admin" });

    const user = await t.run(async (ctx) => ctx.db.get("users", userId));
    expect(user?.role).toBe("admin");
  });

  it("can take the admin role away again", async () => {
    const t = newTest();
    const { userId } = await makeUser(t, { email: "sam@example.com", role: "admin" });

    await t.mutation(internal.users.grantRole, { email: "sam@example.com", role: "user" });

    const user = await t.run(async (ctx) => ctx.db.get("users", userId));
    expect(user?.role).toBe("user");
    expect(await allAuditRows(t)).toHaveLength(1);
  });

  it("changes nothing and writes no audit row when the user already has the role", async () => {
    const t = newTest();
    await makeUser(t, { email: "sam@example.com", role: "admin" });

    const result = await t.mutation(internal.users.grantRole, {
      email: "sam@example.com",
      role: "admin",
    });

    expect(result).toEqual({ changed: false });
    expect(await allAuditRows(t)).toHaveLength(0);
  });

  it("fails with NOT_FOUND for an email nobody has signed in with", async () => {
    const t = newTest();
    await makeUser(t, { email: "sam@example.com" });

    await expectAppError(
      t.mutation(internal.users.grantRole, { email: "nobody@example.com", role: "admin" }),
      "NOT_FOUND",
    );
    expect(await allAuditRows(t)).toHaveLength(0);
  });

  it("fails with CONFLICT, changing nothing, when two users have the email", async () => {
    const t = newTest();
    await makeUser(t, { email: "sam@example.com" });
    await makeUser(t, { email: "sam@example.com" });

    await expectAppError(
      t.mutation(internal.users.grantRole, { email: "sam@example.com", role: "admin" }),
      "CONFLICT",
    );
    const users = await allUsers(t);
    expect(users.map((user) => user.role)).toEqual(["user", "user"]);
  });

  it("keeps the email out of its error messages", async () => {
    const t = newTest();

    const error = await t
      .mutation(internal.users.grantRole, { email: "nobody@example.com", role: "admin" })
      .catch((reason: unknown) => reason);

    expect(JSON.stringify(error)).not.toContain("nobody");
    expect(String(error)).not.toContain("nobody");
  });
});

describe("displayNameFor", () => {
  const subject = "user_2abcDEF";

  it("is 'Given F.' when the given and family names are present", () => {
    expect(displayNameFor({ subject, givenName: "Alex", familyName: "Parker" })).toBe("Alex P.");
  });

  it("is the given name alone when there is no family name", () => {
    expect(displayNameFor({ subject, givenName: "Alex" })).toBe("Alex");
  });

  it("is 'Neighbor ####' when there are no name claims", () => {
    expect(displayNameFor({ subject })).toBe(neighborName(subject));
    expect(neighborName(subject)).toMatch(/^Neighbor \d{4}$/);
  });

  it("is 'Neighbor ####' when the given name is only whitespace and control characters", () => {
    expect(displayNameFor({ subject, givenName: " \n\t ", familyName: "Parker" })).toBe(
      neighborName(subject),
    );
  });

  it("gives the same Neighbor number to the same subject, and spreads different ones", () => {
    const names = new Set(Array.from({ length: 50 }, (_, index) => neighborName(`user_${index}`)));

    expect(neighborName(subject)).toBe(neighborName(subject));
    expect(names.size).toBeGreaterThan(40);
  });

  it("strips a line break from a name", () => {
    expect(displayNameFor({ subject, givenName: "Mary\nJane", familyName: "\nParker" })).toBe(
      "Mary Jane P.",
    );
  });

  it("caps a long name at 40 characters, keeping the initial", () => {
    const name = displayNameFor({ subject, givenName: "A".repeat(60), familyName: "Parker" });

    expect(Array.from(name)).toHaveLength(40);
    expect(name.endsWith(" P.")).toBe(true);
  });

  it("caps by characters, so an emoji is never cut in half", () => {
    const name = displayNameFor({ subject, givenName: "🔨".repeat(45) });

    expect(name).toBe("🔨".repeat(40));
  });
});
