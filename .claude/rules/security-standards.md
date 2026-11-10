# Security Standards

A checklist that applies to every change. The reasoning behind each item is in
[docs/security.md](../../docs/security.md) and the ADRs.

## Authorization

- The acting user is `ctx.user` (or `ctx.identity` in `identityMutation`) from the wrapper. Never
  accept a user ID meaning "me".
- Every function that touches a listing or loan calls the matching check: `assertToolOwner`,
  `assertLender`, `assertBorrower` or `assertLoanParty`.
- **One error code per resource:**
  - tools are visible to every signed-in user, so acting on someone else's tool returns
    `FORBIDDEN`;
  - loans are private to their two parties, so a non-party gets `NOT_FOUND`.
- Admin powers go only through `adminQuery`/`adminMutation`. Roles change only through the
  internal `users:grantRole`.
- Every new public function gets authorization tests: signed out, wrong user, and admin where it
  matters.

## Data exposure

- Return explicit projections, never whole `users` documents.
- Email addresses appear only as BR-16 allows (the counterparty on an approved loan). Tests check
  the result shapes.
- Public queries declare `returns` validators.
- Nothing personal goes into outbox rows, automation records, logs or error messages.
- **Error text is redacted** (`lib/redact.ts`) before it is stored, whatever its source. The
  loan's parties see a status, never the error text.

## Integration (Convex ↔ n8n)

- **Convex HTTP endpoints** run their checks in a fixed order: size (`413`), then signature and
  timestamp (`401`, no body), then body validation (`400`). The signature is verified over the
  raw bytes before parsing. Each rejection is counted in `integrationStats`.
- **n8n** verifies the signature before using any field.
- **Signatures:** newline-separated canonical string; the key is the UTF-8 of the secret string;
  ±300 s window; constant-time comparison.
- **Senders** transmit exactly the bytes they signed.
- **Write-backs** are idempotent by key (architecture.md §10). Reminders are claimed before they
  are sent.
- **Payloads:** outgoing payloads contain only the fields in architecture.md §7.2.
- **Emails** are plain text. Single-line text (names) rejects control characters.

## Secrets

- **Where secrets live:** only in the Convex env, `.env.local` (Next.js), `.env.n8n` (compose;
  never loaded by Next.js), `.secrets/` (mounted files) and n8n credentials. Never in code, tests,
  fixtures, docs or workflow JSON.
- **Never print a secret.** Scripts redact values. Agents do not read secret files and do not list
  Convex env values. The deny rules in `.claude/settings.json` are a **best-effort** guardrail,
  not a guarantee; follow the rule even where a command isn't blocked.
- **Generating:** use `crypto.randomBytes(32)`, encoded as base64url.
- **Workflow JSON:** export it only with `npm run n8n:export` (it sanitizes), and
  `check:workflows` must pass.

## Abuse resistance

- Every user text field has a maximum length in `convex/lib/domain.ts`, enforced on the server.
- Every new write path open to all users gets considered for a rate limit.

## Dev-only code

- `dev:*` functions are internal and refuse to run unless `ALLOW_DEV_FUNCTIONS=true`.
