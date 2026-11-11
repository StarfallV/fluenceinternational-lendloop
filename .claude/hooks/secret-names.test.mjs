import { describe, expect, it } from "vitest";

import { findSecretAccess, MAX_COMMAND_LENGTH, secretNamesIn } from "./secret-names.mjs";

// Keep these cases in step with the list in docs/security.md §5.
const blocked = [
  // Commands that name a secret file, in any spelling of the path.
  "cat .env.local",
  "cat ./.env",
  "cat .ENV",
  "diff .env.n8n.example .env.n8n",
  "git diff --no-index .env.example .env.development",
  "head -3 .secrets/n8n_encryption_key",
  "ls .secrets",
  "Get-Content D:\\repo\\.env.n8n",
  "Get-Content -Path .\\.secrets\\n8n_encryption_key",
  "type .\\.env.production.local",
  // Commands that print secrets without naming a secret file.
  "docker compose config",
  "docker-compose -f compose.yml config",
  "docker compose convert",
  "docker compose exec n8n printenv",
  "docker-compose exec n8n printenv",
  "docker exec lendloop-n8n-1 env",
  "docker exec lendloop-n8n-1 /usr/bin/env",
  "docker compose exec -T n8n env | cut -d= -f1",
  "docker compose exec n8n sh -c 'printenv'",
  "docker compose run --rm --entrypoint printenv n8n",
  "docker compose run --rm --entrypoint=env n8n",
  "docker exec lendloop-n8n-1 cat /proc/1/environ",
  "docker compose exec n8n cat /home/node/.n8n/config",
  "docker cp lendloop-n8n-1:/home/node/.n8n/config -",
  "docker compose exec n8n n8n export:credentials --all --decrypted",
  "docker compose -f compose.yml exec n8n printenv",
  "docker compose -p lendloop exec n8n env",
  "docker --context default exec lendloop-n8n-1 env",
  "docker compose -f compose.yml exec n8n cat /home/node/.n8n/config",
  "docker compose exec n8n sh -c 'cd /tmp && env'",
  "docker compose exec n8n sh -c 'true; printenv'",
  "docker compose exec n8n sh -c set",
  "docker compose exec n8n sh -c 'export -p'",
  "docker compose exec n8n bash -c 'declare -x'",
  "docker compose exec n8n sh -c 'echo $CONVEX_TO_N8N_SIGNING_SECRET'",
  "docker compose exec n8n sh -c 'cat \"$N8N_ENCRYPTION_KEY_FILE\"'",
  'docker compose exec n8n node -e "console.log(process.env)"',
  "docker container exec lendloop-n8n-1 env",
  "docker compose exec n8n sh -c typeset",
  "docker compose exec n8n sh -c export",
  "echo env | docker compose exec -T n8n sh",
  "printf 'printenv\\n' | docker compose exec -T n8n sh",
  "docker compose exec -T n8n sh <<'X'\nset\nX",
  "docker compose exec n8n sh -c 'set >&2'",
  "docker compose exec n8n sh -c 'set 2>&1 | grep KEY'",
  "docker compose exec n8n sh -c 'export >/tmp/e'",
  "docker compose exec n8n sh -c 'echo `env`'",
  "docker compose exec n8n sh -c '\\env'",
  "docker compose exec n8n \\printenv",
  "docker compose exec n8n sh -c 'cd ~/.n8n && cat config'",
  "docker cp lendloop-n8n-1:/home/node/.n8n /tmp/n8n-copy",
  "n8n export:credentials --all --decrypted",
  "docker inspect lendloop-n8n-1",
  "docker container inspect n8n",
  "docker --context default inspect lendloop-n8n-1",
  "grep -rn SIGNING_SECRET .",
  "grep -R token .",
  "grep --recursive token .",
  "grep --recurs token .",
  "grep --directories=recurse token .",
  "grep -d recurse token .",
  "rgrep token .",
  "rg -uu SIGNING_SECRET",
  "rg -nuu SIGNING_SECRET",
  "rg --unrestricted --unrestricted token",
  "rg --no-ignore token",
  "git grep --no-index token",
  "git grep --untracked --no-exclude-standard token",
  "Get-ChildItem -Recurse | Select-String SIGNING_SECRET",
  "Get-ChildItem -Recurse | sls SIGNING_SECRET",
  "gci -r | sls token",
  "Get-ChildItem -Depth 3 -File | Get-Content",
  "findstr /s /i secret *",
  "findstr /si secret *",
  "findstr -s -i secret *",
  "npx convex env list",
  "node node_modules/convex/bin/main.js env get N8N_TO_CONVEX_SIGNING_SECRET",
];

