import { describe, expect, it } from "vitest";

describe("convex test project", () => {
  it("runs in the edge runtime, like the Convex backend", () => {
    expect(Reflect.get(globalThis, "EdgeRuntime")).toBe("edge-runtime");
  });
});
