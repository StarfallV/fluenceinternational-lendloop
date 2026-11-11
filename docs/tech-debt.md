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
  read the signing secrets from `$env`. That requires env access in nodes, which lets any workflow
  editor read the container's environment variables. The n8n encryption key is passed as a file
  (`N8N_ENCRYPTION_KEY_FILE`), so it is not among them, but both signing secrets are. Production
  should use an external secrets manager, or move signing and verification into a small proxy in
  front of n8n.
- **Priority:** Medium
- **Blocked by:** —

### TD-004: Availability is computed per tool when it is read

- **Source:** Planning baseline ([architecture.md §6](architecture.md#6-loan-lifecycle-availability-and-time))
- **Module:** TOOL, LOAN
- **Description:** Each tool's availability is derived from its loans on every query, which is
  one indexed lookup per tool. That is fine for a neighborhood, but it grows linearly with the
  catalogue. At scale, store an availability summary on the tool, updated by the loan
  transitions and the daily date change.
- **Priority:** Low
- **Blocked by:** —

### TD-005: "Today" does not advance in an open view at midnight

- **Source:** Planning baseline ([ADR-008](adr/ADR-008-calendar-dates-in-one-app-timezone.md))
- **Module:** LOAN
- **Description:** Convex re-runs a query only when the data it read changes, so a view that stays
  open across midnight would show yesterday's availability and overdue state until something
  changes or the user navigates. **Planned resolution:** the `clock` row that queries read, which a
  per-minute tick rewrites on each hour and date change
  ([architecture.md §6](architecture.md#6-loan-lifecycle-availability-and-time)), built in
  block 004. Mark this item resolved when it ships.
- **Priority:** Low
- **Blocked by:** Block 004

### TD-006: Narrow cases can still duplicate an email

- **Source:** Planning baseline ([ADR-004](adr/ADR-004-hmac-request-signing.md), [ADR-005](adr/ADR-005-delivery-semantics-and-idempotent-write-backs.md)); widened after planning review rounds 1, 2 and 3
- **Module:** AUTO
- **Description:** Delivery is at least once. A recipient can get an email twice in four narrow
  cases:
  - n8n sends a notification, but its acknowledgement never reaches Convex;
  - the execution timeout cancels a notification whose SMTP send then completes anyway, after n8n
    has answered with an error, so Convex retries it;
  - n8n sends a reminder, but the write-back never lands: n8n crashes, the write-back fails after
    its retries, or the run stops while a stalled SMTP send is still in progress. The claim is
    taken over and a later run sends again;
  - a captured, validly signed loan event is replayed to n8n inside the 5-minute window.

  Duplicate *records* are impossible in all four. Production should pass `eventId` (or the
  reminder key) to the email provider as an idempotency key, or deduplicate inside n8n with a
  check that runs after the send succeeds.
- **Priority:** Low
- **Blocked by:** —

### TD-007: Anyone can sign up and see every listing

- **Source:** Planning review round 1, finding 20
- **Module:** AUTH
- **Description:** Clerk sign-up is open, so anyone who creates an account sees every listing,
  owner display name and Trusted badge. That is fine for a demo, but a real neighborhood board
  should restrict membership: invite-only or allowlisted sign-up through Clerk restrictions, or
  address verification.
- **Priority:** Medium
- **Blocked by:** —

### TD-008: A borrower cannot report that they returned a tool

- **Source:** Planning review round 1, finding 20
- **Module:** LOAN
- **Description:** Only the lender can mark a loan returned. If a lender forgets, the borrower
  keeps getting overdue reminders, up to the cap of 7 (BR-20), even though the tool is back. A
  borrower-side "I returned it" action that asks the lender to confirm, and pauses reminders
  meanwhile, would close the gap.
- **Priority:** Low
- **Blocked by:** —

### TD-009: The secret guard can be switched off, and misses commands that print secrets

- **Source:** Planning review round 4, findings New 4 and New 5
- **Module:** PLT
- **Description:** The hook in `.claude/hooks/guard-secrets.mjs` and the deny rules have gaps:
  - **Silent off-switches:**
    - The shell-form hook command expands `$CLAUDE_PROJECT_DIR` to nothing when Claude Code runs
      hooks in PowerShell (no Git Bash). The hook then fails to load, and every command runs.
    - Run through a junction or symlink, the entry guard compares unresolved paths and exits
      without a decision.
    - The matcher misses the Monitor tool.
  - **Commands that print secrets without naming a secret file:**
    - `docker compose config` (unless it has `--no-env-resolution`);
    - `docker compose exec n8n printenv` and `docker inspect`;
    - recursive `grep -r` or `Get-ChildItem -Recurse | Select-String`.

    The pattern is also case-sensitive, and NTFS isn't, so `.ENV` slips through.
  - **File rules:** `Read(./…)` and `Edit(./…)` are relative to the current directory; anchor them
    to the project with a leading `/`.

  **Planned resolution in block 001**, before block 002 creates the first secret file:
  - the documented exec form for the hook command (`node` plus an `args` path);
  - an entry guard that compares real paths, or `secretNamesIn` in its own imported module;
  - `Monitor` in the matcher;
  - the command shapes above blocked (`docker compose config --no-env-resolution` stays allowed);
  - a case-insensitive pattern, and `/`-anchored file rules;
  - an entry-point test that spawns the hook with JSON on stdin, next to the `secretNamesIn`
    cases;
  - security.md §5 updated with what is covered and what isn't;
  - a names-only helper script for block 007's container-environment check.

  Mark this item resolved when block 001 ships.
- **Priority:** High
- **Blocked by:** Block 001
- **Status: Resolved (block 001).**
  - **Hook:** the matching moved to `.claude/hooks/secret-names.mjs`, and the entry point always
    runs. The hook is registered in exec form for Bash, PowerShell and Monitor.
  - **Matching:** names match case-insensitively, and the leaky command shapes are blocked.
  - **File rules:** anchored with `/`, and they cover every env file Next.js loads.
  - **Tests:** 45 command cases at first, 141 after block 001's review rounds 1 to 4 (99 blocked,
    42 allowed), plus timing tests, entry-point tests and a test of the registration in
    `settings.json`. Live probes were blocked, Monitor's included.
  - **Docs:** security.md §5 lists the coverage, and block 007's spec has the names-only helper.

### TD-010: Reminder claim gaps to close in block 006

- **Source:** Planning review round 4, findings New 1, New 2, New 3, New 8 (heartbeat, backfill)
  and New 9
- **Module:** AUTO
- **Description:**
  - **A reminder that fails all day is never "missed".** The end-of-day sweep turns only open
    claims into `missed`. A reminder that fails in every run (a rejected address, an all-day SMTP
    outage) never raises the badge, against AUT-2's "shown to admins as missed". Move `failed` to
    `missed` at the end of its day too, keeping its error, and test it. Loans that are due but
    never claimed before 20:00 also leave no record.
  - **Claims of loans that leave `approved` can't clear.** An abandoned claim of a loan returned
    in the meantime can't be taken over. The badge stays lit until midnight, then shows the claim
    as missed for 24 h. Either count `abandoned` and `missed` in health only while the loan is
    approved, or resolve open reminder records in `transition()`.
  - **The §8 diagram lags the text.** It lacks `failed`, `abandoned` and `missed` → `sent`, and
    the direct takeover of an expired `sending` claim the sweep hasn't marked, which the text and
    ADR-005 allow.
  - **Heartbeat threshold.** 26 h was sized for one daily run. With hourly runs, the longest
    healthy gap is 13 h, so about 15 h would flag an outage overnight.
  - **Backfill.** Set `nextReminderOn` only for approved loans with fewer than 7 reminders, and
    make running it a criterion or a Manual Step.
  - **Optional simplification.** `reclaimed` and `reclaimedBy` can go; abandoned claims in health
    already show an interrupted run.

  **Planned resolution:** at the start of block 006, update architecture.md §8 and §12, ADR-005,
  ADR-006, the PRD (AUT-2, ADM-4) and the block 006 spec, then build ("When the spec is wrong",
  delivery-blocks rule). Mark this item resolved when block 006 ships.
- **Priority:** High
- **Blocked by:** Block 006

### TD-011: Reminder checks and duplicate cases to settle in blocks 009 and 010

- **Source:** Planning review round 4, findings New 2 (smoke cleanup), New 6 and New 7
- **Module:** AUTO
- **Description:**
  - **Manual checks that can't run as written:**
    - `dev:backdateLastRun` must backdate every `overdue-reminders` summary from the last 27 h,
      not only the newest.
    - `dev:createOverdueLoan` needs an optional demo borrower, so the containment check can make
      Mailpit reject one borrower only.
    - The interrupted-run check must restart n8n within about 20 s, before the first send fails
      at nodemailer's 30 s greeting timeout.
  - **Smoke cleanup:** `smoke:idempotency` leaves claims open, which later light the badge and
    are then emailed for real. It should write back `failed` (code `SMOKE`) for every claim it
    doesn't use.
  - **Another duplicate case:** an SMTP server can accept a message and then drop the connection
    before its reply (RFC 1047). nodemailer then reports an error although the email went out, so
    the next run re-sends a reminder, and Convex's retry re-sends a notification. Add the case to
    TD-006, ADR-005 and security.md §6.
  - **Lease bound:** `socketTimeout` is an idle timer, so a server that trickles can hold a send
    past "about 13 minutes". State the lease argument as covering one stall. Note that the
    10-minute backstop then ends the run without a summary, and that the stalled loan can be
    re-sent each hour while the fault lasts.

  **Planned resolution:** blocks 009 and 010 update their specs and the documents above before
  building. Mark this item resolved when both have shipped.
- **Priority:** Medium
- **Blocked by:** Blocks 009, 010

### TD-012: Process gaps around fix blocks, the baseline PR and bug reports

- **Source:** Planning review round 4, finding New 8
- **Module:** PLT
- **Description:**
  - **Fix blocks:**
    - resume-block looks for `*feature/$ARGUMENTS-*`, which misses `fix/BUG-nnn-*` branches;
    - create-blocks always writes `feature/` Branch lines;
    - no skill writes a fix-block spec.
  - **Baseline PR:** close-block's merge step says "Once CI is green" without the planning
    baseline's CI exemption. Required status checks on `main` would also block that PR.
  - **Bug reports:** filing a bug report, or setting its status, isn't bookkeeping, so doing it
    after a review would force another round. Add `docs/bugs/` reports and their status lines to
    the bookkeeping list.

  **Planned resolution:** block 001, with its other `.claude/` changes. Mark this item resolved
  when it ships.
- **Priority:** Low
- **Blocked by:** Block 001
- **Status: Resolved (block 001).**
  - resume-block takes the branch from the spec's Branch line.
  - create-blocks and the spec template describe fix blocks.
  - close-block's merge step covers the planning baseline's missing CI.
  - New bug reports and their status lines are bookkeeping.

### TD-013: The secret guard doesn't know the n8n key file's path inside the container

- **Source:** Block 001 (review rounds [1](reviews/001-review-1.md), [2](reviews/001-review-2.md)
  and [3](reviews/001-review-3.md), issue 2 in each)
- **Module:** PLT
- **Description:** Block 007 mounts `.secrets/n8n_encryption_key` into the n8n container and
  points `N8N_ENCRYPTION_KEY_FILE` at it, and gives n8n a named data volume. The guard can't name
  either before `compose.yml` exists:
  - inside the container, the key file's path has no `.secrets` in it, so the name match misses
    `docker compose exec n8n cat <mount path>`;
  - the data volume, mounted into another container, exposes `config` under another path
    (`docker run --rm -v <volume>:/data alpine cat /data/config`).

  The guard already blocks reads of `~/.n8n/config` (which holds the same key), reads through
  `$N8N_ENCRYPTION_KEY_FILE` (any `ENCRYPTION_KEY` text), `docker cp` of `.n8n`, and decrypted
  credential exports. Once `compose.yml` fixes the mount path and the volume name, add both to
  `containerLeak` in `.claude/hooks/secret-names.mjs`, with a test row each, and list them in
  security.md §5. The block 007 spec carries this.
- **Priority:** Medium
- **Blocked by:** Block 007

### TD-014: The shadcn CLI's dependencies have open advisories

- **Source:** Block 001 (`npm audit` during review round 1 fixes)
- **Module:** WEB
- **Description:** `npm audit` reports 6 advisories (2 low, 4 moderate), all in the `shadcn`
  CLI's own tree: `deepmerge` (prototype poisoning, through `@shadcn/registry`) and `minimatch`
  (ReDoS, through `ts-morph`). The only fix npm offers is a downgrade to shadcn 1.0.0. `shadcn` is a
  dev dependency, used by the app only for its build-time `shadcn/tailwind.css`, so
  `npm audit --omit=dev` finds 0 and nothing reaches the app bundle. Upgrade when shadcn ships
  fixed dependencies, and recheck before the release (block 012).
- **Priority:** Low
- **Blocked by:** — (upstream)
