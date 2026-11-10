# LendLoop — Tech Debt Register

Items are appended as they are identified. Resolved items are marked in place, never removed.
Conventions: [.claude/rules/tech-debt-and-bugs.md](../.claude/rules/tech-debt-and-bugs.md).

The first items record trade-offs accepted during planning. They feed the production note
(block 012).

---

### TD-001: User profile changes sync only on sign-in

- **Source:** Planning baseline ([architecture.md §5.2](architecture.md#52-user-records), [security.md §6](security.md#6-residual-risks))
- **Module:** AUTH
- **Description:** `users:ensureUser` copies the name and email from the Clerk identity when the
  user signs in. A profile change or account deletion in Clerk does not reach Convex until the
  next sign-in, and a deleted user's data stays. Production should consume signed Clerk webhooks
  (`user.updated`, `user.deleted`) through a verified Convex HTTP action.
- **Priority:** Medium
- **Blocked by:** —

### TD-002: Signing secrets cannot be rotated without downtime

- **Source:** Planning baseline ([ADR-004](adr/ADR-004-hmac-request-signing.md))
- **Module:** AUTO
- **Description:** Each receiver verifies against a single secret per direction, so a rotation
  breaks calls in flight. Production should accept the current and the previous secret (for
  example `*_SIGNING_SECRET_PREVIOUS`) during a rotation window. The `v1=` signature prefix
  already leaves room for this.
- **Priority:** Medium
- **Blocked by:** —

### TD-003: n8n reads signing secrets from environment variables in Code nodes

- **Source:** Planning baseline ([ADR-004](adr/ADR-004-hmac-request-signing.md), [security.md §5](security.md#5-secrets-management))
- **Module:** AUTO
- **Description:** n8n has no HMAC credential type, so the signing and verification Code nodes
  read the secrets from `$env`. That requires env access in nodes, which lets any workflow editor
  read every environment variable of the n8n container. Production should use an external
  secrets manager, or move signing and verification into a small proxy in front of n8n.
- **Priority:** Medium
- **Blocked by:** —

### TD-004: Availability is computed per tool when it is read

- **Source:** Planning baseline ([architecture.md §6](architecture.md#6-loan-lifecycle))
- **Module:** TOOL, LOAN
- **Description:** Each tool's availability is derived from its loans on every query, which is
  one indexed lookup per tool. That is fine for a neighborhood, but it grows linearly with the
  catalogue. At scale, store an availability summary on the tool, updated by the loan
  transitions and the daily date change.
- **Priority:** Low
- **Blocked by:** —

### TD-005: "Today" does not advance in an open view at midnight

- **Source:** Planning baseline ([ADR-008](adr/ADR-008-calendar-dates-in-one-app-timezone.md), [security.md §6](security.md#6-residual-risks))
- **Module:** LOAN
- **Description:** Convex re-runs a query only when the data it read changes, so a view that stays
  open across midnight shows yesterday's availability and overdue state until something changes
  or the user navigates. A fix is to pass a client-computed date bucket as a query argument, or to
  have a nightly cron touch a "calendar" document that the queries read.
- **Priority:** Low
- **Blocked by:** —

### TD-006: A lost reply after a successful send can duplicate a notification email

- **Source:** Planning baseline ([ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md))
- **Module:** AUTO
- **Description:** Loan events are delivered at least once. If n8n sends the email but its `200`
  never reaches Convex, the outbox retries and the recipient gets the email twice. Production
  should pass `eventId` to the email provider as an idempotency key, or deduplicate inside n8n
  with a check that runs after the send succeeds.
- **Priority:** Low
- **Blocked by:** —
