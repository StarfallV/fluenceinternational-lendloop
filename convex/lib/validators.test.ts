import { describe, expect, it } from "vitest";

import { expectAppError } from "../test/setup.helpers";
import { codePointLength, singleLineText, stripControlCharacters } from "./validators";

// Written as escapes, so the test source itself contains no invisible characters.
const CONTROL_SAMPLES = [
  { kind: "a line feed", char: "\n" },
  { kind: "a carriage return", char: "\r" },
  { kind: "a tab", char: "\t" },
  { kind: "a NUL", char: "\u0000" },
  { kind: "DEL", char: "\u007F" },
  { kind: "a C1 control", char: "\u0085" },
  { kind: "the Unicode line separator", char: "\u2028" },
  { kind: "the Unicode paragraph separator", char: "\u2029" },
  { kind: "a right-to-left override", char: "\u202E" },
  { kind: "a bidirectional isolate", char: "\u2066" },
];

describe("stripControlCharacters", () => {
  it.each(CONTROL_SAMPLES)("replaces $kind with a space", ({ char }) => {
    expect(stripControlCharacters(`Mary${char}Jane`)).toBe("Mary Jane");
  });

  it("collapses runs of whitespace and trims the ends", () => {
    expect(stripControlCharacters("  Mary \r\n\t Jane  ")).toBe("Mary Jane");
  });

  it("keeps letters, accents and emoji", () => {
    expect(stripControlCharacters("Zoë 🙂 Ødegård")).toBe("Zoë 🙂 Ødegård");
  });
});

describe("singleLineText", () => {
  const limits = { min: 2, max: 10 };

  it("returns the trimmed text", () => {
    expect(singleLineText("  Drill  ", "Name", limits)).toBe("Drill");
  });

  it.each(CONTROL_SAMPLES)("rejects text containing $kind with VALIDATION", async ({ char }) => {
    await expectAppError(
      Promise.resolve().then(() => singleLineText(`Dr${char}ill`, "Name", limits)),
      "VALIDATION",
    );
  });

  it.each([
    { length: 1, accepted: false },
    { length: 2, accepted: true },
    { length: 10, accepted: true },
    { length: 11, accepted: false },
  ])("treats $length characters as accepted: $accepted", async ({ length, accepted }) => {
    const call = Promise.resolve().then(() => singleLineText("a".repeat(length), "Name", limits));

    if (accepted) {
      await expect(call).resolves.toHaveLength(length);
    } else {
      await expectAppError(call, "VALIDATION");
    }
  });

  it("rejects text that is blank once trimmed", async () => {
    await expectAppError(
      Promise.resolve().then(() => singleLineText("   ", "Name", limits)),
      "VALIDATION",
    );
  });

  it("counts an emoji as one character", () => {
    expect(singleLineText("🔨🔨", "Name", limits)).toBe("🔨🔨");
  });
});

describe("codePointLength", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(codePointLength("🔨a")).toBe(2);
  });
});
