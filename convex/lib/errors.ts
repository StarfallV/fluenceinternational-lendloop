import { ConvexError } from "convex/values";

/** Error codes every Convex function throws with (architecture.md §5.1). The UI maps each to a message. */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppErrorData = { code: ErrorCode; message: string };

/** A `ConvexError` with a code and a message that is safe to show the user. */
export function appError(code: ErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}

function isErrorCode(value: unknown): value is ErrorCode {
  return ERROR_CODES.some((code) => code === value);
}

/** The code and message of an error thrown with `appError`, or `null` for any other error. */
export function appErrorData(error: unknown): AppErrorData | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null) return null;
  const code: unknown = Reflect.get(data, "code");
  const message: unknown = Reflect.get(data, "message");
  if (!isErrorCode(code) || typeof message !== "string") return null;
  return { code, message };
}