const allowed = [
  'grep -n "process.env" src/lib/env.ts',
  "grep -c error build.log",
  "cat .env.example",
  "cp .env.n8n.example /tmp/template",
  "type .env.n8n.example",
  "cat .envrc",
  "$env:APP_TIMEZONE",
  "docker compose config --no-env-resolution",
  "docker compose ps",
  "docker compose logs n8n",
  "docker compose exec n8n n8n export:workflow --all --output=/tmp/workflows",
  "docker compose exec -e NODE_ENV=production n8n node --version",
  "docker compose run --rm n8n n8n --version",
  "docker compose -f compose.yml ps",
  "docker compose exec n8n sh -c 'set -e; n8n import:workflow --input=/workflows/x.json'",
  "docker compose exec n8n sh -c 'export N8N_LOG_LEVEL=debug && n8n --version'",
  "docker compose exec n8n n8n import:workflow --input=/home/node/env/x.json",
  "npm run env:names -- n8n",
  "docker compose exec n8n n8n --version && echo done",
  "docker compose cp n8n:/tmp/workflows ./n8n/workflows",
  "docker compose images | grep inspect",
  "findstr -i secret notes.txt",
  "rg SIGNING_SECRET src",
  "rg --hidden token",
  "rg -U 'multi\\nline' src",
  "rg -n -t ts token",
  "Get-ChildItem -Recurse src",
  "Get-Content package.json | ConvertFrom-Json -Depth 10",
  "git grep -n token",
  "git diff --no-index a.txt b.txt",
  "grep --color=never -n token src/app/page.tsx",
  "findstr /i secret notes.txt",
  "pgrep node",
  "npx convex env set APP_TIMEZONE UTC",
  "npm run check:workflows",
  "git add -A && git commit -m 'docs: x'",
];

describe("findSecretAccess", () => {
  it.each(blocked)("blocks %s", (command) => {
    expect(findSecretAccess(command)).not.toBeNull();
  });

  it.each(allowed)("allows %s", (command) => {
    expect(findSecretAccess(command)).toBeNull();
  });

  it("denies a command over 64 KiB without checking it", () => {
    const command = `echo ${"x".repeat(MAX_COMMAND_LENGTH)}`;

    expect(findSecretAccess(command)).toMatch(/too long/);
  });

  // Inputs of the maximum length that make backtracking patterns slow. The hook times out after
  // 10 s, and a timed-out hook lets the command run. Every check is linear, about 15 ms here at
  // worst; quadratic patterns took 500–700 ms on the repeated-word inputs, which this bound
  // catches.
  const filler = MAX_COMMAND_LENGTH - 100;
  it.each([
    ["minified JSON in a container heredoc", `docker compose exec -T n8n sh <<'X'\n;{"a":[`],
    [
      "one unbroken word in a container heredoc",
      `docker compose exec -T n8n sh <<'X'\n;${"A".repeat(filler)}`,
    ],
    ["repeated docker words", "docker ".repeat(filler / 7)],
    ["repeated docker compose words", "docker compose ".repeat(filler / 15)],
    ["repeated grep words", "grep ".repeat(filler / 5)],
    ["repeated git grep words", "git grep ".repeat(filler / 9)],
    ["repeated rg words", "rg -n ".repeat(filler / 6)],
    ["repeated -Recurse flags", "-Recurse ".repeat(filler / 9)],
    ["repeated gci -r words", "gci -r ".repeat(filler / 7)],
    ["repeated findstr words", "findstr /i ".repeat(filler / 11)],
    ["one long flag after grep", `grep ${"-a".repeat(filler / 2)}`],
  ])("decides quickly on %s", (_label, prefix) => {
    const command = (prefix + '{"k":"v"},'.repeat(filler)).slice(0, MAX_COMMAND_LENGTH);

    const start = performance.now();
    findSecretAccess(command);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(250);
  });
});

describe("secretNamesIn", () => {
  it("lists each secret file a command names, but not the templates", () => {
    expect(secretNamesIn("diff .env.n8n.example .env.n8n && cat .secrets/key")).toEqual([
      ".env.n8n",
      ".secrets",
    ]);
  });
});
