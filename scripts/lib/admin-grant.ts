// The logic behind `npm run admin:grant -- <email>` (BR-18, ADR-002), apart from the CLI so it can
// be tested without a Convex deployment.

export const USAGE = "Usage: npm run admin:grant -- <email of a user who has signed in once>";

/** The email from the script's arguments, or a message saying what is wrong with them. */
export function parseEmailArgument(argv: readonly string[]): { email: string } | { error: string } {
  if (argv.length !== 1) {
    return { error: USAGE };
  }
  const email = argv[0].trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    return { error: `That is not an email address. ${USAGE}` };
  }
  return { email };
}

/**
 * The Convex CLI's arguments. The JSON is built here, so no shell has to quote it: Windows
 * PowerShell 5.1 strips the quotes from a JSON argument.
 */
export function convexRunArgs(email: string): string[] {
  return ["run", "users:grantRole", JSON.stringify({ email, role: "admin" })];
}

const EMAIL_SHAPED = /[^\s"'<>()[\]{},;:]+@[^\s"'<>()[\]{},;:]+/g;

/** Replaces anything shaped like an email address, so the script never prints one. */
export function redactEmails(text: string): string {
  return text.replace(EMAIL_SHAPED, "<email>");
}

// How a function's ConvexError({ code, message }) appears in the CLI's error output.
const APP_ERROR = /\{"code":"[A-Z_]+","message":("(?:[^"\\]|\\.)*")\}/;

function appErrorMessage(stderr: string): string | null {
  const match = APP_ERROR.exec(stderr);
  if (match === null) {
    return null;
  }
  const message: unknown = JSON.parse(match[1]);
  return typeof message === "string" ? message : null;
}

function changedFlag(stdout: string): boolean | null {
  try {
    const result: unknown = JSON.parse(stdout);
    const changed: unknown =
      typeof result === "object" && result !== null ? Reflect.get(result, "changed") : undefined;
    return typeof changed === "boolean" ? changed : null;
  } catch {
    return null;
  }
}

/** The outcome to report, from the Convex CLI's exit status and output. */
export function grantOutcome(
  status: number | null,
  stdout: string,
  stderr: string,
): { ok: boolean; message: string } {
  if (status === 0) {
    const changed = changedFlag(stdout.trim());
    if (changed !== null) {
      return {
        ok: true,
        message: changed ? "Granted: that user is now an admin." : "That user is already an admin.",
      };
    }
    return {
      ok: false,
      message: `Unexpected output from the Convex CLI:\n${redactEmails(stdout)}`,
    };
  }
  const message = appErrorMessage(stderr) ?? stderr.trim();
  return {
    ok: false,
    message: redactEmails(message === "" ? "The Convex CLI failed without a message." : message),
  };
}
