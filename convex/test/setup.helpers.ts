/// <reference types="vite/client" />
// Shared by the convex-test suites. The two-dot file name keeps Convex from deploying it.
import { convexTest, type TestConvex } from "convex-test";
import { expect } from "vitest";

import { appErrorData, type ErrorCode } from "../lib/errors";
import schema from "../schema";

// Every Convex module, loaded on demand. `*.*s` also matches the `_generated/*.js` files.
const modules = import.meta.glob("../**/*.*s");

export type Test = TestConvex<typeof schema>;

/** A fresh in-memory Convex backend with this app's schema and functions. */
export function newTest(): Test {
  return convexTest(schema, modules);
}

/** Asserts that a call fails with an `appError` of the given code. */
export async function expectAppError(call: Promise<unknown>, code: ErrorCode): Promise<void> {
  const error = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error, "the call should have failed").not.toBeNull();
  expect(appErrorData(error)?.code).toBe(code);
}
