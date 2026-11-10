# 007 — Local automation stack

**Status:** Planned
**Module:** AUTO
**Branch:** feature/007-local-automation-stack

## Goal
Make the automation side runnable with one command. Compose runs n8n, Mailpit, the edge proxy and
the tunnel. Secrets are generated and distributed without ever being printed. Workflows go
through a sanitized import/export loop.

## Dependencies
- Depends on: 006
- Depended on by: 008, 009

## Requirements
OPS-1, SEC-4, DEL-2 (folder and tooling), REL-2 (n8n execution retention).

## Inputs
- [ADR-001](../adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md),
  [architecture.md §13–§14](../architecture.md#13-configuration-and-secrets),
  [security.md §5](../security.md#5-secrets-management).

## Outputs
- **`compose.yml`**, all images pinned:
  - `n8n` (2.47.x):
    - encryption key and timezone from `.env`;
    - env access in nodes and `NODE_FUNCTION_ALLOW_BUILTIN=crypto`;
    - execution pruning: don't save successful runs, keep errors for 168 h;
    - diagnostics off;
    - a named volume;
    - the editor bound to `127.0.0.1:5678`.
  - `mailpit`: inbox UI on `127.0.0.1:8025`, SMTP on the internal network only.
  - `edge` (Caddy): forwards only `POST /webhook/lendloop/*` to n8n; everything else is `404`.
  - `tunnel` (cloudflared quick tunnel to `edge`): exposes the hostname for discovery.
- **`.env.example`:** complete and commented, including where each variable lives.
- **`scripts/setup.ts`** (`npm run setup`), idempotent:
  - creates `.env` if missing;
  - generates missing secrets;
  - sets the Convex env with `npx convex env set` without echoing values;
  - starts compose and waits for health;
  - imports the workflows and the SMTP credential;
  - syncs the tunnel URL.
- **`scripts/tunnel-sync.ts`** (`npm run tunnel:sync`): finds the quick-tunnel hostname and sets
  `N8N_LOAN_EVENTS_URL`.
- **`scripts/n8n-export.ts`** (`npm run n8n:export`): exports the workflows and sanitizes them:
  strips pinned data, static data and instance metadata; refers to credentials by name; writes
  stable, sorted JSON to `n8n/workflows/`.
- **`scripts/check-workflows.ts`** (`npm run check:workflows`, also in CI): fails on pinned data,
  secret-looking values, hard-coded tunnel or Convex URLs, and email addresses outside
  `example.com`.
- **Runbook:** `docs/runbooks/local-setup.md` covers prerequisites, the Clerk and Convex steps,
  setup, verification, and troubleshooting (tunnel URL changed, port conflicts, Windows notes).

## Acceptance Criteria
- [ ] With Docker and Node installed, `npm run setup` brings all four services up healthy. A
      second run changes nothing and keeps the secrets (manual check, recorded).
- [ ] No script prints a secret value. The redaction helper has tests, and the setup output is
      reviewed and recorded.
- [ ] Through the tunnel URL, `POST /webhook/lendloop/<path>` reaches n8n, while `GET /`, the
      editor paths and `/webhook-test/*` return `404` (curl results recorded).
- [ ] After the tunnel restarts, `npm run tunnel:sync` updates `N8N_LOAN_EVENTS_URL` in the Convex
      env (manual check, recorded).
- [ ] Export → import → export gives byte-identical sanitized JSON.
- [ ] `check:workflows` fails on fixtures with pinned data or a planted secret, and passes on the
      real exports (Vitest). It runs in CI.
- [ ] The n8n editor is reachable only on `127.0.0.1:5678`, and Mailpit only on
      `127.0.0.1:8025`.

## Known Constraints
- Verify on n8n 2.47:
  - `$env` access and `require('crypto')` in Code nodes under task runners;
  - CLI import and activation of workflows and credentials.
- Verify how to discover the quick tunnel's hostname (metrics endpoint or logs). See
  [architecture.md §16](../architecture.md#16-open-verification-items).
- The scripts must run unchanged in PowerShell, Git Bash, macOS and Linux shells.

## Manual Steps
Create the n8n owner account in the browser on first start. The runbook gives the exact steps.
