# LendLoop — Security and Privacy

**Status:** Baseline v1.0 (2026-11-10)
**Scope:** What we protect, from whom, with which controls, and which personal data goes where.
The mechanisms are specified in [architecture.md](architecture.md). This document explains why
they exist.

---

## 1. Assets

| Asset | Why it matters |
| --- | --- |
| Users' email addresses | Personal data; the only contact channel |
| Listings and loans | Show who owns what, and who is away from home with whose tools |
| Roles and the Trusted Lender flag | Control moderation power and neighbors' trust |
| Signing secrets (two) | Whoever holds one can impersonate Convex or n8n to the other |
| `CLERK_SECRET_KEY`, `N8N_ENCRYPTION_KEY` | Control sessions, and the n8n credential store |

## 2. Trust boundaries

1. **Browser → Convex.** Untrusted input. Every Convex function is reachable from the internet,
   whatever the UI shows.
2. **Convex → n8n.** Crosses the public internet through the tunnel locally, or directly in
   production.
3. **n8n → Convex.** HTTP endpoints anyone can reach.
4. **n8n → SMTP.** Leaves our control once sent.
5. **Operator → Convex.** CLI and dashboard with the deploy key. Trusted, used for role grants
   and seeds.

## 3. Threats and controls

| Threat | Control | Where |
| --- | --- | --- |
| Calling a Convex function directly, without the UI | Every public function goes through `userX`/`adminX` wrappers that check identity and role. An ESLint rule forbids the raw builders. | `convex/lib/functions.ts`, ESLint |
| Acting on someone else's listing or loan (IDOR) | The acting user comes from `ctx.auth`, never from arguments. Ownership and party checks live in `model/*`. Tests cover each case. | `convex/model/*`, tests |
| Privilege escalation | Roles live in Convex, and only the internal `users:grantRole` changes them, from the CLI. No public path exists. | ADR-002 |
| Data leaking through the public query | `tools:listPublic` builds an explicit projection, and its `returns` validator rejects any extra field | `convex/tools.ts` |
| Forged webhook or forged write-back | HMAC-SHA256 over timestamp, method, path and raw body. One secret per direction. Constant-time comparison. Verified before parsing. Bare 401. | ADR-004 |
| Replay | ±300 s timestamp window, plus idempotency keys on every write | ADR-004, ADR-005 |
| Cross-endpoint replay | The signature covers the method and path | ADR-004 |
| Oversized or malformed bodies | 64 KiB limit; validated with Convex validators before any write | `convex/http.ts` |
| Secrets committed or leaked | Secrets are only in env vars and n8n credentials. `.env*` is gitignored. The workflow exporter strips pinned data and instance metadata, and a CI scan fails on anything secret-shaped. Claude Code settings forbid reading env files and listing Convex env values. | §5 |
| The n8n editor exposed through the tunnel | An edge proxy forwards only `POST /webhook/lendloop/*`. The editor and test webhooks stay on localhost. | ADR-001, `compose.yml` |
| HTML or script injection through user text in emails | Plain-text emails only. Length limits on all user text. React escapes all rendering. | BR-3, BR-21 |
| Spam and abuse | Rate limits on creating listings and requests, one open request per tool, field limits | SEC-6 |
| Retry storms against n8n | Bounded backoff with jitter, then a dead letter | architecture.md §7.3 |
| Demo or seed functions running in production | `dev:*` are internal functions **and** need `ALLOW_DEV_FUNCTIONS=true` | `convex/dev.ts` |

## 4. Data minimization

| Data | Stored in | Visible to | Sent to n8n |
| --- | --- | --- | --- |
| Email | Convex `users` | The user themselves, and the counterparty on an **approved** loan (to arrange pickup). Not visitors, other users, or admin screens. | Only the recipient's email, only on the event or reminder that needs it |
| Display name ("Alex P.") | Convex `users` | Signed-in users | The recipient's and counterparty's display names |
| Owner of a tool | Convex `tools` | Signed-in users (display name only). **Never the public page.** | No |
| Tool name and category | Convex `tools` | Everyone (public page) | Tool name only |
| Tool description and condition | Convex `tools` | Signed-in users | No |
| Loan dates | Convex `loans` | The two parties and admins | Yes, they are the content of the notification |
| Request note | Convex `loans` | The lender and the borrower | **No** |
| Role and Trusted flag | Convex `users` | Badge to signed-in users; role to the user and admins | No |
| Automation records | Convex `automationEvents`, `workflowRuns` | The loan's parties, and admins | — (no personal data stored in them) |
| Outbox rows | Convex `outbox` | Admins | Rows store IDs only. The payload is built when it is sent. |
| n8n executions | n8n database | n8n operators | Successful executions are **not saved**; failed ones are kept 7 days |
| Logs | Convex logs | Operators | IDs and error codes only, never emails or names |

## 5. Secrets management

| Secret | Generated by | Stored in | Never in |
| --- | --- | --- | --- |
| `CONVEX_TO_N8N_SIGNING_SECRET` | `npm run setup` (32 random bytes) | Convex env, `.env` → n8n container env | Code, workflow JSON, logs |
| `N8N_TO_CONVEX_SIGNING_SECRET` | `npm run setup` | Convex env, `.env` → n8n container env | Code, workflow JSON, logs |
| `N8N_ENCRYPTION_KEY` | `npm run setup` | `.env` → n8n container env | Anywhere else |
| `CLERK_SECRET_KEY` | Clerk dashboard | `.env.local` | Convex, n8n, logs |
| SMTP credentials | n8n credential (encrypted with `N8N_ENCRYPTION_KEY`) | n8n database | Workflow JSON |

**Trade-off we accept:** the Code nodes that sign and verify read the signing secrets from
`$env`, which needs env access enabled in n8n nodes. In production, a secrets manager or a
signing step in front of n8n would replace this (see `docs/production.md`, block 012).

## 6. Residual risks

| Risk | Why it is accepted here | Production answer |
| --- | --- | --- |
| A Convex query can use a stale "today" if a page stays open across midnight | Views re-query on navigation and on any data change | A time-bucketed argument, or a nightly cache bump |
| User profile changes in Clerk only sync on the next sign-in | Low impact locally | Clerk webhooks (signed, verified) |
| Quick-tunnel URLs are public and change on every restart | Only the signed webhook path is exposed | A real domain, TLS, and an IP allowlist or private networking |
| A duplicate email if n8n's reply is lost after sending | At-least-once is standard; the email is harmless | Provider-level deduplication keyed by `eventId` |
