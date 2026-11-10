import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectDir = fileURLToPath(new URL("../..", import.meta.url));
const settings = JSON.parse(
  readFileSync(fileURLToPath(new URL("../settings.json", import.meta.url)), "utf8"),
);
const hookFile = fileURLToPath(new URL("./guard-secrets.mjs", import.meta.url));

const guardEntries = (settings.hooks?.PreToolUse ?? []).filter((entry) =>
  (entry.hooks ?? []).some((hook) => hook.args?.some((arg) => arg.endsWith("guard-secrets.mjs"))),
);

describe(".claude/settings.json", () => {
  it("registers the secret guard once, in exec form", () => {
    expect(guardEntries).toHaveLength(1);
    const [hook] = guardEntries[0].hooks;

    expect(hook.type).toBe("command");
    expect(hook.command).toBe("node");
    expect(hook.args).toEqual(["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-secrets.mjs"]);
  });

  it.each(["Bash", "PowerShell", "Monitor"])("runs the guard before every %s call", (tool) => {
    const matcher = new RegExp(`^(?:${guardEntries[0].matcher})$`);

    expect(matcher.test(tool)).toBe(true);
  });

  it("points the guard at the hook file once CLAUDE_PROJECT_DIR is substituted", () => {
    const [arg] = guardEntries[0].hooks[0].args;

    const path = arg.replace("${CLAUDE_PROJECT_DIR}", projectDir);

    expect(existsSync(path)).toBe(true);
    expect(realpathSync(path)).toBe(realpathSync(hookFile));
  });

  it.each(["/.env", "/.env.local", "/.env.*.local", "/.env.n8n", "/.secrets/**"])(
    "denies reading and editing %s",
    (path) => {
      const deny = settings.permissions?.deny ?? [];

      expect(deny).toContain(`Read(${path})`);
      expect(deny).toContain(`Edit(${path})`);
    },
  );
});
