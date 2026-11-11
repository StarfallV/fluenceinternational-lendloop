# 007 — n8n stack and workflows

**Status:** Planned
**Module:** AUTO
**Branch:** feature/007-n8n-stack-and-workflows

## Goal
Run n8n and Mailpit locally with one setup command, and build the three workflows: loan-event
notifications, daily overdue reminders and the error handler, signed and verified in both
directions.

## Dependencies
- Depends on: 006
- Depended on by: 008

## Requirements
AUT-1 (workflow), AUT-2 (workflow), SEC-3 (n8n side), SEC-4, REL-1, REL-2, OPS-1, DEL-2, BR-21.

## Inputs
- [architecture.md §9, §11–§14](../architecture.md#11-n8n-workflows),
  [ADR-001](../adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md) (2026-11-11 amendment),
  [ADR-004](../adr/ADR-004-hmac-request-signing.md),
  [ADR-005](../adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md),
  [ADR-007](../adr/ADR-007-email-via-smtp-mailpit-locally.md).
- TD-003, TD-013.

## Outputs
- **`compose.yml`:** n8n 2.47 and Mailpit, with pinned versions, published on `127.0.0.1` only.
  n8n gets `.env.n8n` through `env_file`, a named data volume, `host.docker.internal` mapped to
  `host-gateway`, and these execution settings: failed executions kept for 7 days, and neither
  successful nor manual executions saved.
- **`.env.n8n.example`:** every n8n variable, documented.
- **`scripts/setup.ts`** (`npm run setup`, idempotent), starting CLIs through their Node entry
  points:
  - generates the two signing secrets into `.env.n8n` if missing, with `GENERIC_TIMEZONE` and
    `TZ` from `APP_TIMEZONE`;
  - sets the Convex env (`APP_URL`, `APP_TIMEZONE`, `N8N_LOAN_EVENTS_URL` and both secrets)
    without printing a value;
  - starts compose and waits for n8n;
  - imports the workflows and publishes each by ID;
  - creates the Mailpit SMTP credential;
  - runs one clock tick.
- **`scripts/env-names.ts`** (`npm run env:names -- <service>`): prints the names, never the
  values, of a running service's environment variables. The secret guard blocks `printenv`
  through Docker, so this is how the container check below is done.
- **Workflows** in `n8n/workflows/`, with stable IDs (architecture.md §11):
  - `loan-event-notifications.json`;
  - `overdue-reminders.json`, with a daily 09:00 schedule and a signed `run-reminders` webhook;
  - `error-handler.json`.

  Signing and verification run in Code nodes and match block 006's fixed vector. Emails are plain
  text with only the BR-21 fields.
- **`scripts/n8n-export.ts`** (`npm run n8n:export`): exports and sanitizes the workflows. It
  strips pinned data, static data and instance metadata; keeps IDs and `settings.errorWorkflow`;
  refers to credentials by name; and writes stable, sorted JSON.
- **`scripts/check-workflows.ts`** (`npm run check:workflows`, also in CI): fails on pinned data,
  secret-looking values, hard-coded Convex or n8n URLs, email addresses outside `example.com`,
  and a missing or wrong `settings.errorWorkflow`.
- **Smoke tests:**
  - `npm run smoke:notifications`: a signed event → one email in Mailpit and the positive
    acknowledgement; a bad signature → `401` and no email;
  - `npm run smoke:reminders`: a fresh overdue loan; two runs the same day → one email and one
    `sent` record.
- **Secret guard (TD-013):** once `compose.yml` names n8n's data volume, `containerLeak` in
  `.claude/hooks/secret-names.mjs` blocks container commands that mount it, with a test row, and
  security.md §5 lists it.
- **Runbook** `docs/runbooks/local-setup.md`: prerequisites (Docker, Node, a Clerk app), setup,
  verifying the stack, testing with two browser profiles, and troubleshooting: ports in use,
  Docker clock drift after sleep, and a leftover `convex-local-backend` process on Windows.

## Acceptance Criteria
- [ ] With Docker and Node installed, `npm run setup` brings n8n and Mailpit up, imports and
      publishes all three workflows, and sets the Convex env. A second run changes nothing and
      keeps the secrets (manual check, recorded).
- [ ] No script prints a secret value; the setup output is reviewed and recorded. Next.js doesn't
      load `.env.n8n`, and only the n8n container has the signing secrets, checked by name with
      `npm run env:names` (recorded).
- [ ] The Code-node signing and verification match block 006's fixed vector (a test, or a
      recorded run of the node's code against the vector).
- [ ] `npm run smoke:notifications` passes: a signed loan event produces exactly one email in
      Mailpit with only the BR-21 fields, and the positive acknowledgement; an unsigned or
      tampered request gets `401` and sends nothing.
- [ ] End to end (manual check, recorded): request → approve → return in the app sends the right
      emails; with n8n stopped, a delivery becomes a dead letter after its retries, and Retry
      delivers it once n8n is back.
- [ ] `npm run smoke:reminders` passes: an overdue loan gets one reminder email and one `sent`
      record, and a second run the same day sends nothing.
- [ ] A failing workflow step reaches Convex through the error handler and shows among `health`'s
      recent errors (manual check, recorded).
- [ ] `npm run check:workflows` passes on the committed workflows, and fails on fixtures with
      pinned data, a secret-looking value, and a wrong `errorWorkflow` (tests).

## Known Constraints
- Verify ([architecture.md §16](../architecture.md#16-open-verification-items)):
  - `$env` and `require('crypto')` in Code nodes under task runners;
  - CLI import keeping IDs, and publishing by ID;
  - reading the raw webhook body;
  - the execution timeout on webhook executions, and the status returned when a workflow fails
    before its Respond node;
  - `GENERIC_TIMEZONE` and `TZ`;
  - `npx convex env set` reading from stdin.
- TD-003 stays: the Code nodes read the signing secrets from `$env`.

## Manual Steps
1. To open the n8n editor (optional), create the owner account at `http://localhost:5678` on
   first start.
