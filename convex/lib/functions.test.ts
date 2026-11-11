import { defineTestApp } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";

import schema from "../schema";
import { clerkIdentity, makeUser } from "../test/factories.helpers";
import { expectAppError, type Test } from "../test/setup.helpers";
import { adminMutation, adminQuery, identityMutation, userMutation, userQuery } from "./functions";

// One probe per wrapper, registered only in this in-memory app, never deployed.
const app = defineTestApp({ schema });
const { api, createTest } = app.defineModules({
  probes: {
    userQuery: userQuery({
      args: {},
      returns: v.id("users"),
      handler: async (ctx) => ctx.user._id,
    }),
    userMutation: userMutation({
      args: {},
      returns: v.id("users"),
      handler: async (ctx) => ctx.user._id,
    }),
    adminQuery: adminQuery({
      args: {},
      returns: v.id("users"),
      handler: async (ctx) => ctx.user._id,
    }),
    adminMutation: adminMutation({
      args: {},
      returns: v.id("users"),
      handler: async (ctx) => ctx.user._id,
    }),
    identityMutation: identityMutation({
      args: {},
      returns: v.string(),
      handler: async (ctx) => ctx.identity.tokenIdentifier,
    }),
  },
});

type Caller = Pick<Test, "query" | "mutation">;

const userWrappers = [
  { wrapper: "userQuery", call: (t: Caller) => t.query(api.probes.userQuery) },
  { wrapper: "userMutation", call: (t: Caller) => t.mutation(api.probes.userMutation) },
];

const adminWrappers = [
  { wrapper: "adminQuery", call: (t: Caller) => t.query(api.probes.adminQuery) },
  { wrapper: "adminMutation", call: (t: Caller) => t.mutation(api.probes.adminMutation) },
];

describe("userQuery and userMutation", () => {
  it.each(userWrappers)(
    "$wrapper rejects a caller who isn't signed in with UNAUTHENTICATED",
    async ({ call }) => {
      const t = createTest();

      await expectAppError(call(t), "UNAUTHENTICATED");
    },
  );

  it.each(userWrappers)(
    "$wrapper rejects a signed-in caller who has no users row yet with UNAUTHENTICATED",
    async ({ call }) => {
      const t = createTest();

      await expectAppError(call(t.withIdentity(clerkIdentity("user_new"))), "UNAUTHENTICATED");
    },
  );

  it.each(userWrappers)("$wrapper gives the handler the caller's own row", async ({ call }) => {
    const t = createTest();
    await makeUser(t);
    const { userId, asUser } = await makeUser(t);

    const result = await call(asUser);

    expect(result).toBe(userId);
  });
});

describe("adminQuery and adminMutation", () => {
  it.each(adminWrappers)(
    "$wrapper rejects a caller who isn't signed in with UNAUTHENTICATED",
    async ({ call }) => {
      const t = createTest();

      await expectAppError(call(t), "UNAUTHENTICATED");
    },
  );

  it.each(adminWrappers)("$wrapper rejects a user with FORBIDDEN", async ({ call }) => {
    const t = createTest();
    const { asUser } = await makeUser(t, { role: "user" });

    await expectAppError(call(asUser), "FORBIDDEN");
  });

  it.each(adminWrappers)("$wrapper lets an admin through as ctx.user", async ({ call }) => {
    const t = createTest();
    const { userId, asUser } = await makeUser(t, { role: "admin" });

    const result = await call(asUser);

    expect(result).toBe(userId);
  });
});

describe("identityMutation", () => {
  it("rejects a caller who isn't signed in with UNAUTHENTICATED", async () => {
    const t = createTest();

    await expectAppError(t.mutation(api.probes.identityMutation), "UNAUTHENTICATED");
  });

  it("runs for a verified identity before any users row exists", async () => {
    const t = createTest();
    const identity = clerkIdentity("user_new");

    const result = await t.withIdentity(identity).mutation(api.probes.identityMutation);

    expect(result).toBe(identity.tokenIdentifier);
  });
});
