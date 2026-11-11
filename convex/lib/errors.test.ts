import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { appError, appErrorData } from "./errors";

describe("appErrorData", () => {
  it("reads the code and message of an appError", () => {
    expect(appErrorData(appError("FORBIDDEN", "Only admins can do that."))).toEqual({
      code: "FORBIDDEN",
      message: "Only admins can do that.",
    });
  });

  it.each([
    { kind: "a plain Error", error: new Error("boom") },
    { kind: "a ConvexError with a string", error: new ConvexError("boom") },
    {
      kind: "a ConvexError with an unknown code",
      error: new ConvexError({ code: "X", message: "" }),
    },
    { kind: "a ConvexError without a message", error: new ConvexError({ code: "FORBIDDEN" }) },
    { kind: "a non-error value", error: "boom" },
  ])("returns null for $kind", ({ error }) => {
    expect(appErrorData(error)).toBeNull();
  });
});
