import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const hook = fileURLToPath(new URL("./guard-secrets.mjs", import.meta.url));

// Runs the hook the way Claude Code does: the tool call as JSON on stdin.
function runHook(input) {
  return spawnSync(process.execPath, [hook], { input, encoding: "utf8" });
}

function toolCall(toolName, command) {
  return JSON.stringify({ tool_name: toolName, tool_input: { command } });
}

describe("guard-secrets hook", () => {
  it.each(["Bash", "PowerShell", "Monitor"])(
    "denies a %s command that names a secret file",
    (tool) => {
      const run = runHook(toolCall(tool, "cat .env.n8n"));

      expect(run.status).toBe(0);
      const output = JSON.parse(run.stdout).hookSpecificOutput;
      expect(output.hookEventName).toBe("PreToolUse");
      expect(output.permissionDecision).toBe("deny");
      expect(output.permissionDecisionReason).toContain(".env.n8n");
    },
  );

  it("denies a command that prints secrets without naming a file", () => {
    const run = runHook(toolCall("Bash", "docker compose exec n8n printenv"));

    expect(JSON.parse(run.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("allows a harmless command with no output", () => {
    const run = runHook(toolCall("Bash", "npm test"));

    expect(run.status).toBe(0);
    expect(run.stdout).toBe("");
  });

  it("fails open with a warning when its input is unreadable", () => {
    const run = runHook("not json");

    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("guard-secrets");
  });

  it("fails open with a warning when the tool call has no command", () => {
    const run = runHook(JSON.stringify({ tool_name: "Bash", tool_input: { cmd: "cat .env" } }));

    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("no command field");
  });

  it("allows a Monitor WebSocket watch, which runs no command, without a warning", () => {
    const input = { tool_name: "Monitor", tool_input: { ws: { url: "wss://example.test/feed" } } };

    const run = runHook(JSON.stringify(input));

    expect(run.status).toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toBe("");
  });
});
