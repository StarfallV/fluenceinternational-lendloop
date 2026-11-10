import { describe, expect, it } from "vitest";

import { findSecretAccess, secretNamesIn } from "./secret-names.mjs";

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
});

describe("secretNamesIn", () => {
  it("lists each secret file a command names, but not the templates", () => {
    expect(secretNamesIn("diff .env.n8n.example .env.n8n && cat .secrets/key")).toEqual([
      ".env.n8n",
      ".secrets",
    ]);
  });
});
