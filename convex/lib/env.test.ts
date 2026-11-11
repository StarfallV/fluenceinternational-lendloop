import { afterEach, describe, expect, it, vi } from "vitest";

import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a variable that is set", () => {
    vi.stubEnv("LENDLOOP_TEST_VARIABLE", "value");

    expect(requireEnv("LENDLOOP_TEST_VARIABLE")).toBe("value");
  });

  it.each([
    { state: "missing", value: undefined },
    { state: "blank", value: "  " },
  ])("fails with a message that names a $state variable", ({ value }) => {
    vi.stubEnv("LENDLOOP_TEST_VARIABLE", value);

    expect(() => requireEnv("LENDLOOP_TEST_VARIABLE")).toThrow(
      /LENDLOOP_TEST_VARIABLE is not set.*npx convex env set LENDLOOP_TEST_VARIABLE/,
    );
  });
});
