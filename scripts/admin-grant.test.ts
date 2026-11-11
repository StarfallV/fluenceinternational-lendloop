import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const script = fileURLToPath(new URL("./admin-grant.ts", import.meta.url));

function run(args: string[]) {
  return spawnSync(process.execPath, [tsxCli, script, ...args], { encoding: "utf8" });
}

// Only the argument checks run here: a real grant needs a running Convex deployment, so it is a
// recorded manual check (block 002's completion log).
describe("npm run admin:grant", () => {
  it.each([
    { case: "no argument", args: [] },
    { case: "two arguments", args: ["sam@example.com", "alex@example.com"] },
    { case: "an argument that is not an email", args: ["sam"] },
  ])("exits 1 with the usage for $case, before starting the Convex CLI", ({ args }) => {
    const result = run(args);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: npm run admin:grant -- <email");
    expect(result.stdout).toBe("");
  });
});
