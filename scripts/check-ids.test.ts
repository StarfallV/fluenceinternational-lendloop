import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const script = fileURLToPath(new URL("./check-ids.ts", import.meta.url));

function runIn(fixtureName: string) {
  const cwd = fileURLToPath(new URL(`./fixtures/check-ids/${fixtureName}`, import.meta.url));
  return spawnSync(process.execPath, [tsxCli, script], { cwd, encoding: "utf8" });
}

describe("npm run check:ids", () => {
  it("exits 0 when every identifier is defined once", () => {
    const run = runIn("clean");

    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no duplicates");
  });

  it.each(["duplicate-td", "duplicate-adr", "duplicate-bug", "duplicate-block"])(
    "exits 1 and names the duplicate for %s",
    (fixtureName) => {
      const run = runIn(fixtureName);

      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/is defined 2 times/);
    },
  );
});
