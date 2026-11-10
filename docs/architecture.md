# LendLoop — Architecture

**Status:** Baseline v1.3 (2026-11-10, revised after planning review
[rounds 1](reviews/planning-baseline-review-1.md), [2](reviews/planning-baseline-review-2.md) and
[3](reviews/planning-baseline-review-3.md))
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
   letters, workflow errors, abandoned and missed reminder claims, rejected calls and a heartbeat
   are all visible ([ADR-006](adr/ADR-006-failure-visibility.md)).
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
  N -- "signed POST: overdue claims,<br/>write-backs, heartbeat, errors" --> C
  N -- "email" --> M
```

| Component | Responsibility |
| --- | --- |
| **Next.js** (App Router) | UI only. Server Components for static shells, Client Components where Convex hooks are needed. `proxy.ts` (Clerk) redirects signed-out users away from app routes, for UX only. |
| **Clerk** | Sign-in, sessions, and the JWT that Convex verifies. |
| **Convex** | Data, business rules, authorization, the outbox, the clock, scheduled functions, the HTTP endpoints n8n calls, and crons. |
| **n8n** | Three workflows: loan-event notifications, overdue reminders (hourly in the daytime, at most one reminder per loan per day), and an error handler. |
| **Mailpit** | Local SMTP server that catches every email and shows it in an inbox UI ([ADR-007](adr/ADR-007-email-via-smtp-mailpit-locally.md)). |

## 3. Modules and code layout

| Code | Module | Owns |
| --- | --- | --- |
| `PLT` | Platform | Function wrappers, errors, shared validators, dates, the clock, signing, redaction, the HTTP router, crons, tooling, CI |
| `AUTH` | Identity and roles | `users`, role and trust changes, `auditLog` |
| `TOOL` | Listings | `tools`, availability, the public list |
| `LOAN` | Borrowing | `loans`, the loan state machine, expiry |
| `AUTO` | Automation | `outbox`, `automationEvents`, `workflowRuns`, `integrationStats`, the n8n endpoints, the n8n workflows |
| `WEB` | Web shell and UX | Layout, navigation, shared components, UX states |

```
convex/
  schema.ts               all tables and indexes
  auth.config.ts          Clerk as the JWT issuer
  convex.config.ts        components (rate limiter)
  http.ts                 HTTP router: /n8n/* endpoints
  crons.ts                clock tick (every minute; runs request expiry when the date changes),
                          sweep (every 5 minutes: outbox deliveries and reminder claims)
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
  *.test.ts               convex-test suites; helpers in convex/test/
src/
  app/                    (public) landing · (app) tools, listings, requests, incoming, admin
  features/               UI by domain: tools/, loans/, admin/, automation/
  components/ui/          shadcn/ui primitives
  lib/                    client helpers (Convex error → message, date formatting)
n8n/workflows/            exported, sanitized workflow JSON (stable IDs)
compose.yml               n8n, Mailpit, edge proxy, cloudflared (reads .env.n8n)
infra/Caddyfile           edge proxy allowlist
scripts/                  setup, tunnel sync, admin grant, seed, n8n import/export/check, ID check, smoke tests
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
| `nextReminderOn` | optional `YYYY-MM-DD` | The next day a reminder is due (§8). Set to the day after `endDate` on approval, moved forward by each `sent` reminder while the loan is approved, and cleared after the 7th reminder or when the loan leaves `approved`. |

Indexes: `by_tool_status (toolId, status)`, `by_borrower (borrowerId, status)`,
`by_lender (lenderId, status)`, `by_status_end (status, endDate)` (overdue),
`by_status_start (status, startDate)` (expiry), `by_next_reminder (nextReminderOn)` (reminder
claims).

### `outbox`

One row per loan event that has to reach n8n ([ADR-003](adr/ADR-003-convex-decides-n8n-delivers.md)).
It stores **IDs, not personal data**. The payload is built when it is sent.

| Field | Type | Notes |
| --- | --- | --- |
| `eventId` | string | UUID, sent as `X-LendLoop-Event-Id` and used as the idempotency key |
| `type` | `loan.requested \| loan.approved \| loan.declined \| loan.cancelled \| loan.expired \| loan.returned` | |
| `loanId`, `recipientId` | ids | The recipient is resolved when the event is enqueued (BR-19) |
| `status` | `"pending" \| "delivered" \| "failed" \| "skipped"` | `failed` is the dead letter. `skipped` means a newer event for the same loan made this one obsolete (§7.3). |
| `attempts`, `nextAttemptAt` | number | §7.3 |
| `leaseUntil`, `leaseToken` | optional | Set by a claim. Only the holder of the current token may record an outcome. |
| `lastErrorCode`, `lastStatusCode` | optional | An error class, never a response body |
| `deliveredAt` | optional number | |

Indexes: `by_status_next (status, nextAttemptAt)`, `by_event (eventId)`, `by_loan (loanId)`. Convex
orders index entries by `_creationTime` last, which gives the per-loan FIFO order.

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
| `status` | `"sending" \| "sent" \| "failed" \| "abandoned" \| "missed"` | All but `sent` and `failed` exist only for reminder claims (§8). `abandoned`: the lease expired with no result. `missed`: the day ended that way. |
| `leaseUntil` | optional number | Reminder claim lease, 30 minutes (§8) |
| `attempts` | optional number | Reminder claims: how often the loan was claimed that day |
| `reclaimedBy` | optional string | Reminder claims: the run that took the claim over after it was abandoned |
| `errorCode`, `errorMessage` | optional string | The message is redacted and truncated to 200 characters. **Shown to admins only.** |
| `runId` | optional string | The n8n run that holds the claim, or that produced the record |
| `occurredAt` | number | The last change |

Indexes: `by_key (idempotencyKey)`, `by_loan (loanId, occurredAt)`, `by_run (runId)`,
`by_kind_status (kind, status)` (the claim sweep and health).

### `workflowRuns`

Run summaries (heartbeat) and workflow errors reported by n8n.

| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | `run:<runId>` or `error:<errorId>`. Both IDs are UUIDs minted in the workflow, so they stay unique when n8n's own execution IDs restart. Unique. |
| `workflow` | string | A slug such as `overdue-reminders` or `loan-event-notifications`. Unknown values are stored as sent (at most 64 characters), never rejected. |
| `kind` | `"run" \| "error"` | |
| `counts` | optional `{ total, sent, failed, reclaimed }` | For runs. `reclaimed` counts the loans this run took over from abandoned claims (§8). Loans skipped for lack of time are `total − sent − failed`. |
| `startedAt`, `finishedAt` | optional number | For runs, as reported by n8n |
| `receivedAt` | number | Convex time. Heartbeat age is measured from this, so a skewed n8n clock cannot fake freshness. |
| `node`, `errorCode`, `errorMessage` | optional string | For errors. Redacted and truncated. |
| `executionId` | optional string | For information only; trigger errors don't have one |

Indexes: `by_key (key)`, `by_workflow_kind (workflow, kind, receivedAt)` (heartbeat),
`by_kind_received (kind, receivedAt)` (recent errors under any slug, including unknown ones).

### `integrationStats`

One row per day of inbound rejections, so problems such as clock skew or a wrong secret are
visible. Counting is capped, so unauthenticated traffic cannot turn into unbounded writes (§8).

| Field | Type | Notes |
| --- | --- | --- |
| `day` | `YYYY-MM-DD` | |
| `counts` | `{ too_large, bad_signature, stale_timestamp, invalid_body }` | Inbound calls rejected with `413`, `401` (two reasons) or `400`. Each count stops at 100 a day; the panel then shows "100+". |
| `lastReason`, `lastAt` | optional | Updated only while that reason is under its cap |

Index: `by_day (day)`.

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
  M->>O: insert event (pending)
  M->>A: scheduler.runAfter(0, deliver)
  Note over M,O: one transaction: no lost or phantom events
  A->>O: claim (lease token, attempts+1)
  A->>A: build minimal payload, sign
  A->>N: POST /webhook/lendloop/loan-events (aborted after 30 s)
  N->>N: verify signature and timestamp
  N->>S: send email (no retry inside n8n; workflow timeout 20 s)
  N-->>A: 200 {"delivered": eventId} (only after sending)
  A->>O: record outcome with token: delivered, "notification sent" record
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
  pending --> pending: retryable outcome, next backoff step
  pending --> delivered: positive acknowledgement
  pending --> failed: permanent outcome, or no attempts left
  pending --> skipped: a newer event of the loan was delivered
  failed --> pending: admin Retry or Retry all
  failed --> skipped: admin retry, superseded
  delivered --> [*]
  skipped --> [*]
```

A `pending` row is in flight while it holds a live lease. `failed` is the dead letter.

**Timeouts.** The deliver action aborts its `fetch` after **30 s**, with an abort signal it sets
itself. The n8n notification workflow has an execution timeout of **20 s**, and its email step
does **not** retry. The invariant: n8n always answers, or gives up, before Convex does. That keeps
the outbox the only retry authority
([ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md)).

**Positive acknowledgement.** n8n answers `200` with the body `{"delivered":"<eventId>"}`, echoing
the event's ID, and only after the email is sent. Nothing else counts as delivered: any other 2xx
body is retryable (`BAD_ACK`). So a default reply from n8n, for example for an execution that
never reached its Respond node, can never mark an unsent email as delivered.

**Claim** (internal mutation). It succeeds only when all of these hold:
- the row is `pending`;
- `nextAttemptAt ≤ now`;
- there is no live lease;
- `attempts < 6`;
- no other event of its loan is in flight (holds a live lease), whether older or newer;
- no earlier event of its loan is `pending`. `delivered`, `failed` and `skipped` events don't
  block.

Together, the last two keep one loan's emails in order, one at a time.

It then increments `attempts`, sets a 2-minute lease and a fresh `leaseToken`, and returns the
token. Any other caller gets nothing. Two cases change the row instead, checked in this order:
- **Superseded:** if a newer event of the same loan is already `delivered`, the row becomes
  `skipped`, so stale news is never sent late. A dead letter revived while a newer event was in
  flight waits behind it (the rule above), and is skipped once that event is delivered.
- **Blocked:** if another event of the loan is in flight, or an earlier one is pending, the row's
  `nextAttemptAt` moves to the later of its own and that event's next attempt (or lease expiry, if
  it is in flight). Blocked rows therefore don't keep crowding the front of the sweep's index.

**Deliver** (internal action). It claims the row, builds the payload through an internal query,
signs it, and posts it. It **always** finishes by calling `recordOutcome` with the token. That
includes thrown errors: a missing URL or secret becomes `CONFIG`; anything else becomes
`INTERNAL`.

**Record outcome** (internal mutation). It ignores calls whose token is no longer current, so a
late answer cannot overwrite a newer attempt. Then:

| Outcome | Classified as | Result |
| --- | --- | --- |
| `2xx` with the positive acknowledgement | success | `delivered`, plus a `notification:<eventId>` record ("notification sent") |
| `2xx` with any other body | retryable, code `BAD_ACK` | `pending` with the next backoff step, or `failed` once 6 attempts are used up |
| Network error, timeout, `404` from n8n (workflow not active), `408`, `425`, `429`, `5xx` | retryable | The same |
| `530` (Cloudflare origin unreachable) | retryable, code `TUNNEL_STALE` | The same. Health suggests running `npm run tunnel:sync`. |
| `404` with `X-LendLoop-Edge: denied` (the URL is outside the edge allowlist) | permanent, code `CONFIG` | `failed` at once |
| `CONFIG`, `INTERNAL`, `400`, `401`, `403`, `413`, `422`, any other `4xx` | permanent | `failed` at once |

**Next in line.** Whenever a row becomes final (`delivered`, `failed` or `skipped`), the mutation
that made it final sets the `nextAttemptAt` of the loan's oldest pending event to now, and
schedules its delivery. A follow-up email, such as a request and then a quick cancel, doesn't wait
for the sweep.

**Backoff.** Retries wait 30 s, 2 min, 10 min, 1 h and 6 h, with ±20 % jitter: 6 attempts in all.

**Sweep** (cron, every 5 minutes, in bounded batches):
- schedules delivery for due `pending` rows without a live lease; the claim then applies every
  rule above;
- dead-letters rows whose lease expired after the sixth attempt, which is a crashed final attempt
  (code `INTERNAL`);
- runs the reminder-claim sweep (§8).

Convex runs a scheduled action at most once, and never re-runs one that crashed. The sweep is what
keeps such an event from being stranded.

**Admin retry**, for one dead letter or "Retry all":
- if a newer event of the same loan has already been delivered, marks the row `skipped` at once;
- otherwise resets `attempts`, returns the row to `pending`, and schedules its delivery;
- writes an audit entry.

## 8. n8n → Convex: HTTP endpoints

All endpoints are `POST` with a JSON body, signed with `N8N_TO_CONVEX_SIGNING_SECRET`. Checks run
in this order:
1. **Size:** a body over 64 KiB gets `413`. It is checked before the body is read in full.
2. **Signature and timestamp:** `401`, with no body.
3. **Body validation:** `400`.
4. **Handler:** `200`, including for duplicates.

The reason for every rejection goes to the Convex logs, never into the response. It is also
counted in that day's `integrationStats` row, at most 100 times per reason, so junk traffic causes
a bounded number of writes and contention. The response is decided before the count is attempted
and never depends on it: if the counter write fails, the failure is logged and the `413`, `401` or
`400` goes out unchanged. Handlers call **internal** functions only.

| Path | Request | Response |
| --- | --- | --- |
| `/n8n/overdue-loans` | `{ runId }` | **Claims** up to 50 loans for today (see below) and returns them: `{ asOf, reclaimed, loans: [{ loanId, reminderKey, borrower: { name, email }, lender: { name }, tool: { name }, startDate, endDate, daysOverdue, link }] }` |
| `/n8n/reminders` | `{ reminderKey, loanId, runId, status: "sent" \| "failed", errorCode?, errorMessage? }` | `{ result: "updated" \| "duplicate" \| "stale" }` |
| `/n8n/runs` | `{ runId, workflow, executionId?, startedAt, finishedAt, counts: { total, sent, failed, reclaimed } }` | `{ result: "created" \| "duplicate" }` |
| `/n8n/errors` | `{ errorId, workflow, executionId?, node?, errorCode, errorMessage, occurredAt }` | `{ result: "created" \| "duplicate" }` |

**Reminder claims** ([ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md)).
A loan gets at most one reminder per calendar day. That day's record,
`reminder:<loanId>:<today>`, is both the claim and the result:

```mermaid
stateDiagram-v2
  [*] --> sending: claimed by a run
  sending --> sent: write-back "sent"
  sending --> failed: write-back "failed" from the run holding the claim
  sending --> abandoned: lease expired (sweep)
  sending --> missed: lease expired after the day ended (sweep)
  failed --> sending: claimed by a later run that day
  abandoned --> sending: taken over by a later run that day
  abandoned --> missed: the day ended (sweep)
  sent --> [*]
  missed --> [*]
```

A `sent` write-back is accepted from any run, in any state except `sent`, because the email did go
out. A `failed` record whose day has ended stays `failed`: it is already visible, with its error.

`/n8n/overdue-loans { runId }` runs as one mutation:
1. **The run's own claims come first.** Records already `sending` under this `runId`, with a live
   lease, are returned again. A retried call therefore gets the same loans back, never an empty
   list.
2. **Then new claims, up to 50 loans in all.** It reads loans with a `nextReminderOn` from the
   lowest string up to today, `q.gt("nextReminderOn", "").lte("nextReminderOn", today)`, so loans
   without one (unset sorts first in Convex) are never read. It reads oldest first, at most 200
   loans. A loan qualifies when it is approved and has fewer than 7 reminders sent. Its record for
   today decides what happens:
   - missing: created as `sending`;
   - `failed`: claimed again;
   - `abandoned`, or `sending` with an expired lease that the sweep hasn't marked yet: taken over,
     with `reclaimedBy` set to this run;
   - `sending` under another run with a live lease, or `sent`: skipped.
3. Each claim sets the `runId`, a 30-minute lease, and `attempts + 1`.

The response's `reclaimed` counts the returned loans whose `reclaimedBy` is this run. A repeated
call reports the same number, and a loan is counted only by the run that took it over.

Because it is one serializable mutation, two overlapping runs can never claim the same loan.
`nextReminderOn` keeps the read small: finished loans, loans already reminded today, and
long-overdue loans are outside the range.

**The claim sweep** runs every 5 minutes, inside the sweep cron (§7.3):
- a `sending` claim whose lease has expired becomes `abandoned`, or `missed` if its day has
  already ended;
- an `abandoned` claim becomes `missed` once its day has ended.

Health therefore shows an interrupted run within minutes, whatever the clock's precision, and no
claim stays open past its day. A missed loan is still due, because its `nextReminderOn` didn't
move, so the next day's first run reminds the borrower.

**Leases outlast runs.** The reminder workflow handles one loan at a time and stops taking new
loans 8 minutes after it starts (§11). A send already in progress can still take about 13 minutes
with nodemailer's default timeouts (2 minutes to connect, 30 s for the greeting, 10 minutes idle),
and its write-back up to 2 minutes. A run's last action therefore ends within about 23 minutes of
its claims, inside the **30-minute** lease, so no other run takes over a claim while its run might
still act on it. The workflow's 10-minute execution timeout is only a backstop: n8n applies it
after the current node finishes. A send that is still in progress when its run stops can complete
without a write-back; its claim is then taken over and the email sent again (TD-006).

**Reminder write-back** (`/n8n/reminders`):
- **Validation (`400`):** the key must equal `reminder:<loanId>:<date>`, match the body's `loanId`,
  have a date no later than today, and refer to an existing record.
- **`sent`**, from any run and in any state except `sent`, moves the record to `sent`, which is
  final. In the same mutation, `loans.remindersSent` goes up by one. While the loan is still
  approved, `nextReminderOn` moves to the day after the reminder's date (never backwards), or is
  cleared at the 7th reminder (long overdue). A loan that has left `approved` keeps it cleared.
- **`failed`** applies only to the current claim: the record must be `sending` under the same
  `runId`. Otherwise it is ignored (`stale`), so a late failure from an old run can never reopen a
  newer run's live claim.
- A `sent` record never changes again (`duplicate`).

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
- **Path** is the URL path only, without host or query. That keeps the signature valid behind the
  tunnel and proxy, while tying it to one endpoint.
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
loser, which then finds the existing row. `convex-test` is not a real backend and cannot prove
this, so a smoke test sends concurrent write-backs to the dev deployment (§15).

| Write | Key | On duplicate |
| --- | --- | --- |
| Notification sent | `notification:<eventId>` | No-op |
| Reminder | `reminder:<loanId>:<date>` | The claim's state machine (§8): `sent` is final and counted once; `failed` applies only to the current claim; nothing ever downgrades. A claim call repeated with the same `runId` returns the same claims. |
| Run summary | `run:<runId>` | No-op |
| Workflow error | `error:<errorId>` | No-op |

**Delivery is at least once.** n8n acknowledges a loan event only after the email is sent, and a
reminder is written back `sent` only after it is sent. A duplicate email is possible in a few
narrow cases:
- the acknowledgement is lost after a successful send;
- the execution timeout cancels a notification while its SMTP send is still in progress, n8n
  answers with an error, the send completes anyway, and Convex retries the event;
- for a reminder, the send succeeds but the write-back never lands: n8n crashes, the write-back
  fails after its retries, or the run stops while a stalled send is still in progress. The claim
  is taken over and a later run sends again.

All are documented in [ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md) and
TD-006, together with the replay case (§9).

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
   the webhook gets an error status (whatever it is, it isn't the acknowledgement), the error
   workflow fires, and Convex retries later.

**Overdue reminders** (`overdue-reminders.json`, execution timeout 10 minutes as a backstop). Two
triggers:
- **Schedule:** every hour on the hour from 09:00 to 20:00 (cron `0 9-20 * * *`), in n8n's
  timezone, which setup sets to `APP_TIMEZONE` through `GENERIC_TIMEZONE` and `TZ` in `.env.n8n`.
  Each loan still gets at most one reminder a day. The later runs pick up claims that failed or
  were abandoned, and loans that a host asleep in the morning missed.
- **Signed webhook** `POST /webhook/lendloop/run-reminders`: for scripted runs, verified like loan
  events. Runs started from the editor bypass the error workflow, so scripts don't use them.

Steps:
1. Mint a `runId` (UUID), and note the start time.
2. Sign the request and call `/n8n/overdue-loans`, with retries. Retrying is safe: a repeated call
   with the same `runId` returns the same claims.
3. If the list is empty, go straight to the run summary with zero counts.
4. Otherwise, handle the loans **one at a time** (Loop Over Items, batch size 1). For each loan:
   1. Once 8 minutes have passed since the start, skip it without sending. Its claim expires and a
      later run takes it over.
   2. Email the borrower. **No Retry On Fail**: a failure is written back, and a later run tries
      again. Errors go to the error output.
   3. Write back straight away, with the `runId`: `sent`, or `failed` with an error code and a
      redacted message. The HTTP call has a 30 s timeout and retries, because write-backs are
      idempotent. If it still fails, the run fails: the error workflow fires, and the remaining
      claims are taken over later.
5. Aggregate, then post the run summary to `/n8n/runs`, with `reclaimed` from step 2. This is the
   heartbeat; it is posted even when there was nothing to remind.

One loan per iteration matters. n8n's Send Email node sends every item it receives in one go, its
Retry On Fail re-runs the whole node, and the execution timeout waits for the current node to
finish. A batch could therefore email some borrowers several times, or send many reminders with
no write-back.

**Error handler** (`error-handler.json`)
1. Error Trigger.
2. Mint an `errorId`, then build the error fields: the workflow slug, the failing node, an error
   code, and a redacted, truncated message. Never the failed execution's payload.
3. Sign the request and post it to `/n8n/errors`, with retries and "On Error: Continue".
4. **Always** email `ADMIN_ALERT_EMAIL`: workflow, node, code, redacted message, execution link.
   This happens even when the post failed, because Convex being unreachable is exactly when the
   alert matters.

## 12. Failure handling and visibility

| Failure | Detected by | Visible as |
| --- | --- | --- |
| n8n unreachable, or returns an error | Outbox retries, then a dead letter | Admin health: dead letters with **Retry** and **Retry all** |
| n8n answers without the positive acknowledgement | `BAD_ACK`, retried like an error | The code on the event; a dead letter if it persists |
| Tunnel URL out of date | `530` → `TUNNEL_STALE` | An admin health hint to run `npm run tunnel:sync`. `npm run dev` also syncs on start. |
| Webhook URL outside the edge allowlist | `404` with `X-LendLoop-Edge: denied` → `CONFIG` | A dead letter at once, with the code |
| A workflow step fails | n8n error workflow | An admin health entry (recent errors list every workflow slug, including unknown ones) and an admin email |
| One reminder email fails | Per-item error branch; only that loan is affected | Status on the loan's activity; the redacted detail and run counts for admins. A later run that day tries again. |
| A reminder run dies, or runs out of time mid-way | The sweep marks its unresolved claims `abandoned` within 5 minutes of their lease expiring | Admin health: **abandoned** claims, with a navigation badge, until a later run takes them over (counted as `reclaimed` in its summary) |
| A claim is still open when its day ends | The sweep marks it `missed` | Admin health: missed reminders for 24 h, with a navigation badge. The borrower is reminded the next day. |
| n8n down, or the schedule missed | **Heartbeat:** no `overdue-reminders` run summary received in 26 h (on the `clock`). Hourly daytime runs make up a missed run. | A stale warning and a navigation badge. A fresh setup shows **no run yet**, not stale. |
| Clock skew, or a wrong secret | Inbound rejections counted per day and reason (capped at 100 each) | Admin health: today's counts and the last reason, with a runbook entry. No badge: one stray request isn't an incident. A wrong secret also fails n8n's own calls, which raises workflow errors and, in time, a stale heartbeat. |
| A Convex function throws | Convex logs | Convex dashboard. Logs carry IDs and codes, never personal data. |

n8n keeps failed executions for 7 days. It saves **neither** successful **nor** manual executions,
because they contain email addresses ([security.md §4](security.md#4-data-minimization)).

## 13. Configuration and secrets

| Variable | Lives in | Purpose | Secret |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT` | `.env.local` (written by `npx convex dev`) | Convex client and deployment | no |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clerk frontend | no |
| `CLERK_SECRET_KEY` | `.env.local` | Clerk server side (`proxy.ts`) | **yes** |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env | Clerk JWT issuer for `auth.config.ts` | no |
| `APP_URL` | Convex env | Links in emails | no |
| `APP_TIMEZONE` | Convex env, and `.env.n8n` (where setup also sets `GENERIC_TIMEZONE` and `TZ` to the same value) | Calendar "today", and n8n's schedule timezone | no |
| `N8N_LOAN_EVENTS_URL` | Convex env (set by `npm run tunnel:sync`) | Webhook URL | no |
| `CONVEX_TO_N8N_SIGNING_SECRET` | Convex env, and `.env.n8n` | Signs calls to n8n | **yes** |
| `N8N_TO_CONVEX_SIGNING_SECRET` | Convex env, and `.env.n8n` | Verifies n8n's calls | **yes** |
| `ALLOW_DEV_FUNCTIONS` | Convex env (dev only) | Allows the `dev:*` seed functions | no |
| `N8N_ENCRYPTION_KEY_FILE` | `.env.n8n`, pointing to `.secrets/n8n_encryption_key` | Encrypts n8n credentials at rest. Passed as a file, so it isn't visible to `$env`. Support is verified in block 007 (§16). | **yes** |
| `CONVEX_SITE_URL` | `.env.n8n` | Base URL of the Convex HTTP endpoints | no |
| `ADMIN_ALERT_EMAIL` | `.env.n8n` | Recipient of the error workflow's emails | no |

- **Templates:** `.env.example` (Next.js) and `.env.n8n.example` (compose) document every
  variable.
- **Why `.env.n8n`:** compose gives it to the n8n service only (`env_file` on that one service),
  and Next.js never loads it (Next.js loads only `.env`, `.env.local` and `.env.[mode]`). So n8n's
  secrets reach neither the Next.js process nor the other containers.
- **`npm run setup`:**
  - generates the secrets (32 random bytes each, as base64url text);
  - sets the Convex side without ever printing a value: through stdin if the CLI supports it,
    otherwise as a command argument, which is a documented local exposure;
  - refuses to create a new encryption key when an n8n data volume already exists;
  - writes `GENERIC_TIMEZONE` and `TZ` into `.env.n8n` with the same value as `APP_TIMEZONE`,
    because n8n's schedule uses its own timezone (default `America/New_York`), and compose's
    `env_file` doesn't interpolate variables;
  - runs one clock tick, so the `clock` row exists from the start.

## 14. Local development topology

Convex dev deployments run in the cloud, so they cannot reach `localhost`
([ADR-001](adr/ADR-001-local-topology-convex-cloud-n8n-tunnel.md)):

```mermaid
flowchart LR
  subgraph PC["Your machine"]
    BR["Browser"] --> NX["Next.js dev :3000"]
    subgraph DC["docker compose"]
      CF["cloudflared<br/>quick tunnel (http2)"] --> ED["edge (Caddy)<br/>only POST /webhook/lendloop/*"]
      ED --> N8["n8n :5678 (editor on localhost only)"]
      N8 --> MP["Mailpit<br/>SMTP :1025 · inbox :8025"]
    end
  end
  subgraph Cloud
    CX["Convex dev deployment"]
    CK["Clerk"]
  end
  BR -- "Clerk JWT" --> CX
  CX -- "signed POST via *.trycloudflare.com" --> CF
  N8 -- "signed POST" --> CX
```

- **Edge proxy:** the tunnel exposes **only** the webhook paths. Everything else gets `404` with
  the header `X-LendLoop-Edge: denied`, so tests can tell the proxy's refusal from n8n's own 404.
- **Tunnel transport:** cloudflared runs with `--protocol http2`, because some networks block
  QUIC.
- **Tunnel URL:** `npm run dev` runs `tunnel:sync` first whenever the stack is up, so a restarted
  tunnel is picked up automatically.

## 15. Testing strategy

| Layer | Tooling | Covers |
| --- | --- | --- |
| Convex functions | Vitest + `convex-test` (edge-runtime environment; components such as the rate limiter registered explicitly) | Access rules for every public function; every loan transition (valid and invalid starting states); business-rule boundaries; outbox claim, lease token, FIFO order, acknowledgement, retry and dead-letter paths; the reminder claim state machine (same-run retries, abandonment and takeover, the end-of-day `missed` transition, stale write-backs, loans without `nextReminderOn`); HTTP endpoints (check order, signatures, bodies, idempotency, capped rejection counts); redaction |
| Libraries and scripts | Vitest (node) | HMAC against the fixed vector, date helpers, redaction, workflow sanitizer and checker, ID checker |
| Local stack | `npm run smoke:*` scripts, plus recorded manual checks | Signed event → email in Mailpit (through the Mailpit API) with the positive acknowledgement; invalid requests → `401` and no email; a reminder run twice → one email and one record; concurrent claim calls and write-backs to the dev deployment → each loan claimed once, one record, counted once; a failed send → only its own loan affected; a reminder run interrupted mid-way → its claims taken over, one reminder per borrower |
| UI | Typecheck, plus a manual QA checklist in each block's completion log | Views and states |

CI runs on every pushed branch and on PRs: typecheck, lint, tests, build, the workflow-JSON check
and the duplicate-ID check.

## 16. Open verification items

These come from the platform versions current on 2026-11-10 (Next.js 16.4, Clerk 7.9, Convex 1.49,
n8n 2.47, TypeScript 7.0). They are checked in the listed block, and the outcome is recorded in
its completion log.

| Item | Block |
| --- | --- |
| TypeScript: pin 6.0.x if `typescript-eslint` still requires `<6.1`; confirm what `create-next-app` installs | 001 |
| Next.js 16 `proxy.ts` (renamed middleware) with Clerk 7's `clerkMiddleware` | 002 |
| Clerk ↔ Convex setup (dashboard integration, `auth.config.ts` format), which claims carry the name and email, and the fallback if they don't (customize the session token claims; never give Convex the Clerk secret key) | 002 |
| Convex runtime support for `Intl.DateTimeFormat` with `timeZone` | 004 |
| `convex-test`: how components (rate limiter) are registered, and how HTTP actions are called | 003, 006 |
| Web Crypto HMAC in Convex actions and HTTP actions | 006 |
| n8n 2.x: `$env` access and `require('crypto')` in Code nodes under task runners | 007 |
| n8n 2.x: CLI import keeps IDs; publishing and activating workflows by ID; that an error workflow runs only when published | 007 |
| n8n 2.47 reads the encryption key from `N8N_ENCRYPTION_KEY_FILE`. Check: the key n8n stored in its settings file matches the key file (a script compares hashes and prints only "match" or "mismatch"). Fallback: `N8N_ENCRYPTION_KEY` in `.env.n8n`, recorded, with TD-003 widened because `$env` can then read it. | 007 |
| `npx convex env set` reading the value from stdin | 007 |
| cloudflared quick-tunnel hostname discovery (metrics endpoint or logs), and `--protocol http2` | 007 |
| n8n 2.x: reading the raw webhook body after in-memory binary mode was removed | 008 |
| n8n 2.x: the workflow execution timeout on webhook executions, and the status code returned when a workflow fails or times out before its Respond node. Only the positive acknowledgement counts as delivered, so this decides the error class, not correctness. | 008 |
| n8n 2.x: `GENERIC_TIMEZONE` and `TZ` from `.env.n8n` make n8n report `APP_TIMEZONE` as its timezone | 007 |
| The signed `run-reminders` webhook as the script trigger; Loop Over Items with batch size 1 and an elapsed-time check | 009 |
| n8n 2.x: the execution timeout as a backstop (applied after the current node finishes); whether a timed-out run triggers the error workflow | 009 |
