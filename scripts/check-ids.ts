// npm run check:ids: fails when a TD, ADR or BUG identifier, or a block number, is defined twice
// under docs/ (tech-debt-and-bugs rule).
import { join } from "node:path";

import { checkIds } from "./lib/check-ids";

const { definitions, duplicates, problems } = checkIds(join(process.cwd(), "docs"));

for (const [id, where] of duplicates) {
  console.error(`${id} is defined ${where.length} times: ${where.join(", ")}`);
}
for (const problem of problems) {
  console.error(problem);
}

if (duplicates.size > 0 || problems.length > 0) {
  process.exitCode = 1;
} else {
  const kinds = ["TD", "ADR", "BUG", "block"].map(
    (kind) => `${definitions.filter((d) => d.id.startsWith(kind)).length} ${kind}`,
  );
  console.log(`check:ids: no duplicates (${kinds.join(", ")}).`);
}
