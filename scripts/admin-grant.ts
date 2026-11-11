// npm run admin:grant -- <email>: makes a user who has signed in at least once an admin, through
// the internal users:grantRole (BR-18). Run it while `npx convex dev` is running. It never prints
// the email.
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { convexRunArgs, grantOutcome, parseEmailArgument } from "./lib/admin-grant";

const parsed = parseEmailArgument(process.argv.slice(2));
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(1);
}

// The CLI's Node entry point rather than `npx`, which can't be spawned without a shell on Windows.
const convexCli = join(process.cwd(), "node_modules", "convex", "bin", "main.js");
const run = spawnSync(process.execPath, [convexCli, ...convexRunArgs(parsed.email)], {
  encoding: "utf8",
});
if (run.error !== undefined) {
  console.error(`Could not start the Convex CLI (${run.error.message}). Run \`npm ci\` first.`);
  process.exit(1);
}

const outcome = grantOutcome(run.status, run.stdout, run.stderr);
if (outcome.ok) {
  console.log(outcome.message);
} else {
  console.error(outcome.message);
  process.exitCode = 1;
}
