// Matching logic for the secret guard (guard-secrets.mjs). Pure functions, so they can be tested.
// Secret files are `.env`, `.env.<anything>` except the committed `*.example` templates, and
// anything under `.secrets`. The cases are listed in docs/security.md §5.

// A name starts at a path or word boundary (so `process.env` and `$env:X` don't match) and ends
// where the name ends (so `.envrc` doesn't). NTFS is case-insensitive, so the match is too.
const SECRET_NAME = /(?<![\w$.-])\.(?:env(?:\.[\w-]+)*|secrets)(?![\w-])/gi;
const TEMPLATE = /^\.env(?:\.[\w-]+)*\.example$/i;

// Longer commands are denied unchecked: the hook must decide well inside its 10 s timeout,
// because a hook that times out lets the command run.
export const MAX_COMMAND_LENGTH = 64 * 1024;

// --- Commands run in a container ---------------------------------------------------------------
// Checked word by word, in one linear pass, rather than with backtracking patterns.

// Words end at whitespace, quotes, `=`, brackets, backticks, backslashes, redirections and shell
// separators, so `--entrypoint=env`, `$(printenv)`, `` `env` `` and `\env` all yield a bare word.
const WORD_BREAK = /([\s='"(){};&|`\\<>]+)/;
// What ends a simple command, for tying a subcommand to the `docker` before it.
const COMMAND_SEPARATOR = /[|;&]/;
// What may follow a bare `set` or `export`: the end of a command, a quote or a redirection.
const END_OF_ARGUMENTS = /[\n;&|)`'"<>]/;
const DOCKER_SUBCOMMANDS = new Set(["exec", "run", "cp", "inspect"]);
// `env`, `printenv` and `/proc/<pid>/environ` by name or path, and the shell's own listings.
const ENVIRONMENT_DUMPS = new Set(["env", "printenv", "environ", "declare", "typeset"]);

/** A word's program name: its last path segment, without `.exe` (`/usr/bin/docker.exe`). */
function programName(word) {
  return word.slice(word.lastIndexOf("/") + 1).replace(/\.exe$/, "");
}

/** The command's words, lowercased, each with the separator that follows it. */
function wordsOf(command) {
  const parts = command.split(WORD_BREAK);
  const words = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i]) words.push({ word: parts[i].toLowerCase(), after: parts[i + 1] ?? "" });
  }
  return words;
}

/**
 * The subcommands (`exec`, `run`, `cp`, `inspect`) that `docker`, `docker-compose` or
 * `docker compose` runs, by name or by path, with any options before the subcommand
 * (`-f compose.yml`, `-p lendloop`, `--context x`). Walks right to left, keeping the subcommand
 * words seen since the last separator.
 */
function dockerSubcommands(words) {
  const found = new Set();
  let pending = new Set();
  for (let i = words.length - 1; i >= 0; i--) {
    const { word, after } = words[i];
    if (COMMAND_SEPARATOR.test(after)) pending = new Set();
    const name = programName(word);
    if (name === "docker" || name === "docker-compose") {
      for (const subcommand of pending) found.add(subcommand);
    } else if (DOCKER_SUBCOMMANDS.has(word)) {
      pending.add(word);
    }
  }
  return found;
}

/** Whether any word dumps the environment: `env`, `printenv`, a bare `set` or `export`, … */
function dumpsEnvironment(words) {
  return words.some(({ word, after }, i) => {
    const name = programName(word);
    if (ENVIRONMENT_DUMPS.has(name)) return true;
    if (name !== "set" && name !== "export") return false;
    const next = words[i + 1];
    // Bare, they list every variable; with an argument they set one, or a shell option.
    if (!next || END_OF_ARGUMENTS.test(after)) return true;
    if (name === "export" && next.word === "-p") return true;
    // `set 2>&1`: a file descriptor before a redirection isn't an argument.
    return /^\d+$/.test(next.word) && /^[<>]/.test(next.after);
  });
}

/**
 * Why a command that touches a container must not run, or null. Once it runs `docker exec` or
 * `run`, the whole command is checked, so words piped into the container, the steps of an
 * `sh -c` script and a host command chained after it all count. The over-blocking is accepted.
 */
function containerLeak(command) {
  const words = wordsOf(command);
  const subcommands = dockerSubcommands(words);
  if (subcommands.has("inspect")) {
    return "`docker inspect` prints a container's environment, which holds secrets";
  }
  const runs = subcommands.has("exec") || subcommands.has("run");
  const text = command.toLowerCase();
  // `environ` inside a word too: Python's `os.environ`.
  if (runs && (dumpsEnvironment(words) || /\benviron\b/.test(text))) {
    return "the command dumps a container's environment, which holds secrets";
  }
  if (!runs && !subcommands.has("cp")) return null;
  // One secret: a signing secret or the encryption key by variable name (`ENCRYPTION_KEY` also
  // covers `$N8N_ENCRYPTION_KEY_FILE`, the key file's path), `process.env`, and n8n's
  // ~/.n8n/config, which holds the key (by any path that mentions both, or copied out with
  // `.n8n` itself).
  const n8nConfig = text.includes(".n8n") && (text.includes("config") || subcommands.has("cp"));
  if (
    text.includes("signing_secret") ||
    text.includes("encryption_key") ||
    /\bprocess\.env\b/.test(text) ||
    n8nConfig
  ) {
    return "the command reads a secret inside a container (a signing secret or n8n's encryption key)";
  }
  return null;
}

// --- Other commands that print secrets without naming a secret file ----------------------------

/**
 * Whether one simple command (the text between `separators`) runs a program with a flag: each
 * of `programs` is found in turn, after the previous one, and `flag` is tested on what is left.
 * Only the first match of each is tried (what follows it includes what follows any later one), so
 * a check is linear in the command's length.
 */
function runsWith(command, { programs, flag, separators = /[|;&]/ }) {
  return command.split(separators).some((segment) => {
    let rest = segment;
    for (const program of programs) {
      const match = program.exec(rest);
      if (!match) return false;
      rest = rest.slice(match.index + match[0].length);
    }
    return typeof flag === "function" ? flag(rest) : flag.test(rest);
  });
}

/**
 * Whether a whitespace-separated token of `rest` (with the token after it) passes `matches`.
 * Flags are tested token by token with anchored patterns, which stay linear even on one very
 * long flag cluster.
 */
function hasToken(rest, matches) {
  const tokens = rest.split(/\s+/);
  return tokens.some((token, i) => matches(token, tokens[i + 1] ?? ""));
}

// A short-flag cluster holding the letter, before any argument attached to it, in either case
// unless stated: `-rnC3` is `-r -n -C 3`.
const GREP_RECURSIVE = (token, next) =>
  /^-[a-z0-9]*r/i.test(token) ||
  /^--(?:rec|der)/i.test(token) ||
  /^--di\w*=rec/i.test(token) ||
  (/^(?:--di\w*|-[a-z0-9]*d)$/i.test(token) && /^rec/i.test(next));
// Case-sensitive: a lowercase `u` disables the ignore rules, while `-U` is multiline mode.
const RG_UNRESTRICTED = (token) =>
  /^-[A-Za-z0-9]*u/.test(token) || /^--(?:unrestricted|no-ignore)/.test(token);
// findstr takes `/` or `-` switches, which combine (`/si`, `/s/i`, `-s`).
const FINDSTR_RECURSIVE = (token) => /^[/-][a-z/]*s/i.test(token);

const PS_READER = /\b(?:Select-String|sls|Get-Content|gc|cat|type)\b/i;
const PS_LISTING = /\b(?:Get-ChildItem|gci|ls|dir)\b/i;
// Get-ChildItem's `-Recurse` in any abbreviation (`-r`, `-rec`), or `-Depth`.
const PS_RECURSION = /\s-(?:r\w*|Depth)\b/i;

/** A PowerShell listing that recurses, piped (in this or a later stage) into a reader. */
function listsRecursivelyIntoReader(statement) {
  const stages = statement.split("|");
  let readerLater = false;
  for (let i = stages.length - 1; i >= 0; i--) {
    const listing = PS_LISTING.exec(stages[i]);
    if (listing) {
      const rest = stages[i].slice(listing.index + listing[0].length);
      const recursion = PS_RECURSION.exec(rest);
      const after = recursion ? rest.slice(recursion.index + recursion[0].length) : "";
      if (recursion && (readerLater || PS_READER.test(after))) return true;
    }
    readerLater ||= PS_READER.test(stages[i]);
  }
  return false;
}

const LEAKY_COMMANDS = [
  {
    // `convert` is Compose v2's alias of `config`.
    test: (command) =>
      runsWith(command, {
        programs: [
          /\bdocker(?:\.exe)?(?:-compose(?:\.exe)?|\s+compose)\b/i,
          /\s(?:config|convert)\b/i,
        ],
        flag: (rest) => !rest.includes("--no-env-resolution"),
      }),
    reason: "`docker compose config` prints the resolved env files; add --no-env-resolution",
  },
  {
    // On the host or in a container: a decrypted export prints every credential.
    test: (command) =>
      runsWith(command, { programs: [/\bexport:credentials\b/i], flag: /--decrypted\b/i }),
    reason: "`n8n export:credentials --decrypted` prints n8n's credentials",
  },
  {
    // GNU grep ignores .gitignore, so a recursive search reads the secret files. Long options may
    // be abbreviated, and `rgrep` is `grep -r`.
    test: (command) =>
      /\brgrep\b/i.test(command) ||
      runsWith(command, {
        programs: [/\b[ef]?grep\b/i],
        flag: (rest) => hasToken(rest, GREP_RECURSIVE),
      }),
    reason: "a recursive grep reads the gitignored secret files; use the Grep tool",
  },
  {
    test: (command) =>
      runsWith(command, { programs: [/\brg\b/], flag: (rest) => hasToken(rest, RG_UNRESTRICTED) }),
    reason: "ripgrep without its ignore rules reads the secret files; use the Grep tool",
  },
  {
    // Without the index, git grep doesn't apply .gitignore.
    test: (command) =>
      runsWith(command, {
        programs: [/\bgit\b/i, /\sgrep\b/i],
        flag: /\s--no-(?:index|exclude-standard)\b/i,
      }),
    reason: "git grep outside the index reads the gitignored secret files; use the Grep tool",
  },
  {
    // In one statement (pipes included): `-Recurse` before or after a reader, or a listing that
    // recurses (`gci -r`, `-Depth`) piped into one.
    test: (command) =>
      command.split(";").some(
        (statement) =>
          runsWith(statement, { programs: [/-Recurse\b/i], flag: PS_READER, separators: ";" }) ||
          runsWith(statement, {
            programs: [/\b(?:Select-String|sls|Get-Content|gc)\b/i],
            flag: /-Recurse\b/i,
            separators: ";",
          }) ||
          listsRecursivelyIntoReader(statement),
      ),
    reason: "a recursive PowerShell read reaches the secret files; use the Grep tool",
  },
  {
    test: (command) =>
      runsWith(command, {
        programs: [/\bfindstr\b/i],
        flag: (rest) => hasToken(rest, FINDSTR_RECURSIVE),
      }),
    reason: "a recursive findstr reads the secret files; use the Grep tool",
  },
  {
    test: (command) =>
      runsWith(command, { programs: [/\bconvex\b/i], flag: /\benv\s+(?:list|get)\b/i }),
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
  if (command.length > MAX_COMMAND_LENGTH) {
    return "the command is too long for the secret guard to check (over 64 KiB); put the data in a file";
  }
  const names = [...new Set(secretNamesIn(command))];
  if (names.length > 0) return `the command names a secret file (${names.join(", ")})`;
  const leak = LEAKY_COMMANDS.find(({ test }) => test(command));
  return leak ? leak.reason : containerLeak(command);
}
