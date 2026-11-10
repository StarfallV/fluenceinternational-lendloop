#!/usr/bin/env node
// PreToolUse guard for Bash and PowerShell: blocks any command that names a secret file.
// Secret files: `.env`, `.env.<anything>` except the committed `*.example` templates, and
// anything under `.secrets`. A best-effort guardrail for agents (docs/security.md §5), not a
// security boundary.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A name starts at a path or word boundary (so `process.env` and `$env:X` don't match) and
// ends where the name ends (so `.envrc` doesn't match).
const SECRET_NAME = /(?<![\w$.-])\.(?:env(?:\.[\w-]+)*|secrets)(?![\w-])/g;

/** The secret file names a command mentions, or an empty array. */
export function secretNamesIn(command) {
  const names = [];
  for (const match of command.matchAll(SECRET_NAME)) {
    const name = match[0];
    if (name.startsWith(".env") && name.endsWith(".example")) continue;
    names.push(name);
  }
  return names;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch (error) {
    // Fail open, but loudly: a broken guard must not lock up the session. The static deny rules
    // in settings.json still apply.
    console.error(`guard-secrets: unreadable hook input (${error.message}); command allowed.`);
    process.exit(1);
  }
  const command = typeof input?.tool_input?.command === "string" ? input.tool_input.command : "";
  const names = [...new Set(secretNamesIn(command))];
  if (names.length === 0) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Blocked: the command names a secret file (${names.join(", ")}). Secret files are ` +
          "never read or printed (CLAUDE.md). If only the command's text mentions the name, " +
          "for example a commit message, put that text in a file (git commit -F <file>).",
      },
    }),
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main();
