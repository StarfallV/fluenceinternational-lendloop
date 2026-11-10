#!/usr/bin/env node
// PreToolUse guard for the tools that run shell commands (Bash, PowerShell, Monitor): blocks a
// command that names a secret file or prints secrets another way. The matching lives in
// secret-names.mjs. A best-effort guardrail for agents (docs/security.md §5), not a security
// boundary.
import { readFileSync } from "node:fs";

import { findSecretAccess } from "./secret-names.mjs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (error) {
  // Fail open, but visibly: unreadable input is a Claude Code protocol problem, and blocking every
  // command would lock up the session. The static deny rules in settings.json still apply.
  console.error(`guard-secrets: unreadable hook input (${error.message}); command allowed.`);
  process.exit(1);
}

const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";

let reason;
try {
  reason = findSecretAccess(command);
} catch (error) {
  // Fail closed: if the matching itself breaks, the command doesn't run unchecked.
  reason = `the secret guard failed (${error.message})`;
}

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
