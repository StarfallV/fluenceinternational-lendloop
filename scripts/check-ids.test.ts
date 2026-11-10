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

function runOutsideTheRepository() {
  const cwd = fileURLToPath(new URL("./fixtures/check-ids/", import.meta.url));
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

  it("exits 1 and names an ADR file titled with another number", () => {
    const run = runIn("mistitled-adr");

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("adr/ADR-002-misnamed.md is titled ADR-001");
  });

  it("exits 1 when the docs define no identifiers", () => {
    const run = runIn("no-identifiers");

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no identifiers found");
  });

  it("exits 1 when run from a directory without docs/", () => {
    const run = runOutsideTheRepository();

    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("run check:ids from the repository root");
  });
});
