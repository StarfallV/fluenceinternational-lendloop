import { describe, expect, it } from "vitest";

import {
  convexRunArgs,
  grantOutcome,
  parseEmailArgument,
  redactEmails,
  USAGE,
} from "./admin-grant";

describe("parseEmailArgument", () => {
  it("returns the trimmed email", () => {
    expect(parseEmailArgument([" sam@example.com "])).toEqual({ email: "sam@example.com" });
  });

  it.each([
    { case: "no argument", argv: [] },
    { case: "two arguments", argv: ["sam@example.com", "alex@example.com"] },
  ])("explains the usage for $case", ({ argv }) => {
    expect(parseEmailArgument(argv)).toEqual({ error: USAGE });
  });

  it.each(["sam", "sam@", "@example.com", "sam @example.com"])(
    "rejects %s, which is not an email address",
    (argument) => {
      expect(parseEmailArgument([argument])).toEqual({
        error: expect.stringContaining("not an email address"),
      });
    },
  );
});

describe("convexRunArgs", () => {
  it("runs users:grantRole with JSON it builds itself", () => {
    const [command, functionName, json] = convexRunArgs('sam"quote@example.com');

    expect([command, functionName]).toEqual(["run", "users:grantRole"]);
    expect(JSON.parse(json)).toEqual({ email: 'sam"quote@example.com', role: "admin" });
  });
});

describe("redactEmails", () => {
  it("replaces every email-shaped string", () => {
    expect(redactEmails('Value: "sam@example.com", and alex.p@mail.test.')).toBe(
      'Value: "<email>", and <email>',
    );
  });
});

describe("grantOutcome", () => {
  it("reports a granted role", () => {
    expect(grantOutcome(0, '{\n  "changed": true\n}\n', "")).toEqual({
      ok: true,
      message: "Granted: that user is now an admin.",
    });
  });

  it("reports a user who is already an admin", () => {
    expect(grantOutcome(0, '{\n  "changed": false\n}\n', "")).toEqual({
      ok: true,
      message: "That user is already an admin.",
    });
  });

  it("shows only the message of a function error", () => {
    const stderr = [
      'Failed to run function "users:grantRole":',
      "Error: [Request ID: 1a2b] Server Error",
      'Uncaught ConvexError: {"code":"NOT_FOUND","message":"No user with that email has signed in yet. They need to sign in once first."}',
      "    at setRoleByEmail (../../convex/model/users.ts:103:5)",
    ].join("\n");

    expect(grantOutcome(1, "", stderr)).toEqual({
      ok: false,
      message: "No user with that email has signed in yet. They need to sign in once first.",
    });
  });

  it("passes on any other failure with emails redacted", () => {
    const stderr = "Local backend isn't running. Value: sam@example.com";

    expect(grantOutcome(1, "", stderr)).toEqual({
      ok: false,
      message: "Local backend isn't running. Value: <email>",
    });
  });

  it("treats unexpected output as a failure", () => {
    expect(grantOutcome(0, "sam@example.com", "").ok).toBe(false);
    expect(grantOutcome(0, "sam@example.com", "").message).not.toContain("sam@");
  });

  it("explains a failure without output", () => {
    expect(grantOutcome(null, "", "")).toEqual({
      ok: false,
      message: "The Convex CLI failed without a message.",
    });
  });
});
