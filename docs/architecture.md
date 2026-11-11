# LendLoop — Architecture

**Status:** v1.4 (2026-11-11): simplified at the start of block 002, by developer decision: a
local Convex deployment, simpler delivery retries, daily reminders without claims, and a leaner
health view. Baseline v1.3 (2026-11-10, revised after planning review
[rounds 1](reviews/planning-baseline-review-1.md), [2](reviews/planning-baseline-review-2.md) and
[3](reviews/planning-baseline-review-3.md)).
**Scope:** Components, module boundaries, the data model, the authorization model, the loan
lifecycle, and the contract between Convex and n8n. This is the authoritative technical reference.
Requirements live in [prd.md](prd.md) and the threat model in [security.md](security.md). The
reasons behind each decision live in the [ADRs](adr/).

---

## 1. Principles

1. **Clerk says who you are. Convex decides what you can do.** Clerk handles sign-in and issues
   the JWT. Every authorization decision is made inside Convex functions. The UI hides what you
   can't do, but enforces nothing ([ADR-002](adr/ADR-002-convex-is-the-authorization-authority.md)).
2. **n8n delivers; it does not decide.** Convex decides who gets notified, and which data they
   get. n8n formats messages, sends them, and runs the schedule
   ([ADR-003](adr/ADR-003-convex-decides-n8n-delivers.md)).
3. **Every boundary is authenticated.** Browser → Convex uses the Clerk JWT. Convex → n8n and
   n8n → Convex each use an HMAC signature with their own secret
   ([ADR-004](adr/ADR-004-hmac-request-signing.md)).
