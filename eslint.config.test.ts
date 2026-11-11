import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Lints fixture code at fixture paths with the project's real ESLint config, so the test proves
// what `npm run lint` would report for a file at that path.
const eslint = new ESLint({ cwd: import.meta.dirname });

async function restrictedImports(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.ruleId === "no-restricted-imports")
    .map((message) => message.message);
}

describe("eslint.config.mjs › raw Convex builders (ADR-002)", () => {
  it.each([
    { filePath: "convex/tools.ts", code: `import { query } from "./_generated/server";` },
    { filePath: "convex/loans.ts", code: `import { mutation } from "./_generated/server";` },
    { filePath: "convex/automation.ts", code: `import { action } from "./_generated/server";` },
    { filePath: "convex/model/tools.ts", code: `import { query } from "../_generated/server";` },
    {
      filePath: "convex/admin.ts",
      code: `import { query as q, mutation } from "./_generated/server";`,
    },
    { filePath: "convex/tools.ts", code: `import * as server from "./_generated/server";` },
    { filePath: "convex/tools.ts", code: `export { query } from "./_generated/server";` },
    {
      filePath: "src/features/tools/tool-list.tsx",
      code: `import { query } from "../../../convex/_generated/server";`,
    },
  ])("reports $code in $filePath", async ({ filePath, code }) => {
    const messages = await restrictedImports(filePath, code);

    expect(messages).not.toHaveLength(0);
    expect(messages.join("\n")).toContain("convex/lib/functions.ts");
  });

  it.each([
    {
      filePath: "convex/lib/functions.ts",
      code: `import { action, mutation, query } from "../_generated/server";`,
    },
    { filePath: "convex/tools.ts", code: `import { userQuery } from "./lib/functions";` },
    {
      filePath: "convex/crons.ts",
      code: `import { internalMutation } from "./_generated/server";`,
    },
    { filePath: "convex/http.ts", code: `import { httpAction } from "./_generated/server";` },
    {
      filePath: "convex/model/tools.ts",
      code: `import type { QueryCtx } from "../_generated/server";`,
    },
  ])("allows $code in $filePath", async ({ filePath, code }) => {
    expect(await restrictedImports(filePath, code)).toEqual([]);
  });
});
