// Matching logic for the secret guard (guard-secrets.mjs). Pure functions, so they can be tested.
// Secret files are `.env`, `.env.<anything>` except the committed `*.example` templates, and
// anything under `.secrets`. The cases are listed in docs/security.md §5.

// A name starts at a path or word boundary (so `process.env` and `$env:X` don't match) and ends
// where the name ends (so `.envrc` doesn't). NTFS is case-insensitive, so the match is too.
const SECRET_NAME = /(?<![\w$.-])\.(?:env(?:\.[\w-]+)*|secrets)(?![\w-])/gi;
const TEMPLATE = /^\.env(?:\.[\w-]+)*\.example$/i;

// Commands that print secrets without naming a secret file. `[^|;&]*` keeps each match inside
// one command of a pipeline or command list.
const LEAKY_COMMANDS = [
  {
    pattern: /\bdocker(?:-compose|\s+compose)\b[^|;&]*\sconfig\b(?![^|;&]*--no-env-resolution)/i,
    reason: "`docker compose config` prints the resolved env files; add --no-env-resolution",
  },
  {
    pattern: /\bdocker(?:\s+compose|\s+container)?\s+exec\b[^|;&]*\s(?:printenv|env)\b/i,
    reason: "the command dumps a container's environment, which holds secrets",
  },
  {
    pattern: /\bdocker(?:\s+container)?\s+inspect\b/i,
    reason: "`docker inspect` prints a container's environment, which holds secrets",
  },
  {
    // GNU grep ignores .gitignore, so a recursive search reads the secret files.
    pattern: /\b[ef]?grep\b[^|;&]*\s(?:-[a-z]*r[a-z]*|--(?:dereference-)?recursive)(?=\s|$)/i,
    reason: "a recursive grep reads the gitignored secret files; use the Grep tool",
  },
  {
    pattern: /\brg\b[^|;&]*\s(?:-u+|--no-ignore\S*)(?=\s|$)/i,
    reason: "ripgrep without its ignore rules reads the secret files; use the Grep tool",
  },
  {
    pattern:
      /-Recurse\b[^;]*\b(?:Select-String|Get-Content|gc|cat|type)\b|\b(?:Select-String|Get-Content)\b[^;]*-Recurse\b/i,
    reason: "a recursive PowerShell read reaches the secret files; use the Grep tool",
  },
  {
    pattern: /\bfindstr\b[^|;&]*\s\/s\b/i,
    reason: "a recursive findstr reads the secret files; use the Grep tool",
  },
  {
    pattern: /\bconvex\b[^|;&]*\benv\s+(?:list|get)\b/i,
    reason: "`convex env list` and `convex env get` print Convex secrets",
  },
];

/**
 * The secret file names a command mentions, or an empty array.
 * @param {string} command
 * @returns {string[]}
 */
export function secretNamesIn(command) {
  return [...command.matchAll(SECRET_NAME)].map((m) => m[0]).filter((name) => !TEMPLATE.test(name));
}

/**
 * Why a command must not run, or null when it may.
 * @param {string} command
 * @returns {string | null}
 */
export function findSecretAccess(command) {
  const names = [...new Set(secretNamesIn(command))];
  if (names.length > 0) return `the command names a secret file (${names.join(", ")})`;
  const leak = LEAKY_COMMANDS.find(({ pattern }) => pattern.test(command));
  return leak ? leak.reason : null;
}
