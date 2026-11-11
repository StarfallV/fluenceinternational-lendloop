/**
 * Validated access to the Convex deployment's environment variables. Every Convex module reads
 * them through here, except `auth.config.ts`, which Convex evaluates on its own at push time.
 */

/** Returns a required variable, or fails with a message that names it but never shows a value. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `The Convex environment variable ${name} is not set. Set it with \`npx convex env set ${name} <value>\`.`,
    );
  }
  return value;
}