4. **Only the data that is needed crosses a boundary, and error text is redacted before it is
   stored** ([security.md §4](security.md#4-data-minimization)).
5. **Every failure ends up recorded where an admin can see it.** Retries are bounded, and dead
   letters, workflow errors and a reminder workflow that stopped running are all visible
   ([ADR-006](adr/ADR-006-failure-visibility.md)).
6. **Anything that depends on time reads a shared clock**, so live views change when the day
   changes ([ADR-008](adr/ADR-008-calendar-dates-in-one-app-timezone.md)).

## 2. System context

```mermaid
flowchart LR
  B["Browser<br/>Next.js App Router + Clerk UI"]
  K["Clerk"]
  C[("Convex<br/>queries · mutations · actions<br/>HTTP endpoints · crons")]
  N["n8n"]
  M["SMTP<br/>(Mailpit locally)"]

  B -- "sign-in" --> K
  B -- "queries / mutations<br/>with Clerk JWT" --> C
  C -- "verifies JWT via JWKS" --> K
  C -- "signed POST: loan events" --> N
  N -- "signed POST: due reminders,<br/>write-backs, run summaries, errors" --> C
  N -- "email" --> M
```

| Component | Responsibility |
| --- | --- |
| **Next.js** (App Router) | UI only. Server Components for static shells, Client Components where Convex hooks are needed. `proxy.ts` (Clerk) redirects signed-out users away from app routes, for UX only. |
| **Clerk** | Sign-in, sessions, and the JWT that Convex verifies. |
| **Convex** | Data, business rules, authorization, the outbox, the clock, scheduled functions, the HTTP endpoints n8n calls, and crons. |
| **n8n** | Three workflows: loan-event notifications, overdue reminders (daily, at most one reminder per loan per day), and an error handler. |
| **Mailpit** | Local SMTP server that catches every email and shows it in an inbox UI ([ADR-007](adr/ADR-007-email-via-smtp-mailpit-locally.md)). |

## 3. Modules and code layout

| Code | Module | Owns |
| --- | --- | --- |
| `PLT` | Platform | Function wrappers, errors, shared validators, dates, the clock, signing, redaction, the HTTP router, crons, tooling, CI |
| `AUTH` | Identity and roles | `users`, role and trust changes, `auditLog` |
| `TOOL` | Listings | `tools`, availability, the public list |
| `LOAN` | Borrowing | `loans`, the loan state machine, expiry |
| `AUTO` | Automation | `outbox`, `automationEvents`, `workflowRuns`, the n8n endpoints, the n8n workflows |
| `WEB` | Web shell and UX | Layout, navigation, shared components, UX states |

```
convex/
  schema.ts               all tables and indexes
  auth.config.ts          Clerk as the JWT issuer
  convex.config.ts        components (rate limiter)
  http.ts                 HTTP router: /n8n/* endpoints
  crons.ts                clock tick (every minute; runs request expiry when the date changes),
                          outbox sweep (every 10 minutes: deliveries whose scheduled action was lost)
  lib/
    functions.ts          publicQuery, identityMutation, userQuery/Mutation, adminQuery/Mutation
                          ← the only place the raw query/mutation builders are imported
    errors.ts             ConvexError codes
    validators.ts         shared v.* validators (category, condition, calendar date, single-line text)
    domain.ts             categories, conditions, limits (also imported by the UI)
    dates.ts              calendar-date helpers in APP_TIMEZONE; reading the clock
    hmac.ts               sign/verify (Web Crypto)
    redact.ts             strips email-shaped strings, truncates error text
    env.ts                validated access to environment variables
  model/                  business logic as plain TypeScript, called by the thin functions below
    users.ts tools.ts loans.ts availability.ts automation.ts audit.ts clock.ts
  users.ts tools.ts loans.ts admin.ts automation.ts config.ts clock.ts dev.ts   registered functions (thin)
  *.test.ts               convex-test suites; helpers in convex/test/, named *.helpers.ts
                          (Convex deploys every .ts file under convex/ whose name has one dot)
src/
  proxy.ts                clerkMiddleware: sends signed-out visitors of app routes to sign-in (UX only)
  app/                    (public) landing, sign-in · (app) tools, listings, requests, incoming, admin
  features/               UI by domain: shell/ (providers, app shell, ensureUser), tools/, loans/,
                          admin/, automation/
  components/ui/          shadcn/ui primitives
  lib/                    client helpers (Convex error → message, date formatting)
n8n/workflows/            exported, sanitized workflow JSON (stable IDs)
compose.yml               n8n and Mailpit (n8n reads .env.n8n)
scripts/                  setup, admin grant, seed, n8n export/check, ID check, smoke tests
```

Registered functions stay thin: they validate arguments, call `model/*`, and return. This follows
Convex's recommended pattern, and keeps the rules testable in one place.

## 4. Data model

All timestamps are epoch milliseconds (`number`). Loan dates are calendar-date strings
`YYYY-MM-DD` ([ADR-008](adr/ADR-008-calendar-dates-in-one-app-timezone.md)). Join dates come from
`_creationTime`.

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `tokenIdentifier` | string | From the Clerk identity. Unique, enforced in `ensureUser`. |
| `displayName` | string | "Alex P." from the identity's given and family names. If Clerk provides no name: "Neighbor ####", 4 digits derived from the user ID, **never** from the email. Control characters removed; at most 40 characters. |
| `email` | string | Used only for notifications and the contact reveal (BR-16) |
| `role` | `"user" \| "admin"` | Defaults to `"user"`. Changed only by the internal `grantRole`. |
| `isTrustedLender` | boolean | Set by admins (BR-17) |

Indexes: `by_token (tokenIdentifier)`, `by_email (email)` (used by the CLI admin grant).

### `tools`

| Field | Type | Notes |
| --- | --- | --- |
| `ownerId` | `Id<"users">` | |
| `name`, `description` | string | BR-3 limits. The name is single-line, with no control characters. |
| `category` | union of BR-1 | |
| `condition` | union of BR-2 | |
| `status` | `"active" \| "deleted" \| "removed"` | Soft delete: `deleted` by the owner, `removed` by an admin |
| `removedAt`, `removedBy`, `removedReason` | optional | Set when an admin removes the listing |

Indexes: `by_owner (ownerId, status)`, `by_status (status)` (newest first, for the public list),
`by_status_category (status, category)`.

### `loans`

Requests and loans live in one table, because a loan is an approved request.

| Field | Type | Notes |
| --- | --- | --- |
| `toolId`, `lenderId`, `borrowerId` | ids | `lenderId` is copied from the tool at request time, for the incoming index |
| `startDate`, `endDate` | `YYYY-MM-DD` | Inclusive range |
| `note` | optional string | Shown to the lender in the app. Never sent to n8n. |
| `status` | `"pending" \| "approved" \| "declined" \| "cancelled" \| "expired" \| "returned"` | §6 |
| `statusReason` | optional `"dates_taken" \| "cancelled_by_borrower" \| "cancelled_by_lender" \| "listing_deleted" \| "listing_removed"` | |
| `decidedAt`, `cancelledAt`, `returnedAt` | optional number | |
| `remindersSent` | number | Starts at 0. Increased once per `sent` reminder (BR-20). |

Indexes: `by_tool_status (toolId, status)`, `by_borrower (borrowerId, status)`,
`by_lender (lenderId, status)`, `by_status_end (status, endDate)` (overdue, and due reminders),
`by_status_start (status, startDate)` (expiry).

### `outbox`

One row per loan event that has to reach n8n ([ADR-003](adr/ADR-003-convex-decides-n8n-delivers.md)).
It stores **IDs, not personal data**. The payload is built when it is sent.

| Field | Type | Notes |
| --- | --- | --- |
| `eventId` | string | UUID, sent as `X-LendLoop-Event-Id` and used as the idempotency key |
| `type` | `loan.requested \| loan.approved \| loan.declined \| loan.cancelled \| loan.expired \| loan.returned` | |
| `loanId`, `recipientId` | ids | The recipient is resolved when the event is enqueued (BR-19) |
| `status` | `"pending" \| "delivered" \| "failed"` | `failed` is the dead letter (§7.3) |
| `attempts`, `nextAttemptAt` | number | The current attempt (1–5) and when it is due (§7.3) |
| `lastErrorCode`, `lastStatusCode` | optional | An error class, never a response body |
| `deliveredAt` | optional number | |

Indexes: `by_status_next (status, nextAttemptAt)` (the sweep and health), `by_event (eventId)`,
`by_loan (loanId)`.

### `automationEvents`

Per-loan automation activity (AUT-3), and the idempotency store for notification and reminder
records.

| Field | Type | Notes |
| --- | --- | --- |
| `idempotencyKey` | string | `notification:<eventId>` or `reminder:<loanId>:<date>`. Unique (§10). |
| `loanId` | `Id<"loans">` | |
| `kind` | `"notification" \| "reminder"` | |
| `eventType` | optional loan event type | For notifications |
| `recipientRole` | `"lender" \| "borrower"` | |
| `status` | `"sent" \| "failed"` | A `sent` record never changes again (§8) |
| `errorCode`, `errorMessage` | optional string | The message is redacted and truncated to 200 characters. **Shown to admins only.** |
| `occurredAt` | number | The last change |

Indexes: `by_key (idempotencyKey)`, `by_loan (loanId, occurredAt)`.

### `workflowRuns`

Run summaries (heartbeat) and workflow errors reported by n8n.

| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | `run:<runId>` or `error:<errorId>`. Both IDs are UUIDs minted in the workflow, so they stay unique when n8n's own execution IDs restart. Unique. |
| `workflow` | string | A slug such as `overdue-reminders` or `loan-event-notifications`. Unknown values are stored as sent (at most 64 characters), never rejected. |
| `kind` | `"run" \| "error"` | |
| `counts` | optional `{ total, sent, failed }` | For runs |
| `receivedAt` | number | Convex time. The heartbeat's age is measured from this, so a skewed n8n clock cannot fake freshness. |
| `node`, `errorCode`, `errorMessage` | optional string | For errors. Redacted and truncated. |

Indexes: `by_key (key)`, `by_workflow_kind (workflow, kind, receivedAt)` (heartbeat),
`by_kind_received (kind, receivedAt)` (recent errors under any slug, including unknown ones).

### `clock`

A single row. A cron ticks every minute but writes the row only when the date or the hour has
changed. Queries read it for "today" and "now", so they re-run once an hour, and within a minute of
midnight (§6).

| Field | Type | Notes |
| --- | --- | --- |
| `key` | `"clock"` | |
| `today` | `YYYY-MM-DD` | In `APP_TIMEZONE` |
| `now` | number | The time of the last write, so at hour precision |

Index: `by_key (key)`.

### `auditLog`

| Field | Type | Notes |
| --- | --- | --- |
| `actorId` | optional `Id<"users">` | Empty for CLI and system actions |
| `action` | `"tool.removed" \| "user.trusted" \| "user.untrusted" \| "user.role_changed" \| "outbox.retried" \| "outbox.retried_all"` | |
| `targetTable`, `targetId` | string | |
| `reason` | optional string | |
| `at` | number | |

Index: `by_at (at)`.

## 5. Authorization

### 5.1 Function wrappers

`convex/lib/functions.ts` builds the only public function builders, using `convex-helpers`
custom functions:

| Builder | Requires | Injects |
| --- | --- | --- |
| `publicQuery` | Nothing. Used only by `tools:listPublic` and `config:get`, which must both declare `returns` validators. | — |
| `identityMutation` | A valid Clerk identity, with no `users` row needed yet. Used only by `users:ensureUser`, which creates that row. | `ctx.identity` |
| `userQuery`, `userMutation` | A valid Clerk identity, plus a `users` row | `ctx.user` |
| `adminQuery`, `adminMutation` | The above, plus `role === "admin"` | `ctx.user` |

- **The acting user always comes from `ctx.auth`.** No public function accepts a user ID for
  "me".
- **Resource checks live in `model/*`:** `assertToolOwner`, `assertLender`, `assertBorrower` and
  `assertLoanParty`. The error code is fixed per resource:
  - **Tools** are visible to every signed-in user, so acting on someone else's tool returns
    `FORBIDDEN`.
  - **Loans** are private to their two parties, so a non-party gets `NOT_FOUND`. The error doesn't
    reveal that the loan exists.
- **Internal functions** (`internalQuery`, `internalMutation`, `internalAction`) serve n8n (through
  the HTTP endpoints), crons, and CLI operations such as `users:grantRole` and the `dev:*` seeds.
  The `dev:*` functions refuse to run unless `ALLOW_DEV_FUNCTIONS=true`.
- **An ESLint rule** forbids importing `query`, `mutation` and `action` from
  `convex/_generated/server` anywhere except `lib/functions.ts`. Forgetting the wrapper therefore
  becomes a lint error, not a review finding.
- **Errors** are `ConvexError` values with a code: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `VALIDATION`, `CONFLICT` or `RATE_LIMITED`. The UI turns each code into a plain message.

### 5.2 User records

On sign-in, the client calls `users:ensureUser`. It upserts the row from the identity's claims
(name and email), so later queries can rely on `ctx.user`. The Clerk instance is configured to
require first and last names. Clerk webhooks for profile changes and deletion are a production
item (TD-001).

### 5.3 Permission matrix

| Action | Visitor | `user` | `admin` |
| --- | --- | --- | --- |
| See the public list of available tools (name, category) | ✓ | ✓ | ✓ |
| Browse all tools with status, owner display name and badge | — | ✓ | ✓ |
| Create a listing | — | ✓ | ✓ |
| Edit or delete a listing | — | own | own |
| Remove any listing | — | — | ✓ |
| Request to borrow | — | others' tools | others' tools |
| Approve, decline or mark returned | — | loans on own tools | loans on own tools |
| Cancel | — | per BR-10 | per BR-10 |
| See loans | — | own (as borrower or lender) | all |
| See a counterparty's email | — | approved loans only (BR-16) | approved loans only (own) |
| See a loan's automation activity | — | own loans: status only | all, with redacted error detail |
| Set Trusted Lender | — | — | ✓ |
| Automation health; retry one or all dead letters | — | — | ✓ |
| Grant a role | CLI only (internal function) | | |

## 6. Loan lifecycle, availability and time

```mermaid
stateDiagram-v2
  [*] --> pending: request (borrower)
  pending --> approved: approve (lender)
  pending --> declined: decline (lender) or auto-decline (dates taken)
  pending --> cancelled: cancel (borrower) or listing deleted/removed
  pending --> expired: start date passed (cron)
  approved --> cancelled: cancel before start (either party) or listing deleted/removed before start
  approved --> returned: mark returned (lender, once started)
  declined --> [*]
  cancelled --> [*]
  expired --> [*]
  returned --> [*]
```

- **Overdue is derived**, not stored: an approved loan whose end date is before today. After
  7 sent reminders a loan is **long overdue**: reminders stop and admins see a flag (BR-20).
- Every transition goes through `transition()` in `model/loans.ts`: one mutation that writes the
  new status **and** enqueues exactly one outbox event, in the same transaction.
- Approval runs the overlap check and the auto-decline of overlapping pending requests in the
  same transaction. Convex mutations are serializable, so two approvals racing for the same dates
  cannot both succeed.
- Expiry runs when the clock tick writes a new date (below). It expires pending requests whose
  start date is before the new today, in batches.

**Availability** (BR-12) is computed when it is read, from `loans.by_tool_status`. At this scale
it is cheap (TD-004 covers scaling).
- `tools:listPublic` returns up to 60 available tools (active, and not on loan today), newest
  first. It reads active tools newest first through `tools.by_status`, skips those on loan, and
  stops after 60 available tools or 240 reads.
- `tools:list` is paginated, 20 per page.
- `tools:mine` returns at most 100 tools, each with its availability and pending-request count.

**Time.** Convex caches query results until the data they read changes, so a query that calls
`Date.now()` would never notice midnight passing. Instead:
- A cron ticks every minute. It writes the `clock` row (`today` in `APP_TIMEZONE`, and `now`) only
  when the date or the hour has changed, and the tick that writes a new date also runs expiry.
- Queries take "today" and "now" from that row through `lib/dates.ts`. Open views re-run once an
  hour, and within a minute of midnight, so availability, overdue state and time-based health flags
  update by themselves.
- Mutations compute the current time directly, because they are never cached. For up to a minute
  after midnight, a mutation can therefore be a day ahead of an open view. The server stays
  authoritative: a date that has just become invalid is rejected with `VALIDATION`, and the UI
  explains it.
- `npm run setup` seeds the row. Until it exists (at most a minute after the very first
  deployment), `readClock` computes the time itself. That is the only `Date.now()` on a query path,
  and it cannot stick: a query that found no row re-runs when the row is written.

## 7. Convex → n8n: loan events

### 7.1 Flow

```mermaid
sequenceDiagram
  participant UI as Browser
  participant M as Convex mutation
  participant O as outbox
  participant A as deliver action
  participant N as n8n webhook
  participant S as SMTP

  UI->>M: approve(loanId)
  M->>M: check rules, update loan
  M->>O: insert event (pending, attempt 1)
  M->>A: scheduler.runAfter(0, deliver, attempt 1)
  Note over M,O: one transaction: no lost or phantom events
  A->>A: build minimal payload, sign
  A->>N: POST /webhook/lendloop/loan-events (aborted after 30 s)
  N->>N: verify signature and timestamp
  N->>S: send email (no retry inside n8n; workflow timeout 20 s)
  N-->>A: 200 {"delivered": eventId} (only after sending)
  A->>O: record the outcome of attempt 1: delivered, "notification sent" record
```

### 7.2 Payload (version 1)

```json
{
  "version": 1,
  "eventId": "9b2f…",
  "type": "loan.approved",
  "occurredAt": "2026-11-10T14:03:00.000Z",
  "recipient": { "name": "Sam K.", "email": "sam@example.com", "loanRole": "borrower" },
  "counterparty": { "name": "Alex P." },
  "tool": { "name": "Cordless drill" },
  "loan": { "startDate": "2026-11-12", "endDate": "2026-11-14", "reason": null },
  "link": "http://localhost:3000/requests"
}
```

`loanRole` tells the template which wording to use. Nothing else is sent: no loan ID, account
roles, descriptions, notes, Clerk IDs, or other users' emails.

Headers: `Content-Type: application/json`, `X-LendLoop-Event-Id`, `X-LendLoop-Timestamp`, and
`X-LendLoop-Signature` (§9).

### 7.3 Delivery and retries

```mermaid
stateDiagram-v2
  [*] --> pending: transition() enqueues
  pending --> pending: retryable outcome, next attempt after the backoff
  pending --> delivered: positive acknowledgement
  pending --> failed: permanent outcome, or the 5th attempt failed
  failed --> pending: admin Retry or Retry all
  delivered --> [*]
```

`failed` is the dead letter. Each row counts its `attempts`, and every scheduled delivery carries
the attempt number it was scheduled for.

**Deliver** (internal action, `deliver(outboxId, attempt)`). It stops at once unless the row is
`pending` at that attempt, so a duplicate or stale schedule does nothing. Otherwise it builds the
payload through an internal query, signs it, posts it with a **30 s** abort, and **always**
finishes by calling `recordOutcome` with the attempt number. A thrown error becomes `CONFIG` (a
missing URL or secret) or `INTERNAL`.

**Record outcome** (internal mutation) applies only while the row is still `pending` at that
attempt:

| Outcome | Classified as | Result |
| --- | --- | --- |
| `200` with `{"delivered":"<eventId>"}` | success | `delivered`, plus a `notification:<eventId>` record ("notification sent") |
| Any other `2xx` body (`BAD_ACK`), network error, timeout, `404` (workflow not active), `408`, `429`, `5xx` | retryable | The next attempt, scheduled in the same mutation, or `failed` after the 5th |
| `CONFIG`, `INTERNAL`, `400`, `401`, `403`, `413`, `422`, any other `4xx` | permanent | `failed` at once |

**Positive acknowledgement.** n8n answers `{"delivered":"<eventId>"}`, echoing the event's ID, only
after the email is sent. Nothing else counts, so a default reply from an execution that never
reached its Respond node can't mark an unsent email as delivered.

**Timeouts.** The n8n notification workflow has a **20 s** execution timeout, and its email step
doesn't retry. n8n therefore answers, or gives up, before Convex aborts at 30 s, which keeps the
outbox the only retry authority
([ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md)).

**Backoff.** Retries wait 30 s, 2 min, 10 min and 1 h: 5 attempts in all.

**Sweep** (cron, every 10 minutes). Convex never re-runs a scheduled action that crashed, so a
`pending` row whose `nextAttemptAt` is more than 10 minutes past has lost its delivery. The sweep
counts that as a failed attempt (`INTERNAL`) and schedules the next one, or dead-letters the row.

**Admin retry**, for one dead letter or all of them (in batches): the row returns to `pending` at
attempt 1, its delivery is scheduled now, and an audit entry is written.

**No per-loan ordering.** If an event needs a retry, a later event of the same loan can arrive
first. Each email states the loan's new status in full, so this is accepted.

## 8. n8n → Convex: HTTP endpoints

All endpoints are `POST` with a JSON body, signed with `N8N_TO_CONVEX_SIGNING_SECRET`. Checks run
in this order:
1. **Size:** a body over 64 KiB gets `413`, checked before the body is read in full.
2. **Signature and timestamp:** `401`, with no body.
3. **Body validation:** `400`.
4. **Handler:** `200`, including for duplicates.

The reason for a rejection goes to the Convex logs as a code, never into the response, and
nothing about it is stored. Handlers call **internal** functions only.

| Path | Request | Response |
| --- | --- | --- |
| `/n8n/reminders/due` | `{}` | `{ asOf, loans: [{ loanId, reminderKey, borrower: { name, email }, lender: { name }, tool: { name }, startDate, endDate, daysOverdue, link }] }`, at most 50 loans |
| `/n8n/reminders/result` | `{ reminderKey, loanId, status: "sent" \| "failed", errorCode?, errorMessage? }` | `{ result: "recorded" \| "duplicate" }` |
| `/n8n/runs` | `{ runId, workflow, counts: { total, sent, failed } }` | `{ result: "created" \| "duplicate" }` |
| `/n8n/errors` | `{ errorId, workflow, node?, errorCode, errorMessage }` | `{ result: "created" \| "duplicate" }` |

**Due reminders** (read-only). Through `loans.by_status_end`, it reads approved loans whose end
date is before today, oldest first, at most 200. It keeps those with fewer than 7 reminders sent
and no `sent` reminder for today (`reminder:<loanId>:<today>`), up to 50. Nothing is claimed or
locked.

**Reminder result** (one mutation, keyed by `reminderKey`):
- **Validation (`400`):** the key must equal `reminder:<loanId>:<date>`, match the body's
  `loanId`, and have a date no later than today; the loan must exist.
- **`sent`:** if that day's record isn't `sent` yet, it becomes `sent` (created, or updated from
  `failed`), and `loans.remindersSent` goes up by one. A repeated `sent` is a `duplicate`.
- **`failed`:** creates the record or updates a `failed` one. It never overwrites `sent`.

A loan whose reminder failed stays due, so the next run tries again.

**Redaction.** Error messages are redacted again in Convex (`lib/redact.ts`) before they are
stored, whatever n8n sent.

## 9. Request signing

The same scheme is used in both directions ([ADR-004](adr/ADR-004-hmac-request-signing.md)):

```
canonical = timestamp + "\n" + METHOD + "\n" + path + "\n" + rawBody
key       = UTF-8 bytes of the secret string (as stored, base64url text)
signature = hex( HMAC-SHA256(key, canonical) )

X-LendLoop-Timestamp: 1762783380            (unix seconds)
X-LendLoop-Signature: v1=5f2c…              (scheme version prefix)
```

- **Verification:** the timestamp must be within ±300 s; recompute the signature over the
  **raw** body bytes; compare in constant time.
  - **Convex** rejects before parsing the JSON.
  - **n8n** parses the body before the Code node runs, so it verifies before **using** any field.
- **Senders** transmit exactly the bytes they signed. n8n builds the JSON string once, signs that
  string, and sends it as a raw body, including `{}` bodies.
- **Path** is the URL path only, without host or query. That ties a signature to one endpoint,
  whichever host name reaches it (`localhost` or `host.docker.internal`).
- **Two secrets:**
  - `CONVEX_TO_N8N_SIGNING_SECRET` signs calls **to** n8n: loan events, and the scripted
    `run-reminders` trigger.
  - `N8N_TO_CONVEX_SIGNING_SECRET` signs n8n's calls to Convex.

  A leak on one side cannot forge calls in the other direction.
- **Test vector:** `convex/lib/hmac.test.ts` holds a fixed vector (secret, timestamp, method,
  path, body, expected signature). The n8n Code node is checked against the same vector.
- **Replays:** a replay to a Convex endpoint inside the 5-minute window is absorbed by
  idempotency (§10). A replay of a loan event to n8n inside the window **would** send the email
  again. That residual risk is documented (security.md §6, TD-006).

## 10. Idempotency

Convex has no unique indexes, so uniqueness is enforced inside one mutation: look up by key, then
insert. Mutations are serializable, so two concurrent duplicates conflict; Convex retries the
loser, which then finds the existing row.

| Write | Key | On duplicate |
| --- | --- | --- |
| Notification sent | `notification:<eventId>` | No-op |
| Reminder | `reminder:<loanId>:<date>` | `sent` is final and counted once; `failed` never overwrites it |
| Run summary | `run:<runId>` | No-op |
| Workflow error | `error:<errorId>` | No-op |

**Delivery is at least once.** n8n acknowledges a loan event only after the email is sent, and a
reminder is written back `sent` only after it is sent. A duplicate email is possible in a few
narrow cases:
- a notification's acknowledgement is lost after a successful send, or a send completes after
  the execution timeout made n8n answer with an error, and Convex retries the event;
- a reminder is sent but its write-back never lands (n8n crashes, or the call fails after its
  retries), so the loan stays due and the next run sends again;
- two reminder runs overlap, for example a scripted run during the scheduled one;
- an SMTP server accepts a message and drops the connection before replying (RFC 1047), so the
  sender reports an error although the email went out.

All are documented in [ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md) and
TD-006, together with the replay case (§9). Duplicate **records** are impossible in all of them.

## 11. n8n workflows

The workflows are exported to `n8n/workflows/` with **stable, committed IDs**. Every workflow
except the error handler names the handler's ID in `settings.errorWorkflow`. Setup imports every
workflow in `n8n/workflows/` and **publishes** each by ID; on n8n 2.x an unpublished error
workflow never runs. `check:workflows` verifies the links. Secrets appear only as `$env.*`
references and n8n credentials.

**Loan event notifications** (`loan-event-notifications.json`, execution timeout 20 s)
1. Webhook `POST /webhook/lendloop/loan-events` (raw body; responds through a Respond node).
2. Verify the signature (Code node). If it fails, respond `401` and stop.
3. Switch on `type`, then build the plain-text subject and body. A **fallback branch** catches an
   unknown `type`: it responds `422` and then stops with an error, so Convex dead-letters the event
   at once and the error workflow records it.
4. Send the email over SMTP. **No Retry On Fail**: Convex owns retries.
5. Respond `200` with `{"delivered":"<eventId>"}` (§7.3). If sending fails, the execution fails,
   the webhook answers with an error status, the error workflow fires, and Convex retries later.

**Overdue reminders** (`overdue-reminders.json`, execution timeout 10 minutes). Two triggers:
- **Schedule:** daily at 09:00 in n8n's timezone, which setup sets to `APP_TIMEZONE` through
  `GENERIC_TIMEZONE` and `TZ` in `.env.n8n`.
- **Signed webhook** `POST /webhook/lendloop/run-reminders`, for scripts such as the smoke test.
  It is verified like loan events.

Steps:
1. Mint a `runId` (UUID).
2. Sign the request and call `/n8n/reminders/due`.
3. For each loan, **one at a time** (Loop Over Items, batch size 1):
   1. Email the borrower. **No Retry On Fail**; a failure goes to the error output.
   2. Write back `sent`, or `failed` with an error code and a redacted message, to
      `/n8n/reminders/result`. The call retries, because write-backs are idempotent.
4. Post the run summary to `/n8n/runs`, even when nothing was due. Its arrival time is the
   reminder workflow's heartbeat.

One loan per iteration matters: the Send Email node sends every item it receives in one go, so a
retried batch could email some borrowers twice.

**Error handler** (`error-handler.json`)
1. Error Trigger.
2. Mint an `errorId`, then build the error fields: the workflow slug, the failing node, an error
   code, and a redacted, truncated message. Never the failed execution's payload.
3. Sign the request and post it to `/n8n/errors`, with retries. If Convex can't be reached, the
   failed execution stays in n8n's execution list.

## 12. Failure handling and visibility

| Failure | Detected by | Visible as |
| --- | --- | --- |
| n8n unreachable, or failing, for a loan event | Outbox retries, then a dead letter | Admin health: failed deliveries, with **Retry** and **Retry all** |
| n8n answers without the positive acknowledgement | `BAD_ACK`, retried like an error | The code on the event; a dead letter if it persists |
| A workflow step fails | The n8n error workflow | Admin health: recent workflow errors |
| One reminder email fails | The item's error branch writes back `failed` | The loan's activity, with redacted detail for admins. The next run tries again. |
| The reminder workflow stops running (n8n down, schedule off) | No `overdue-reminders` run summary in 26 h, measured on the `clock` | Admin health: the last run, with a stale warning. A fresh setup shows **no run yet**, not stale. |
| A call is rejected by a Convex endpoint (bad signature, stale timestamp, bad body) | The endpoint's checks | The Convex logs, as a code. A wrong secret also fails n8n's own calls, which raises workflow errors. |
| A Convex function throws | Convex logs | The local Convex dashboard. Logs carry IDs and codes, never personal data. |

The admin navigation shows a badge when there are failed deliveries, a workflow error in the last
24 hours, or a stale reminder run.

n8n keeps failed executions for 7 days. It saves **neither** successful **nor** manual executions,
because they contain email addresses ([security.md §4](security.md#4-data-minimization)).

## 13. Configuration and secrets

| Variable | Lives in | Purpose | Secret |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` (written by `npx convex dev`) | Convex client and the local deployment. The app doesn't read the site URL. | no |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clerk frontend | no |
| `CLERK_SECRET_KEY` | `.env.local` | Clerk server side (`proxy.ts`) | **yes** |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env | Clerk JWT issuer (the Frontend API URL) for `auth.config.ts`, which reads `process.env` directly: Convex evaluates that file on its own. Convex refuses to deploy while it is unset. | no |
| `APP_URL` | Convex env | Links in emails | no |
| `APP_TIMEZONE` | Convex env, and `.env.n8n` (where setup also sets `GENERIC_TIMEZONE` and `TZ` to the same value) | Calendar "today", and n8n's schedule timezone | no |
| `N8N_LOAN_EVENTS_URL` | Convex env (setup sets `http://localhost:5678/webhook/lendloop/loan-events`) | Webhook URL | no |
| `CONVEX_TO_N8N_SIGNING_SECRET` | Convex env, and `.env.n8n` | Signs calls to n8n | **yes** |
| `N8N_TO_CONVEX_SIGNING_SECRET` | Convex env, and `.env.n8n` | Verifies n8n's calls | **yes** |
| `ALLOW_DEV_FUNCTIONS` | Convex env (dev only) | Allows the `dev:*` seed functions | no |
| `CONVEX_SITE_URL` | `.env.n8n` (`http://host.docker.internal:3211`) | Base URL of the Convex HTTP endpoints | no |

- **n8n's encryption key** is n8n's own: generated on first start and kept in its data volume
  (`~/.n8n/config`), so it is never in `$env`. Deleting the volume loses the stored SMTP
  credential, which setup recreates.
- **Templates:** `.env.example` (Next.js) and `.env.n8n.example` (compose) document every
  variable.
- **Why `.env.n8n`:** compose gives it to the n8n service only (`env_file` on that one service),
  and Next.js never loads it (Next.js loads only `.env`, `.env.local` and `.env.[mode]`).
- **`npm run setup`** is idempotent:
  - generates the two signing secrets (32 random bytes each, as base64url text) into `.env.n8n`
    if they are missing, and sets `GENERIC_TIMEZONE` and `TZ` there to `APP_TIMEZONE`;
  - sets the Convex env without ever printing a value;
  - starts the compose stack, imports and publishes the workflows, and creates the Mailpit SMTP
    credential;
  - runs one clock tick, so the `clock` row exists from the start.

## 14. Local development topology

Everything runs on the developer's machine; only Clerk is in the cloud
([ADR-001](adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md), amended 2026-11-11):

```mermaid
flowchart LR
  subgraph PC["Your machine"]
    BR["Browser"] --> NX["Next.js dev :3000"]
    CX["Convex local deployment<br/>:3210 · HTTP actions :3211<br/>(npx convex dev)"]
    subgraph DC["docker compose"]
      N8["n8n :5678 (localhost only)"] --> MP["Mailpit<br/>SMTP :1025 · inbox :8025"]
    end
    BR -- "Clerk JWT" --> CX
    CX -- "signed POST to localhost:5678" --> N8
    N8 -- "signed POST to host.docker.internal:3211" --> CX
  end
  CK["Clerk"]
  BR -- "sign-in" --> CK
  CX -- "JWKS" --> CK
```

- **Local Convex:** `npx convex dev` provisions an anonymous local deployment on first run (no
  Convex account), keeps the backend running while it runs, and pushes code on every change.
- **n8n → Convex** goes through `host.docker.internal`; compose maps it to the host gateway, so it
  also works on Linux.
- **Ports:** the Convex backend listens on all interfaces (3210, 3211). On a shared network, the
  host firewall should block them (security.md §6). n8n and Mailpit publish on `127.0.0.1` only.
- **Stopping:** on Windows, stopping `npx convex dev` can leave `convex-local-backend` running.
  The README says how to stop it.
- **State:** the local deployment keeps its admin key, its env values and its data in `.convex/`
  (gitignored; a secret location, security.md §5).

## 15. Testing strategy

| Layer | Tooling | Covers |
| --- | --- | --- |
| Convex functions | Vitest + `convex-test` (edge-runtime environment; components such as the rate limiter registered explicitly) | Access rules for every public function; every loan transition (valid and invalid starting states); business-rule boundaries; the outbox (acknowledgement, retry classification, backoff, the attempt guard, dead letters, admin retry, the sweep); due reminders and reminder results (the 7-reminder cap, `sent` counted once, `failed` never overwriting `sent`); HTTP endpoints (check order, signatures, bodies, duplicates); redaction |
| Libraries and scripts | Vitest (node) | HMAC against the fixed vector, date helpers, redaction, workflow sanitizer and checker, ID checker |
| Local stack | `npm run smoke:notifications` and `npm run smoke:reminders`, plus recorded manual checks | A signed event → an email in Mailpit (through the Mailpit API) and the positive acknowledgement; invalid requests → `401` and no email; a reminder run twice on one day → one email and one record |
| UI | Typecheck, plus a manual QA checklist in each block's completion log | Views and states |

CI runs on every pushed branch and on PRs: typecheck, lint, tests, build, the workflow-JSON check
and the duplicate-ID check.

## 16. Open verification items

These come from the platform versions current on 2026-11-10 (Next.js 16.4, Clerk 7.9, Convex 1.49,
n8n 2.47, TypeScript 7.0). They are checked in the listed block, and the outcome is recorded in
its completion log.

| Item | Block |
| --- | --- |
| TypeScript: pin 6.0.x if `typescript-eslint` still requires `<6.1`; confirm what `create-next-app` installs | 001 (settled) |
| Local Convex: an anonymous deployment without an account; HTTP actions, crons, the scheduler, env vars and components; an n8n container reaching it, and it reaching the host's `localhost` | 001 (settled by a spike, 2026-11-11) |
| Next.js 16 `proxy.ts` (renamed middleware) with Clerk 7's `clerkMiddleware` | 002 |
| Clerk ↔ Convex on a local deployment (dashboard integration, `auth.config.ts` format), which claims carry the name and email, and the fallback if they don't (customize the session token claims; never give Convex the Clerk secret key) | 002 |
| `ClerkProvider` and the Convex client provider under Cache Components (or turn Cache Components off, recorded) | 002 (settled) |
| Convex runtime support for `Intl.DateTimeFormat` with `timeZone` | 004 |
| `convex-test`: how components (rate limiter) are registered, and how HTTP actions are called | 003, 006 |
| Web Crypto HMAC in Convex actions and HTTP actions | 006 |
| n8n 2.x: `$env` access and `require('crypto')` in Code nodes under task runners | 007 |
| n8n 2.x: CLI import keeps IDs; publishing workflows by ID; an error workflow runs only when published | 007 |
| n8n 2.x: reading the raw webhook body; the execution timeout on webhook executions, and the status returned when a workflow fails before its Respond node | 007 |
| n8n 2.x: `GENERIC_TIMEZONE` and `TZ` from `.env.n8n` make n8n report `APP_TIMEZONE` as its timezone | 007 |
| `npx convex env set` reading the value from stdin | 007 |
