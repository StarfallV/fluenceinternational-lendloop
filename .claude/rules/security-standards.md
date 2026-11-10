# Security Standards

A checklist that applies to every change. The reasoning behind each item is in
[docs/security.md](../../docs/security.md) and the ADRs.

## Authorization

- The acting user is `ctx.user` from the wrapper. Never accept a user ID meaning "me".
- Every function that touches a listing or loan calls the matching check: `assertToolOwner`,
  `assertLender`, `assertBorrower` or `assertLoanParty`.
- Admin powers go only through `adminQuery`/`adminMutation`. Roles change only through the
  internal `users:grantRole`.
- Return `NOT_FOUND` rather than `FORBIDDEN` when the error itself would reveal that someone
  else's record exists.
- Every new public function gets authorization tests: signed out, wrong user, and admin where it
  matters.

## Data exposure

- Return explicit projections, never whole `users` documents.
- Email addresses appear only as BR-16 allows (the counterparty on an approved loan). Tests check
  the result shapes.
- Public queries declare `returns` validators.
- Nothing personal goes into outbox rows, automation records, logs or error messages.

## Integration (Convex ↔ n8n)

- Verify the HMAC signature over the **raw** body before parsing it. On failure, return `401`
  with no body.
- Allow a ±300 s timestamp window. Compare signatures in constant time. Include the method and
  path in the canonical string.
- Cap request bodies at 64 KiB, and validate with Convex validators before any write.
- Every write-back is idempotent by key (architecture.md §10).
- Outgoing payloads contain only the fields in architecture.md §7.2.
- Emails are plain text.

## Secrets

- Secrets live only in the Convex env, `.env.local`, `.env` (compose) and n8n credentials. Never
  in code, tests, fixtures, docs or workflow JSON.
- Never print a secret: scripts redact values. Agents do not read `.env*` files and do not run
  `npx convex env list` or `npx convex env get`. `.claude/settings.json` denies both.
- Generate secrets with `crypto.randomBytes(32)`, encoded as base64url.
- Export workflow JSON only with `npm run n8n:export` (it sanitizes), and `check:workflows` must
  pass.

## Abuse resistance

- Every user text field has a maximum length in `convex/lib/domain.ts`, enforced on the server.
- Every new write path open to all users gets considered for a rate limit.

## Dev-only code

- `dev:*` functions are internal and refuse to run unless `ALLOW_DEV_FUNCTIONS=true`.
