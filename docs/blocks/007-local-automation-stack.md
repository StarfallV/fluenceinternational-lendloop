# 007 — Local automation stack

**Status:** Planned
**Module:** AUTO
**Branch:** feature/007-local-automation-stack

## Goal
Make the automation side runnable with one command. Compose runs n8n, Mailpit, the edge proxy and
the tunnel. Secrets are generated and distributed without being printed, and never reach the
Next.js process. Workflows go through a sanitized import, publish and export loop with stable IDs.

## Dependencies
- Depends on: 006
- Depended on by: 008

## Requirements
OPS-1, SEC-4, DEL-2 (folder and tooling), REL-2 (n8n execution retention, publication).

## Inputs
- [ADR-001](../adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md),
  [architecture.md §11, §13, §14](../architecture.md#13-configuration-and-secrets),
  [security.md §5](../security.md#5-secrets-management).

## Outputs
- **`compose.yml`**, all images pinned. Only the `n8n` service reads `.env.n8n` (`env_file`); the
  other services get their non-secret settings inline, so no other container sees a secret:
  - `n8n` (2.47.x):
    - `N8N_ENCRYPTION_KEY_FILE` from `.secrets/n8n_encryption_key`, once its support is verified
      (Known Constraints);
    - timezone from `GENERIC_TIMEZONE` and `TZ` in `.env.n8n`, which setup writes from
      `APP_TIMEZONE`;
    - env access in nodes, and `NODE_FUNCTION_ALLOW_BUILTIN=crypto`;
    - saves no successful and no manual executions, and keeps errors for 168 h;
    - diagnostics off;
    - a named volume;
    - the editor bound to `127.0.0.1:5678`.
  - `mailpit`: inbox UI on `127.0.0.1:8025`, SMTP on the internal network only.
  - `edge` (Caddy, `infra/Caddyfile`): forwards only `POST /webhook/lendloop/*` to n8n. Everything
    else gets `404` with `X-LendLoop-Edge: denied`.
  - `tunnel`: a cloudflared quick tunnel to `edge`, with `--protocol http2`, exposing its hostname
    for discovery.
- **Env templates:** `.env.n8n.example` and `.env.example`, complete and commented, including where
  each variable lives.
- **`scripts/setup.ts`** (`npm run setup`), idempotent:
  - creates `.env.n8n` and the key file if missing (the key file without a trailing newline);
  - writes `GENERIC_TIMEZONE` and `TZ` into `.env.n8n` with the value of `APP_TIMEZONE`, and sets
    the same `APP_TIMEZONE` in the Convex env, so n8n's schedule and Convex's calendar agree;
  - refuses to create a new encryption key when an n8n volume already exists, and explains the
    recovery;
  - sets the Convex env without echoing values (stdin if the CLI supports it);
  - starts compose and waits for health;
  - checks that n8n uses the key from the key file, by comparing hashes and printing only "match"
    or "mismatch";
  - imports the workflows and the SMTP credential, keeping their IDs;
  - **publishes** every workflow by ID, and verifies that each is active;
  - runs one clock tick, so the `clock` row exists;
  - syncs the tunnel URL.
- **`scripts/tunnel-sync.ts`** (`npm run tunnel:sync`): finds the quick-tunnel hostname and sets
  `N8N_LOAN_EVENTS_URL`. It also runs from `predev`. When the stack is down, it prints one warning
  line and exits 0, so `npm run dev` still starts.
- **`scripts/n8n-export.ts`** (`npm run n8n:export`): exports the workflows and sanitizes them:
  - strips pinned data, static data and instance metadata;
  - **keeps** each workflow's `id` and `settings.errorWorkflow`;
  - refers to credentials by name;
  - writes stable, sorted JSON to `n8n/workflows/`.
- **`scripts/check-workflows.ts`** (`npm run check:workflows`, also in CI) fails on:
  - pinned data;
  - secret-looking values;
  - hard-coded tunnel or Convex URLs;
  - email addresses outside `example.com`;
  - a workflow other than the error handler whose `settings.errorWorkflow` isn't the handler's
    committed ID.
- **A fixture workflow** (`scripts/fixtures/roundtrip-workflow.json`), used to test the import and
  export loop before the real workflows exist.
- **Spawning:** scripts start Node entry points directly (for example the Convex CLI's JS entry),
  never `npx` without a shell, so they work on Windows.
- **`scripts/env-names.ts`** (`npm run env:names -- <service>`): prints the names, never the values,
  of a running service's environment variables. The secret guard blocks `printenv` through
  `docker compose exec` (security.md §5), so this is how the container check below is done.
- **Secret guard (TD-013):** once `compose.yml` fixes the in-container path of the mounted key
  file, the `exec|run|cp` rule in `.claude/hooks/secret-names.mjs` also blocks commands that name
  it, with a test row, and security.md §5 lists it.
- **Runbook:** `docs/runbooks/local-setup.md` covers:
  - prerequisites, the Clerk and Convex steps, setup, and verification;
  - testing with two browser profiles;
  - troubleshooting: tunnel URL changed, port conflicts, Windows notes, Docker clock drift after
    sleep (rejections show in health; restart Docker Desktop, or run `wsl --shutdown`).

## Acceptance Criteria
- [ ] With Docker and Node installed, `npm run setup` brings all four services up healthy. A
      second run changes nothing and keeps the secrets (manual check, recorded).
- [ ] With the n8n volume kept and the key file deleted, setup refuses to continue and says why
      (manual check, recorded).
- [ ] No script prints a secret value. The redaction helper has tests, and the setup output is
      reviewed and recorded.
- [ ] Next.js doesn't load `.env.n8n`. Proven by a test, or a recorded check, that the signing
      secret is absent from the Next.js server environment.
- [ ] Only the n8n container has the signing secrets in its environment. Checked by variable
      **name** only, with `npm run env:names`, for every service (recorded).
- [ ] n8n uses the encryption key from the key file: setup's hash check reports "match"
      (recorded). If n8n 2.47 ignores `N8N_ENCRYPTION_KEY_FILE`, the fallback in Known Constraints
      is applied and recorded instead.
- [ ] With the stack down, `npm run dev` still starts: `predev` prints one warning line and exits
      0 (manual check, recorded).
- [ ] With a non-default `APP_TIMEZONE`, n8n reports that timezone, and the Convex env has the
      same value (manual check, recorded).
- [ ] Through the tunnel URL (curl results recorded):
  - `POST /webhook/lendloop/<path>` reaches n8n;
  - `GET /`, the editor paths and `/webhook-test/*` return `404` with `X-LendLoop-Edge: denied`.
- [ ] After the tunnel restarts, `npm run dev` (through `predev`) updates `N8N_LOAN_EVENTS_URL` in
      the Convex env (manual check, recorded).
- [ ] Importing, publishing and exporting the fixture workflow gives byte-identical sanitized
      JSON, with its ID kept (test or recorded run).
- [ ] `check:workflows` passes on clean fixtures. It fails on fixtures with pinned data, a planted
      secret, or a missing or wrong `settings.errorWorkflow` (Vitest). It runs in CI.
- [ ] The n8n editor is reachable only on `127.0.0.1:5678`, and Mailpit only on `127.0.0.1:8025`.

## Known Constraints
- Verify on n8n 2.47 ([architecture.md §16](../architecture.md#16-open-verification-items)):
  - `$env` access and `require('crypto')` in Code nodes under task runners;
  - that CLI import keeps IDs;
  - publishing and activating workflows by ID;
  - that n8n reads `N8N_ENCRYPTION_KEY_FILE`. If it doesn't, pass `N8N_ENCRYPTION_KEY` in
    `.env.n8n` instead, record it, and widen TD-003, because `$env` can then read the key.
- Verify whether `npx convex env set` can read values from stdin.
- Verify how to discover the quick tunnel's hostname, and that it works with
  `--protocol http2`.
- The scripts must run unchanged in PowerShell 5.1, Git Bash, macOS and Linux shells.

## Manual Steps
Create the n8n owner account in the browser on first start. The runbook gives the exact steps.
