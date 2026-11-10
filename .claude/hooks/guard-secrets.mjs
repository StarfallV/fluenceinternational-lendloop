#!/usr/bin/env node
// PreToolUse guard for the tools that run shell commands (Bash, PowerShell, Monitor): blocks a
// command that names a secret file or prints secrets another way. The matching lives in
// secret-names.mjs. A best-effort guardrail for agents (docs/security.md §5), not a security
// boundary.
import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (error) {
  // Fail open, but visibly: unreadable input is a Claude Code protocol problem, and blocking every
  // command would lock up the session. The static deny rules in settings.json still apply.
  console.error(`guard-secrets: unreadable hook input (${error.message}); command allowed.`);
  process.exit(1);
}

const toolInput = input?.tool_input;
const command = toolInput?.command;
if (typeof command !== "string") {
  // Monitor's WebSocket form runs no shell command, so there is nothing to check.
  if (typeof toolInput?.ws === "object" && toolInput.ws !== null) process.exit(0);
  // Any other call without a command means the protocol changed: allow it, but visibly.
  console.error("guard-secrets: the tool call has no command field; command allowed unchecked.");
  process.exit(1);
}

// Fail closed from here on: if the matcher can't load or throws, the command doesn't run
// unchecked. It is loaded dynamically, because a static import that fails (a broken pattern)
// would crash the hook, which Claude Code treats as a non-blocking error.
async function denialReason() {
  let findSecretAccess;
  try {
    ({ findSecretAccess } = await import("./secret-names.mjs"));
  } catch (error) {
    return `the secret guard's matcher failed to load (${error.message})`;
  }
  try {
    return findSecretAccess(command);
  } catch (error) {
    return `the secret guard failed (${error.message})`;
  }
}

const reason = await denialReason();

if (reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Blocked: ${reason}. Secret files and values are never read or printed (CLAUDE.md). ` +
          "If only the command's text mentions a secret file, for example a commit message, " +
          "put that text in a file (git commit -F <file>).",
      },
    }),
  );
}
