// Matching logic for the secret guard (guard-secrets.mjs). Pure functions, so they can be tested.
// Secret files are `.env`, `.env.<anything>` except the committed `*.example` templates, and
// anything under `.secrets`. The cases are listed in docs/security.md §5.

// A name starts at a path or word boundary (so `process.env` and `$env:X` don't match) and ends
// where the name ends (so `.envrc` doesn't). NTFS is case-insensitive, so the match is too.
const SECRET_NAME = /(?<![\w$.-])\.(?:env(?:\.[\w-]+)*|secrets)(?![\w-])/gi;
const TEMPLATE = /^\.env(?:\.[\w-]+)*\.example$/i;

// Commands that print secrets without naming a secret file. `[^|;&]*` keeps each match inside
// one command of a pipeline or command list.
const PS_READER = String.raw`\b(?:Select-String|sls|Get-Content|gc|cat|type)\b`;

// `docker`, `docker-compose`, `docker compose` or `docker container`, with any options before the
// subcommand (`-f compose.yml`, `-p lendloop`, `--context x`).
const docker = (subcommands) => String.raw`\bdocker(?:-compose)?\b[^|;&]*?\s(?:${subcommands})\b`;
// After `docker … exec|run`, the rest of the whole command: the separators inside an `sh -c`
// script don't end it. A host command chained after it is over-blocked, which is acceptable.
const REST = String.raw`[\s\S]*?`;
// Where a command word starts: whitespace, `=` (`--entrypoint=env`), a quote, `$(`, or a
// separator inside a script.
const WORD_START = String.raw`[\s='"(;&|]`;

const LEAKY_COMMANDS = [
  {
    // `convert` is Compose v2's alias of `config`.
    pattern:
      /\bdocker(?:-compose|\s+compose)\b[^|;&]*\s(?:config|convert)\b(?![^|;&]*--no-env-resolution)/i,
    reason: "`docker compose config` prints the resolved env files; add --no-env-resolution",
  },
  {
    // A container's whole environment: `printenv`, `env` or `/proc/<pid>/environ`, by name or by
    // path (but not `env:names` or an `env/` directory), or the shell's own listings: a bare
    // `set` or `export`, `export -p`, `declare` and `typeset`.
    pattern: new RegExp(
      docker("exec|run") +
        REST +
        String.raw`(?:${WORD_START}(?:\S*\/)?(?:printenv|env|environ)\b(?![:/.-])` +
        String.raw`|${WORD_START}(?:set|export)\s*(?:-p\b|(?=$|['");&|]))` +
        String.raw`|\b(?:declare|typeset)\b)`,
      "i",
    ),
    reason: "the command dumps a container's environment, which holds secrets",
  },
  {
    // One secret inside a container: a signing secret or the encryption key by variable name
    // (`ENCRYPTION_KEY` also covers `$N8N_ENCRYPTION_KEY_FILE`, the key file's path),
    // `process.env`, and n8n's ~/.n8n/config, which holds the key. A decrypted export prints
    // every credential.
    pattern: new RegExp(
      docker("exec|run|cp") +
        REST +
        String.raw`(?:SIGNING_SECRET|ENCRYPTION_KEY|\bprocess\.env\b|\.n8n[\\/]config\b)` +
        String.raw`|\bexport:credentials\b[^|;&]*--decrypted\b`,
      "i",
    ),
    reason:
      "the command reads a secret inside a container (a signing secret, n8n's encryption key or its credentials)",
  },
  {
    pattern: new RegExp(docker("inspect"), "i"),
    reason: "`docker inspect` prints a container's environment, which holds secrets",
  },
  {
    // GNU grep ignores .gitignore, so a recursive search reads the secret files. Long options may
    // be abbreviated, and `rgrep` is `grep -r`.
    pattern:
      /\brgrep\b|\b[ef]?grep\b[^|;&]*\s(?:-[a-z]*r[a-z]*|--(?:dereference-)?rec\w*|--dir\w*[=\s]+rec\w*|-d\s*rec\w*)(?=\s|$)/i,
    reason: "a recursive grep reads the gitignored secret files; use the Grep tool",
  },
  {
    // Case-sensitive: any lowercase `u` in a short-flag cluster disables the ignore rules, while
    // `-U` is multiline mode.
    pattern: /\brg\b[^|;&]*\s(?:-[A-Za-z]*u[A-Za-z]*|--unrestricted|--no-ignore\S*)(?=\s|$)/,
    reason: "ripgrep without its ignore rules reads the secret files; use the Grep tool",
  },
  {
    // Without the index, git grep doesn't apply .gitignore.
    pattern: /\bgit\b[^|;&]*\sgrep\b[^|;&]*\s--no-(?:index|exclude-standard)\b/i,
    reason: "git grep outside the index reads the gitignored secret files; use the Grep tool",
  },
  {
    // `-Recurse` before or after a reader, or Get-ChildItem's abbreviations (`-r`, `-rec`) and
    // `-Depth` before one.
    pattern: new RegExp(
      [
        String.raw`-Recurse\b[^;]*${PS_READER}`,
        String.raw`\b(?:Select-String|sls|Get-Content|gc)\b[^;]*-Recurse\b`,
        String.raw`\b(?:Get-ChildItem|gci|ls|dir)\b[^|;]*\s-(?:r\w*|Depth)\b[^;]*${PS_READER}`,
      ].join("|"),
      "i",
    ),
    reason: "a recursive PowerShell read reaches the secret files; use the Grep tool",
  },
  {
    // findstr switches combine (`/si`, `/s/i`).
    pattern: /\bfindstr\b[^|;&]*\s\/[a-z/]*s[a-z/]*\b/i,
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
