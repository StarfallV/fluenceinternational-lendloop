import { v, type Infer } from "convex/values";

import { appError } from "./errors";

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));
export type Role = Infer<typeof roleValidator>;

/** The `auditLog` actions (architecture.md §4). */
export const auditActionValidator = v.union(
  v.literal("tool.removed"),
  v.literal("user.trusted"),
  v.literal("user.untrusted"),
  v.literal("user.role_changed"),
  v.literal("outbox.retried"),
  v.literal("outbox.retried_all"),
);
export type AuditAction = Infer<typeof auditActionValidator>;

// Control characters (Unicode Cc, which includes \n, \r and \t), the Unicode line and paragraph
// separators, and the bidirectional controls that can make text display in another order than it
// is stored (BR-3, BR-16).
const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u;
const CONTROL_CHARACTERS = new RegExp(CONTROL_CHARACTER.source, "gu");

/** Length in Unicode code points, so an emoji counts once, as it does for the user. */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

/**
 * Cleans text that comes from an identity provider rather than from a form: control characters
 * become spaces, runs of whitespace collapse to one space, and the ends are trimmed.
 */
export function stripControlCharacters(text: string): string {
  return text.replace(CONTROL_CHARACTERS, " ").replace(/\s+/gu, " ").trim();
}

/**
 * Validates single-line user input (BR-3): trimmed, within the length limits, and free of control
 * characters such as line breaks. Returns the trimmed text, or throws `VALIDATION`.
 */
export function singleLineText(
  value: string,
  field: string,
  limits: { min: number; max: number },
): string {
  const text = value.trim();
  if (CONTROL_CHARACTER.test(text)) {
    throw appError("VALIDATION", `${field} must be a single line of text.`);
  }
  const length = codePointLength(text);
  if (length < limits.min || length > limits.max) {
    throw appError(
      "VALIDATION",
      `${field} must be ${limits.min} to ${limits.max} characters long.`,
    );
  }
  return text;
}
