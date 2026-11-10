import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkIds } from "./check-ids";

function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/check-ids/${name}/docs`, import.meta.url));
}

describe("checkIds", () => {
  it("passes when every identifier is defined once", () => {
    const report = checkIds(fixture("clean"));

    expect(report.duplicates.size).toBe(0);
    expect(report.problems).toEqual([]);
    expect(report.definitions.map((d) => d.id).sort()).toEqual([
      "ADR-001",
      "ADR-002",
      "BUG-001",
      "TD-001",
      "TD-002",
      "block 001",
      "block 002",
    ]);
  });

  it.each([
    ["duplicate-td", "TD-001", ["tech-debt.md:3", "tech-debt.md:7"]],
    ["duplicate-adr", "ADR-001", ["adr/ADR-001-first.md", "adr/ADR-001-second.md"]],
    ["duplicate-bug", "BUG-001", ["bugs/BUG-001-first.md", "bugs/BUG-001-second.md"]],
    ["duplicate-block", "block 001", ["blocks/001-first.md", "blocks/001-second.md"]],
  ])("reports %s with every location", (name, id, locations) => {
    const report = checkIds(fixture(name));

    expect([...report.duplicates]).toEqual([[id, locations]]);
  });

  it("reports an ADR file whose title names another number", () => {
    const report = checkIds(fixture("mistitled-adr"));

    expect(report.problems).toEqual(["adr/ADR-002-misnamed.md is titled ADR-001"]);
  });

  it("passes on this repository's docs", () => {
    const report = checkIds(fileURLToPath(new URL("../../docs", import.meta.url)));

    expect(report.duplicates.size).toBe(0);
    expect(report.problems).toEqual([]);
  });
});
