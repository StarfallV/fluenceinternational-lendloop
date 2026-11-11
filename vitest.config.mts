import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "*.test.ts",
            "scripts/**/*.test.ts",
            "src/**/*.test.ts",
            ".claude/hooks/**/*.test.mjs",
          ],
        },
      },
      {
        test: {
          name: "convex",
          // convex-test runs Convex functions in the edge runtime, like the Convex backend.
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          server: { deps: { inline: ["convex-test"] } },
        },
      },
    ],
  },
});
